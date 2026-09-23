export async function seed(client) {
  const topics = [
    {
      code: 'inflasi_ihk',
      title: 'Indikator Inflasi & IHK Bulanan',
      description: 'Rilis resmi angka inflasi dan Indeks Harga Konsumen provinsi Sulawesi Tengah setiap awal bulan.'
    },
    {
      code: 'pertumbuhan_ekonomi',
      title: 'Pertumbuhan Ekonomi & PDRB',
      description: 'Laporan triwulanan pertumbuhan ekonomi dan Produk Domestik Regional Bruto (PDRB).'
    },
    {
      code: 'ketenagakerjaan_kemiskinan',
      title: 'Ketenagakerjaan & Kemiskinan',
      description: 'Rilis indikator ketenagakerjaan, tingkat pengangguran terbuka, dan profil kemiskinan.'
    },
    {
      code: 'kepegawaian_internal',
      title: 'Pengumuman Internal & Kepegawaian',
      description: 'Informasi dan notifikasi khusus pegawai BPS Provinsi Sulawesi Tengah.'
    }
  ];

  for (const t of topics) {
    await client.query(`
      INSERT INTO topics (code, title, description, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (code) DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description;
    `, [t.code, t.title, t.description]);
  }
}
