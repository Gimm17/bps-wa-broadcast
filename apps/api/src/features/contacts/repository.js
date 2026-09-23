import { pool } from '../../db/pool.js';

export async function listContacts({
  type,
  status,
  unitKerja,
  tagIds,
  topicIds,
  search,
  page = 1,
  limit = 50
}, client = null) {
  const db = client || pool;
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (type) {
    conditions.push(`c.type = $${paramIndex++}`);
    params.push(type);
  }

  if (status) {
    conditions.push(`c.status = $${paramIndex++}`);
    params.push(status);
  }

  if (unitKerja) {
    conditions.push(`ep.unit_kerja ILIKE $${paramIndex++}`);
    params.push(`%${unitKerja}%`);
  }

  if (search) {
    const trimmed = search.trim();
    const phoneDigits = trimmed.replace(/[\s\-\(\)\.]+/g, '').replace(/^0/, '');
    conditions.push(`(c.name ILIKE $${paramIndex} OR c.phone_e164 ILIKE $${paramIndex} OR c.phone_e164 ILIKE $${paramIndex + 1} OR ep.nip ILIKE $${paramIndex})`);
    params.push(`%${trimmed}%`, `%${phoneDigits}%`);
    paramIndex += 2;
  }

  if (tagIds && tagIds.length) {
    const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
    conditions.push(`EXISTS (
      SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id = ANY($${paramIndex++}::uuid[])
    )`);
    params.push(ids);
  }

  if (topicIds && topicIds.length) {
    const ids = Array.isArray(topicIds) ? topicIds : [topicIds];
    conditions.push(`EXISTS (
      SELECT 1 FROM subscriptions s WHERE s.contact_id = c.id AND s.topic_id = ANY($${paramIndex++}::uuid[]) AND s.status = 'active'
    )`);
    params.push(ids);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total query
  const countSql = `
    SELECT COUNT(DISTINCT c.id) AS total
    FROM contacts c
    LEFT JOIN employee_profiles ep ON ep.contact_id = c.id
    LEFT JOIN public_profiles pp ON pp.contact_id = c.id
    ${whereClause}
  `;
  const { rows: countRows } = await db.query(countSql, params);
  const total = parseInt(countRows[0]?.total || '0', 10);

  // Paginated query
  const offset = (page - 1) * limit;
  const dataSql = `
    SELECT
      c.id,
      c.type,
      c.name,
      c.phone_e164,
      c.status,
      c.created_at,
      c.updated_at,
      ep.nip,
      ep.unit_kerja,
      ep.jabatan,
      pp.instansi,
      pp.profesi,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FILTER (WHERE t.id IS NOT NULL), '[]'::json
      ) AS tags,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('topicId', top.id, 'topicTitle', top.title, 'status', sub.status))
        FILTER (WHERE top.id IS NOT NULL), '[]'::json
      ) AS subscriptions
    FROM contacts c
    LEFT JOIN employee_profiles ep ON ep.contact_id = c.id
    LEFT JOIN public_profiles pp ON pp.contact_id = c.id
    LEFT JOIN contact_tags ct ON ct.contact_id = c.id
    LEFT JOIN tags t ON t.id = ct.tag_id
    LEFT JOIN subscriptions sub ON sub.contact_id = c.id
    LEFT JOIN topics top ON top.id = sub.topic_id
    ${whereClause}
    GROUP BY c.id, ep.id, pp.id
    ORDER BY c.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  params.push(limit, offset);
  const { rows } = await db.query(dataSql, params);

  return {
    contacts: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function findContactById(id, client = null) {
  const db = client || pool;
  const { rows } = await db.query(`
    SELECT
      c.id,
      c.type,
      c.name,
      c.phone_e164,
      c.status,
      c.created_at,
      c.updated_at,
      ep.nip,
      ep.unit_kerja,
      ep.jabatan,
      pp.instansi,
      pp.profesi,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color))
        FILTER (WHERE t.id IS NOT NULL), '[]'::json
      ) AS tags,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('topicId', top.id, 'topicTitle', top.title, 'status', sub.status))
        FILTER (WHERE top.id IS NOT NULL), '[]'::json
      ) AS subscriptions
    FROM contacts c
    LEFT JOIN employee_profiles ep ON ep.contact_id = c.id
    LEFT JOIN public_profiles pp ON pp.contact_id = c.id
    LEFT JOIN contact_tags ct ON ct.contact_id = c.id
    LEFT JOIN tags t ON t.id = ct.tag_id
    LEFT JOIN subscriptions sub ON sub.contact_id = c.id
    LEFT JOIN topics top ON top.id = sub.topic_id
    WHERE c.id = $1
    GROUP BY c.id, ep.id, pp.id
  `, [id]);

  return rows[0] || null;
}

export async function upsertContact({
  type,
  name,
  phoneE164,
  status = 'active',
  nip = null,
  unitKerja = null,
  jabatan = null,
  instansi = null,
  profesi = null
}, client = null) {
  const db = client || pool;

  const { rows } = await db.query(`
    INSERT INTO contacts (type, name, phone_e164, status)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (phone_e164) DO UPDATE
    SET name = EXCLUDED.name,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        updated_at = now()
    RETURNING id, type, name, phone_e164, status, created_at, updated_at
  `, [type, name, phoneE164, status]);

  const contact = rows[0];

  if (type === 'employee') {
    await db.query(`
      INSERT INTO employee_profiles (contact_id, nip, unit_kerja, jabatan)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (contact_id) DO UPDATE
      SET nip = COALESCE(EXCLUDED.nip, employee_profiles.nip),
          unit_kerja = COALESCE(EXCLUDED.unit_kerja, employee_profiles.unit_kerja),
          jabatan = COALESCE(EXCLUDED.jabatan, employee_profiles.jabatan),
          updated_at = now()
    `, [contact.id, nip, unitKerja, jabatan]);
  } else {
    await db.query(`
      INSERT INTO public_profiles (contact_id, instansi, profesi)
      VALUES ($1, $2, $3)
      ON CONFLICT (contact_id) DO UPDATE
      SET instansi = COALESCE(EXCLUDED.instansi, public_profiles.instansi),
          profesi = COALESCE(EXCLUDED.profesi, public_profiles.profesi),
          updated_at = now()
    `, [contact.id, instansi, profesi]);
  }

  return contact;
}
