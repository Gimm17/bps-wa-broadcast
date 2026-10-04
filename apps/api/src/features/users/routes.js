import express from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateCsrf } from '../../middleware/csrf.js';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS_MAP } from '@bps/shared';
import { hashPassword } from '../auth/hasher.js';
import { recordAudit } from '../audit/service.js';

export function createUsersRouter({ db }) {
  const router = express.Router();
  router.use(authenticate);

  // 1. Get all users with their roles
  router.get('/users', authorize(PERMISSIONS.USER_READ), async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.name,
          u.is_active,
          u.failed_login_attempts,
          u.locked_until,
          u.last_login_at,
          u.created_at,
          COALESCE(
            json_agg(
              json_build_object('id', r.id, 'code', r.code, 'name', r.name)
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `);

      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  // 2. Get roles & permission matrix
  router.get('/roles', authorize(PERMISSIONS.USER_READ), async (req, res, next) => {
    try {
      const { rows: roles } = await db.query('SELECT * FROM roles ORDER BY name ASC');
      res.json({
        data: {
          roles,
          matrix: ROLE_PERMISSIONS_MAP
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Create new user
  router.post('/users', authorize(PERMISSIONS.USER_MANAGE), validateCsrf, async (req, res, next) => {
    try {
      const { name, username, email, password, roleCode } = req.body;

      if (!name || !username || !email || !password || !roleCode) {
        return res.status(400).json({ error: { message: 'Semua field wajib diisi' } });
      }

      // Check duplicate email or username
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email.trim().toLowerCase(), username.trim().toLowerCase()]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: { message: 'Email atau username sudah terdaftar' } });
      }

      const roleRes = await db.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
      if (roleRes.rows.length === 0) {
        return res.status(400).json({ error: { message: 'Role tidak valid' } });
      }
      const roleId = roleRes.rows[0].id;

      const passwordHash = await hashPassword(password);

      const userRes = await db.query(`
        INSERT INTO users (name, username, email, password_hash, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, name, username, email, is_active, created_at
      `, [name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash]);

      const newUser = userRes.rows[0];

      await db.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [newUser.id, roleId]);

      await recordAudit({
        userId: req.user.id,
        action: 'user.create',
        resourceType: 'user',
        resourceId: newUser.id,
        details: { username: newUser.username, email: newUser.email, roleCode },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        client: db
      });

      res.status(201).json({ data: newUser });
    } catch (err) {
      next(err);
    }
  });

  // 4. Update user info & role
  router.put('/users/:id', authorize(PERMISSIONS.USER_MANAGE), validateCsrf, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, email, roleCode, is_active } = req.body;

      const userRes = await db.query(`
        UPDATE users
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            is_active = COALESCE($3, is_active),
            updated_at = now()
        WHERE id = $4
        RETURNING id, name, username, email, is_active, updated_at
      `, [name ? name.trim() : null, email ? email.trim().toLowerCase() : null, is_active, id]);

      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Pengguna tidak ditemukan' } });
      }

      if (roleCode) {
        const roleRes = await db.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
        if (roleRes.rows.length > 0) {
          await db.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
          await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [id, roleRes.rows[0].id]);
        }
      }

      await recordAudit({
        userId: req.user.id,
        action: 'user.update',
        resourceType: 'user',
        resourceId: id,
        details: { name, email, roleCode, is_active },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        client: db
      });

      res.json({ data: userRes.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  // 5. Reset user password
  router.post('/users/:id/reset-password', authorize(PERMISSIONS.USER_MANAGE), validateCsrf, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ error: { message: 'Kata sandi minimal 8 karakter' } });
      }

      const passwordHash = await hashPassword(password);

      const userRes = await db.query(`
        UPDATE users
        SET password_hash = $1,
            failed_login_attempts = 0,
            locked_until = null,
            updated_at = now()
        WHERE id = $2
        RETURNING id, username, email
      `, [passwordHash, id]);

      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Pengguna tidak ditemukan' } });
      }

      // Invalidate existing sessions for this user
      await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);

      await recordAudit({
        userId: req.user.id,
        action: 'user.password_reset',
        resourceType: 'user',
        resourceId: id,
        details: { targetUsername: userRes.rows[0].username },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        client: db
      });

      res.json({ data: { message: 'Kata sandi pengguna berhasil diperbarui' } });
    } catch (err) {
      next(err);
    }
  });

  // 6. Toggle active status
  router.post('/users/:id/toggle-status', authorize(PERMISSIONS.USER_MANAGE), validateCsrf, async (req, res, next) => {
    try {
      const { id } = req.params;

      if (req.user.id === id) {
        return res.status(400).json({ error: { message: 'Tidak dapat menonaktifkan akun sendiri' } });
      }

      const userRes = await db.query(`
        UPDATE users
        SET is_active = NOT is_active,
            updated_at = now()
        WHERE id = $1
        RETURNING id, username, is_active
      `, [id]);

      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Pengguna tidak ditemukan' } });
      }

      const updated = userRes.rows[0];

      // If deactivated, kill user sessions
      if (!updated.is_active) {
        await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      }

      await recordAudit({
        userId: req.user.id,
        action: updated.is_active ? 'user.activate' : 'user.deactivate',
        resourceType: 'user',
        resourceId: id,
        details: { targetUsername: updated.username, isActive: updated.is_active },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        client: db
      });

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
