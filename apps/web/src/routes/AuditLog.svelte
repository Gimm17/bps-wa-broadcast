<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';

  let logs = $state([]);
  let loading = $state(true);
  let error = $state(null);

  async function loadLogs() {
    loading = true;
    error = null;
    try {
      const res = await apiFetch('/api/audit-logs');
      logs = res.data || [];
    } catch (err) {
      error = err.message || 'Gagal memuat jejak audit';
    } finally {
      loading = false;
    }
  }

  function formatTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WITA';
  }

  onMount(() => {
    loadLogs();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF]">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-[#007979]/10 text-[#007979] text-[12px] font-semibold">Infrastruktur & Tata Kelola</span>
        <span class="px-2 py-0.5 rounded bg-[#ecf6f5] text-[#007979] text-[12px] font-mono">Immutable Audit Trail</span>
      </div>
      <h1 class="text-[26px] font-bold text-[#172020] tracking-tight">Jejak Audit & Aktivitas Sistem</h1>
      <p class="text-[14px] text-[#66706F] leading-relaxed">
        Pencatatan lengkap mutasi konfigurasi, eksekusi campaign, perubahan izin pengguna, dan ekspor data sesuai standar keamanan informasi BPS.
      </p>
    </div>
    <div>
      <button
        onclick={loadLogs}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007979] hover:bg-[#006a6a] text-white text-[13px] font-medium shadow-sm transition-all"
        type="button"
      >
        <span>🔄</span>
        <span>Segarkan Log</span>
      </button>
    </div>
  </div>

  <!-- Audit Table -->
  <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden flex flex-col">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-[#f2fbfb] border-b border-[#DCE2DF] text-[#66706F] text-[11px] uppercase tracking-wider font-semibold">
            <th class="py-3 px-4 w-[190px]">Waktu (WITA)</th>
            <th class="py-3 px-4 w-[180px]">Pengguna</th>
            <th class="py-3 px-4 w-[180px]">Tindakan / Aksi</th>
            <th class="py-3 px-4 w-[160px]">Sumber Daya</th>
            <th class="py-3 px-4 w-[130px]">IP Address</th>
            <th class="py-3 px-4">Rincian Perubahan</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#DCE2DF] text-[13px] text-[#172020]">
          {#if loading}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Memuat catatan audit...</td>
            </tr>
          {:else if logs.length === 0}
            <tr>
              <td colspan="6" class="py-8 text-center text-[#66706F]">Belum ada aktivitas audit tercatat.</td>
            </tr>
          {:else}
            {#each logs as log}
              <tr class="hover:bg-[#ecf6f5]/40 transition-colors">
                <td class="py-3.5 px-4 font-mono text-[12px] text-[#66706F]">
                  {formatTime(log.created_at)}
                </td>
                <td class="py-3.5 px-4">
                  <span class="font-medium text-[#172020] block">{log.user_email || 'Sistem / Anonim'}</span>
                  <span class="font-mono text-[10px] text-[#66706F]">{log.user_id ? log.user_id.slice(0, 8) : 'internal'}</span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#007979]/10 text-[#007979]">
                    {log.action}
                  </span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="text-[12px] text-[#172020] block font-medium">{log.resource_type}</span>
                  {#if log.resource_id}
                    <span class="font-mono text-[10px] text-[#66706F]">{log.resource_id}</span>
                  {/if}
                </td>
                <td class="py-3.5 px-4 font-mono text-[12px] text-[#66706F]">
                  {log.ip_address || '—'}
                </td>
                <td class="py-3.5 px-4 font-mono text-[11px] text-[#66706F]">
                  <div class="max-w-md truncate" title={JSON.stringify(log.details)}>
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
