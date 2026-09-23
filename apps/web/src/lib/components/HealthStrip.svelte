<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../api/client.js';

  let health = $state({
    cronStatus: 'active',
    wabaStatus: 'connected',
    activeAlertsCount: 0,
    oldestQueueAgeSeconds: 0
  });

  async function loadHealth() {
    try {
      const res = await apiFetch('/api/dashboard/health');
      if (res.data) health = res.data;
    } catch {
      // Fallback
    }
  }

  onMount(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // 30s poll
    return () => clearInterval(interval);
  });
</script>

<div class="bg-white rounded-xl p-3 shadow-sm border border-[#DCE2DF] flex flex-wrap items-center justify-between gap-3 text-[12px]">
  <div class="flex items-center gap-4 flex-wrap">
    <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#ecf6f5] border border-[#DCE2DF]">
      <span class="w-2 h-2 rounded-full {health.wabaStatus === 'connected' ? 'bg-[#24B1B1] animate-pulse' : 'bg-[#E37434]'}"></span>
      <span class="font-medium text-[#172020]">Meta WABA:</span>
      <span class="font-semibold text-[#007979]">{health.wabaStatus === 'connected' ? 'Terhubung' : 'Standby'}</span>
    </div>

    <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#ecf6f5] border border-[#DCE2DF]">
      <span class="w-2 h-2 rounded-full {health.cronStatus === 'active' ? 'bg-[#24B1B1]' : 'bg-[#B42318]'}"></span>
      <span class="font-medium text-[#172020]">Cron Worker:</span>
      <span class="font-semibold text-[#007979]">{health.cronStatus === 'active' ? 'Aktif (1 mnt)' : (health.cronStatus === 'delayed' ? 'Tertunda' : 'Standby')}</span>
    </div>

    <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#ecf6f5] border border-[#DCE2DF]">
      <span class="w-2 h-2 rounded-full bg-[#24B1B1]"></span>
      <span class="font-medium text-[#172020]">SIMPEG Presensi:</span>
      <span class="font-semibold text-[#007979]">Sinkron</span>
    </div>

    <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#ecf6f5] border border-[#DCE2DF]">
      <span class="w-2 h-2 rounded-full bg-[#24B1B1]"></span>
      <span class="font-medium text-[#172020]">Silastik PST:</span>
      <span class="font-semibold text-[#007979]">Siap</span>
    </div>
  </div>

  <div class="flex items-center gap-3">
    {#if health.activeAlertsCount > 0}
      <span class="px-2.5 py-1 rounded-lg bg-[#FEF3F2] text-[#B42318] font-bold text-[11px] border border-[#B42318]/30 flex items-center gap-1.5 animate-pulse">
        <span>⚠️</span>
        <span>{health.activeAlertsCount} Peringatan Sistem</span>
      </span>
    {:else}
      <span class="px-2.5 py-1 rounded-lg bg-[#ecf6f5] text-[#007979] font-medium text-[11px]">
        ✓ Semua Sistem Normal
      </span>
    {/if}
    <span class="font-mono text-[#66706F] text-[11px]">WITA (UTC+8)</span>
  </div>
</div>
