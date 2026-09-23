<script>
  import StatusChip from '../lib/components/StatusChip.svelte';
  import DataTable from '../lib/components/DataTable.svelte';

  const operationalNodes = [
    { name: 'Meta WABA', status: 'operational', label: 'Terhubung', latency: '142ms • 2 mnt lalu WITA', action: 'Cek Tier' },
    { name: 'Cron Worker', status: 'operational', label: 'Normal', latency: 'Heartbeat: 4d lalu', action: 'Log Worker' },
    { name: 'API Absensi', status: 'operational', label: 'Sinkron', latency: '07:30 WITA (84 peg.)', action: 'Detail' },
    { name: 'Silastik BPS', status: 'operational', label: 'Aktif', latency: 'Trx #51193 (12m lalu)', action: 'Status' },
    { name: 'Web Sulteng', status: 'warning', label: 'Siap Rilis', latency: 'BRS Inflasi Okt', action: 'Katalog' }
  ];

  const kpis = [
    { title: 'Total Pesan Terkirim', value: '12.842', trend: '+18.4% bln ini', icon: 'send', color: '#007979' },
    { title: 'Delivery Rate', value: '98.4%', trend: 'Target >95%', icon: 'verified', color: '#24B1B1' },
    { title: 'Broadcast Berjalan', value: '3 Aktif', trend: '1 Antrean WITA', icon: 'schedule', color: '#E37434' },
    { title: 'Kontak Terdaftar', value: '2.140', trend: '1.420 Peg. • 720 Masy.', icon: 'contacts', color: '#172020' },
    { title: 'Kapasitas WABA', value: 'Tier 2', trend: '10.000 pesan/hari', icon: 'cloud', color: '#007979' }
  ];

  const columns = [
    { label: 'Nama Broadcast / Campaign' },
    { label: 'Segmen Target' },
    { label: 'Status' },
    { label: 'Progres Kirim' },
    { label: 'Jadwal (WITA)' }
  ];

  const recentBroadcasts = [
    {
      title: 'Pengingat Presensi Pagi BPS Sulteng',
      type: 'Otomatisasi Presensi',
      target: 'Pegawai ASN (84 kontak)',
      status: 'operational',
      statusText: 'Selesai',
      progress: '84/84 (100%)',
      time: 'Hari ini, 07:30 WITA'
    },
    {
      title: 'Diseminasi BRS Inflasi & NTP Sulawesi Tengah',
      type: 'Publikasi Resmi',
      target: 'Masyarakat & Media (320 kontak)',
      status: 'warning',
      statusText: 'Terjadwal',
      progress: 'Siap kirim',
      time: '01 Okt 2026, 11:00 WITA'
    },
    {
      title: 'Update Tiket Konsultasi Silastik #51193',
      type: 'Transaksi Silastik',
      target: 'Pemohon Statistik (1 kontak)',
      status: 'operational',
      statusText: 'Terkirim',
      progress: '1/1 (100%)',
      time: '12 mnt lalu'
    }
  ];
</script>

<div class="flex flex-col gap-6">
  <!-- 1. Operational Status Strip -->
  <section aria-label="Status Infrastruktur Konektor" class="w-full bg-[#FFFFFF] rounded-xl p-3 shadow-sm border border-[#DCE2DF]">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
      {#each operationalNodes as node}
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-[#ecf6f5] border border-[#DCE2DF]">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-7 h-7 rounded-md bg-[#24B1B1]/15 text-[#24B1B1] flex items-center justify-center shrink-0 text-[14px]">
              ●
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-[12px] font-semibold text-[#172020] truncate">{node.name}</span>
                <StatusChip status={node.status} text={node.label} />
              </div>
              <span class="text-[11px] text-[#66706F] truncate font-mono">{node.latency}</span>
            </div>
          </div>
          <button type="button" class="ml-2 px-2 py-1 rounded bg-[#FFFFFF] hover:bg-[#F7F7F3] text-[#66706F] hover:text-[#172020] text-[11px] font-medium border border-[#DCE2DF] transition-colors shrink-0">
            {node.action}
          </button>
        </div>
      {/each}
    </div>
  </section>

  <!-- 2. Primary Action Bar -->
  <section class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h1 class="text-[20px] font-bold text-[#172020] tracking-tight">Pusat Komando Siaran WhatsApp Resmi</h1>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#007979]/10 text-[#007979] border border-[#007979]/20">
          v2.4-PROD
        </span>
      </div>
      <div class="flex items-center gap-3 text-[12px] text-[#66706F]">
        <span>BPS Provinsi Sulawesi Tengah • Waktu Operasional:</span>
        <span class="font-mono font-semibold text-[#172020]">10:48:22 WITA (Asia/Makassar)</span>
      </div>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <a
        href="#/campaigns"
        class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FFFFFF] hover:bg-[#F7F7F3] text-[#172020] text-[13px] font-medium border border-[#DCE2DF] transition-colors shadow-sm"
      >
        <span>⚡</span>
        <span>Kirim Siaran Mendesak</span>
      </a>
      <a
        href="#/campaigns"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E37434] hover:bg-[#c95f22] text-white text-[13px] font-semibold transition-all shadow-sm"
      >
        <span>+</span>
        <span>Buat Campaign Baru</span>
      </a>
    </div>
  </section>

  <!-- 3. Compact KPI Summaries -->
  <section aria-label="Ringkasan Kinerja Harian" class="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
    {#each kpis as kpi}
      <div class="p-4 rounded-xl bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
        <div class="text-[12px] text-[#66706F] font-medium">{kpi.title}</div>
        <div class="text-[22px] font-bold text-[#172020] mt-1 font-mono">{kpi.value}</div>
        <div class="text-[11px] text-[#007979] font-medium mt-1">{kpi.trend}</div>
      </div>
    {/each}
  </section>

  <!-- 4. Recent Campaigns / Activities Table -->
  <section aria-label="Aktivitas Terkini">
    <DataTable columns={columns} caption="Siaran & Aktivitas Terbaru (WITA)">
      {#each recentBroadcasts as item}
        <tr class="hover:bg-[#F7F7F3] transition-colors">
          <td class="px-4 py-3">
            <div class="font-medium text-[#172020]">{item.title}</div>
            <div class="text-[11px] text-[#66706F]">{item.type}</div>
          </td>
          <td class="px-4 py-3 text-[#66706F]">{item.target}</td>
          <td class="px-4 py-3">
            <StatusChip status={item.status} text={item.statusText} />
          </td>
          <td class="px-4 py-3 font-mono text-[12px] text-[#172020]">{item.progress}</td>
          <td class="px-4 py-3 font-mono text-[12px] text-[#66706F]">{item.time}</td>
        </tr>
      {/each}
    </DataTable>
  </section>
</div>
