<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { apiFetch } from '../lib/api/client.js';
  import HealthStrip from '../lib/components/HealthStrip.svelte';

  // Svelte 5 State Runes
  let summary = $state({
    total: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    cancelled: 0,
    suppressed: 0
  });

  let trends = $state([]);
  let loading = $state(true);

  let deliveryRate = $derived.by(() => {
    const deliveredOrRead = summary.delivered + summary.read;
    const sentTotal = summary.sent + summary.delivered + summary.read + summary.failed;
    if (sentTotal === 0) return '100%';
    return `${Math.round((deliveredOrRead / sentTotal) * 100)}%`;
  });

  let readRate = $derived.by(() => {
    const deliveredOrRead = summary.delivered + summary.read;
    if (deliveredOrRead === 0) return '0%';
    return `${Math.round((summary.read / deliveredOrRead) * 100)}%`;
  });

  async function loadDashboard() {
    loading = true;
    try {
      const [sumRes, trRes] = await Promise.all([
        apiFetch('/api/dashboard/summary'),
        apiFetch('/api/dashboard/trends?days=14')
      ]);
      if (sumRes.data) summary = sumRes.data;
      if (trRes.data) trends = trRes.data;
    } catch {
      // Fallback
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadDashboard();
  });
</script>

<div class="flex flex-col gap-6">
  <!-- 1. Real-time Operational Health Strip -->
  <HealthStrip />

  <!-- 2. Primary Command Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#DCE2DF] shadow-sm">
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h1 class="text-[22px] font-bold text-[#172020] tracking-tight">Pusat Komando Siaran WhatsApp Resmi</h1>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#007979]/10 text-[#007979]">
          BPS Sulawesi Tengah
        </span>
      </div>
      <p class="text-[13px] text-[#66706F]">
        Monitoring terpadu siaran Meta Cloud API, otomasi presensi ASN, dan diseminasi publikasi statistik.
      </p>
    </div>
    <div class="flex items-center gap-2.5">
      <button
        onclick={() => push('/campaigns/new')}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E37434] hover:bg-[#c96227] text-white text-[13px] font-medium shadow-sm transition-all"
        type="button"
      >
        <span>➕</span>
        <span>Buat Siaran Baru</span>
      </button>
      <button
        onclick={() => push('/message-logs')}
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-[#ecf6f5] text-[#172020] text-[13px] font-medium border border-[#DCE2DF] transition-colors"
        type="button"
      >
        <span>📜</span>
        <span>Log Pesan</span>
      </button>
    </div>
  </div>

  <!-- 3. Key Telemetry Metrics Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Total Pesan Diproses</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">{summary.total}</span>
            <span class="text-[12px] text-[#007979] font-medium">{summary.sent + summary.delivered + summary.read} Terkirim</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#007979]/10 text-[#007979] flex items-center justify-center font-bold">
          📤
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#007979] font-medium">Delivery Rate: {deliveryRate}</span>
        <span class="font-mono">Target >95%</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Tingkat Keterbacaan (Read Rate)</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#24B1B1] font-bold font-mono">{readRate}</span>
            <span class="text-[12px] text-[#66706F]">{summary.read} Pesan</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#24B1B1]/10 text-[#007979] flex items-center justify-center">
          👁️
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#007979] font-medium">{summary.delivered} Sampai di Perangkat</span>
        <span class="font-mono">Meta Verified</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Antrean Siap Kirim (Backlog)</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#E37434] font-bold font-mono">{summary.queued + summary.sending}</span>
            <span class="text-[12px] text-[#E37434] font-medium">{summary.sending} Mengirim</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#FFF8EC] text-[#E37434] flex items-center justify-center">
          ⏳
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#FFF8EC] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#793100] font-medium">Batas Cron: 55s / mnt</span>
        <span class="font-mono">Skip Locked</span>
      </div>
    </div>

    <div class="bg-white rounded-xl p-4 shadow-sm border border-[#DCE2DF] flex flex-col justify-between">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <span class="text-[12px] text-[#66706F] block">Gagal & Ditekan (Opt-Out)</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[28px] text-[#172020] font-bold font-mono">{summary.failed + summary.suppressed}</span>
            <span class="text-[12px] text-[#B42318] font-medium">{summary.failed} Gagal</span>
          </div>
        </div>
        <div class="w-10 h-10 rounded-lg bg-[#FEF3F2] text-[#B42318] flex items-center justify-center">
          🛡️
        </div>
      </div>
      <div class="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-[#66706F] bg-[#ecf6f5] px-2.5 py-1.5 rounded-lg">
        <span class="text-[#007979] font-medium">{summary.suppressed} Ditekan (Consent Safe)</span>
        <span class="font-mono">UU PDP No 27</span>
      </div>
    </div>
  </div>

  <!-- 4. Asymmetric 8-Col + 4-Col Layout -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Column (8 cols): Trends & Distribution -->
    <div class="lg:col-span-8 flex flex-col gap-6">
      <!-- 14-Day Delivery Trend Chart -->
      <div class="bg-white p-5 rounded-xl border border-[#DCE2DF] shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <div class="flex items-center gap-2">
            <span>📈</span>
            <h2 class="text-[15px] font-bold text-[#172020]">Tren Pengiriman 14 Hari Terakhir (WITA)</h2>
          </div>
          <span class="font-mono text-[11px] text-[#66706F]">Harian</span>
        </div>

        <div class="h-44 flex items-end gap-2 pt-4 px-2">
          {#if trends.length === 0}
            <div class="w-full h-full flex items-center justify-center text-[#66706F] text-[13px]">
              Belum ada data riwayat pengiriman 14 hari terakhir.
            </div>
          {:else}
            {#each trends as t}
              {@const heightPercent = Math.min(100, Math.max(15, (t.total / Math.max(1, ...trends.map(x => x.total))) * 100))}
              <div class="flex-1 flex flex-col items-center gap-1.5 group relative">
                <div class="w-full bg-[#ecf6f5] rounded-t group-hover:bg-[#007979]/20 transition-all flex flex-col justify-end overflow-hidden" style="height: {heightPercent}%;">
                  <div class="w-full bg-[#007979] rounded-t transition-all" style="height: {(t.sent / Math.max(1, t.total)) * 100}%;"></div>
                </div>
                <span class="text-[10px] font-mono text-[#66706F] truncate max-w-[36px]">
                  {t.date ? t.date.slice(5) : ''}
                </span>
                <!-- Tooltip -->
                <div class="absolute -top-10 hidden group-hover:block bg-[#172020] text-white text-[10px] py-1 px-2 rounded shadow font-mono z-10 whitespace-nowrap">
                  {t.date}: {t.total} pesan ({t.sent} sukses)
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Queue Funnel Distribution -->
      <div class="bg-white p-5 rounded-xl border border-[#DCE2DF] shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <h2 class="text-[15px] font-bold text-[#172020]">Distribusi Status Pesan</h2>
          <span class="font-mono text-[11px] text-[#007979]">{summary.total} Total</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
          <div class="p-3 bg-[#f2fbfb] rounded-lg border border-[#DCE2DF]">
            <span class="text-[#66706F] text-[11px] block">Dalam Antrean</span>
            <span class="font-mono font-bold text-[18px] text-[#172020]">{summary.queued}</span>
          </div>
          <div class="p-3 bg-[#FFF8EC] rounded-lg border border-[#FFE2AF]">
            <span class="text-[#793100] text-[11px] block">Sedang Mengirim</span>
            <span class="font-mono font-bold text-[18px] text-[#E37434]">{summary.sending}</span>
          </div>
          <div class="p-3 bg-[#ecf6f5] rounded-lg border border-[#DCE2DF]">
            <span class="text-[#007979] text-[11px] block">Terkirim / Dibaca</span>
            <span class="font-mono font-bold text-[18px] text-[#007979]">{summary.delivered + summary.read}</span>
          </div>
          <div class="p-3 bg-[#FEF3F2] rounded-lg border border-[#B42318]/20">
            <span class="text-[#B42318] text-[11px] block">Gagal Kirim</span>
            <span class="font-mono font-bold text-[18px] text-[#B42318]">{summary.failed}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column (4 cols): Quick Schedules & Quick Actions -->
    <div class="lg:col-span-4 flex flex-col gap-5">
      <!-- Jadwal Siaran Hari Ini (WITA) -->
      <div class="bg-white p-5 rounded-xl border border-[#DCE2DF] shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <div class="flex items-center gap-2">
            <span>⏰</span>
            <h2 class="text-[15px] font-bold text-[#172020]">Jadwal Rutin Hari Kerja</h2>
          </div>
          <button onclick={() => push('/schedules')} class="text-[11px] font-medium text-[#007979] hover:underline" type="button">
            Kalender →
          </button>
        </div>

        <div class="space-y-3">
          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[12px] font-semibold text-[#172020]">Presensi Masuk ASN</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-[#007979]/10 text-[#007979]">07:15 WITA</span>
            </div>
            <p class="text-[11px] text-[#66706F]">Target 84 ASN BPS Sulteng yang belum check-in.</p>
          </div>

          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[12px] font-semibold text-[#172020]">Rilis Resmi BRS</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E37434] text-white">09:00 WITA</span>
            </div>
            <p class="text-[11px] text-[#66706F]">Diseminasi indikator inflasi dan ekonomi makro.</p>
          </div>

          <div class="p-3 bg-[#ecf6f5] rounded-lg space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[12px] font-semibold text-[#172020]">Presensi Pulang ASN</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-[#007979]/10 text-[#007979]">15:45 WITA</span>
            </div>
            <p class="text-[11px] text-[#66706F]">Pengingat absensi sore bagi seluruh pegawai.</p>
          </div>
        </div>
      </div>

      <!-- Informasi Regulasi & Sistem -->
      <div class="bg-white p-5 rounded-xl border border-[#DCE2DF] shadow-sm space-y-3">
        <h3 class="text-[14px] font-bold text-[#172020] flex items-center gap-2">
          <span>🛡️</span>
          <span>Kepatuhan Regulasi & Kebijakan</span>
        </h3>
        <ul class="text-[12px] text-[#66706F] space-y-2 list-disc pl-4">
          <li><strong>UU PDP No. 27/2022:</strong> Penomoran WhatsApp disamarkan untuk pengguna tingkat viewer.</li>
          <li><strong>SKB 3 Menteri 2026:</strong> Siaran ASN otomatis dibatalkan pada tanggal merah dan cuti bersama.</li>
          <li><strong>Idempotency Lock:</strong> Mencegah pesan ganda akibat eksekusi cron berulang.</li>
        </ul>
      </div>
    </div>
  </div>
</div>
