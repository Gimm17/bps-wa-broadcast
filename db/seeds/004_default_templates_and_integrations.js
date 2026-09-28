import { encryptSecret } from '../../apps/api/src/features/integrations/crypto.js';

export async function seed(client) {
  // 1. Seed standard BPS Sulteng operational templates
  const templates = [
    {
      name: 'brs_rilis_bulanan',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Berita Resmi Statistik BPS Sulteng'
        },
        {
          type: 'BODY',
          text: 'Halo {{1}}, rilis data {{2}} telah terbit. Indikator utama mencatat {{3}}. Kunjungi {{4}} untuk informasi selengkapnya.'
        },
        {
          type: 'FOOTER',
          text: 'BPS Provinsi Sulawesi Tengah • Ketik BERHENTI untuk berhenti berlangganan'
        }
      ]
    },
    {
      name: 'pengingat_presensi_pegawai',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'BODY',
          text: 'Yth. {{1}}, Anda tercatat belum melakukan presensi masuk hari ini {{2}} WITA. Segera lakukan presensi pada portal internal SIMPEG Sulteng.'
        },
        {
          type: 'FOOTER',
          text: 'Bagian Umum BPS Provinsi Sulawesi Tengah'
        }
      ]
    },
    {
      name: 'silastik_layanan_update',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'BODY',
          text: 'Yth. Pemohon Data {{1}}, status permohonan layanan PST Silastik Anda #{{2}} telah diperbarui menjadi: {{3}}. Silakan cek portal PST BPS Sulteng.'
        }
      ]
    }
  ];

  for (const t of templates) {
    await client.query(`
      INSERT INTO meta_templates (name, language, category, status, components, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (name, language) DO UPDATE
      SET category = EXCLUDED.category,
          status = EXCLUDED.status,
          components = EXCLUDED.components,
          updated_at = now();
    `, [t.name, t.language, t.category, t.status, JSON.stringify(t.components)]);
  }

  // 2. Seed active MPWA WhatsApp Gateway integration (Nova Media)
  const mpwaCreds = {
    provider: 'mpwa',
    apiKey: process.env.MPWA_API_KEY || 'm87iDrDIqNxZaodjybbhE6HSnzxd9A',
    sender: process.env.MPWA_SENDER || '6287786686392',
    baseUrl: process.env.MPWA_BASE_URL || 'https://www.wa-admin.novamedia.my.id'
  };

  const encrypted = {
    provider: mpwaCreds.provider,
    apiKey: encryptSecret(mpwaCreds.apiKey),
    sender: encryptSecret(mpwaCreds.sender),
    baseUrl: encryptSecret(mpwaCreds.baseUrl)
  };

  await client.query(`
    INSERT INTO integrations (type, name, status, encrypted_credentials, last_sync_at, updated_at)
    VALUES ('meta_waba', 'WhatsApp Gateway MPWA (Nova Media — Mitra Resmi Meta WABA)', 'connected', $1, now(), now())
    ON CONFLICT (type) DO UPDATE
    SET name = EXCLUDED.name,
        status = EXCLUDED.status,
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        last_sync_at = now(),
        last_error = NULL,
        updated_at = now();
  `, [JSON.stringify(encrypted)]);
}
