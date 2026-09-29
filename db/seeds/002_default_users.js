import { hashPassword } from '../../apps/api/src/features/auth/hasher.js';
import { ROLES } from '@bps/shared';

export async function seed(client) {
  const users = [
    {
      username: 'admin',
      email: 'admin@sulteng.bps.go.id',
      name: 'Administrator BPS Sulteng',
      password: 'Admin1234!',
      roleCode: ROLES.SUPER_ADMIN
    },
    {
      username: 'operator',
      email: 'operator@sulteng.bps.go.id',
      name: 'Operator Diseminasi',
      password: 'Operator1234!',
      roleCode: ROLES.OPERATOR
    },
    {
      username: 'viewer',
      email: 'viewer@sulteng.bps.go.id',
      name: 'Pimpinan & Pengamat',
      password: 'Viewer1234!',
      roleCode: ROLES.VIEWER
    }
  ];

  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    const userRes = await client.query(`
      INSERT INTO users (username, email, password_hash, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name,
          username = EXCLUDED.username
      RETURNING id;
    `, [u.username, u.email, passwordHash, u.name]);

    const userId = userRes.rows[0].id;

    const roleRes = await client.query('SELECT id FROM roles WHERE code = $1', [u.roleCode]);
    if (roleRes.rows[0]) {
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [userId, roleRes.rows[0].id]);
    }
  }
}
