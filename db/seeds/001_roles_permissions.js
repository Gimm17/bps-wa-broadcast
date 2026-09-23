import { ROLES, PERMISSIONS, ROLE_PERMISSIONS_MAP } from '@bps/shared';

export async function seed(client) {
  // Insert permissions
  for (const [key, code] of Object.entries(PERMISSIONS)) {
    await client.query(`
      INSERT INTO permissions (code, description)
      VALUES ($1, $2)
      ON CONFLICT (code) DO NOTHING
    `, [code, `Permission for ${code}`]);
  }

  // Insert roles
  const roleNames = {
    [ROLES.SUPER_ADMIN]: { name: 'Super Administrator', description: 'Full access to all platform resources and settings' },
    [ROLES.ADMIN_DISEMINASI]: { name: 'Admin Diseminasi', description: 'Manage campaigns, broadcasts, contacts, and reports' },
    [ROLES.OPERATOR]: { name: 'Operator', description: 'Draft campaigns, manage contacts, and view reports' },
    [ROLES.VIEWER]: { name: 'Viewer', description: 'Read-only access to campaigns and metrics' }
  };

  for (const [code, info] of Object.entries(roleNames)) {
    await client.query(`
      INSERT INTO roles (code, name, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description
    `, [code, info.name, info.description]);
  }

  // Map permissions to roles
  for (const [roleCode, permList] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    const roleRes = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
    if (!roleRes.rows[0]) continue;
    const roleId = roleRes.rows[0].id;

    for (const permCode of permList) {
      const permRes = await client.query('SELECT id FROM permissions WHERE code = $1', [permCode]);
      if (!permRes.rows[0]) continue;
      const permId = permRes.rows[0].id;

      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [roleId, permId]);
    }
  }
}
