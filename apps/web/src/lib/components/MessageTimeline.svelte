<script>
  let { events = [] } = $props();

  function getStatusBadge(status) {
    switch (status) {
      case 'read': return { label: 'Dibaca', color: 'bg-[#24B1B1]/20 text-[#007979]', icon: '👁️' };
      case 'delivered': return { label: 'Terkirim (Delivered)', color: 'bg-[#007979]/15 text-[#007979]', icon: '✓✓' };
      case 'sent': return { label: 'Diterima Meta (Sent)', color: 'bg-blue-100 text-blue-700', icon: '✓' };
      case 'sending': return { label: 'Mengirim', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' };
      case 'queued': return { label: 'Dalam Antrean', color: 'bg-gray-100 text-gray-700', icon: '📥' };
      case 'failed': return { label: 'Gagal', color: 'bg-[#FEF3F2] text-[#B42318]', icon: '✕' };
      case 'cancelled': return { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-500', icon: '🚫' };
      case 'suppressed': return { label: 'Ditekan (Opt-Out)', color: 'bg-purple-100 text-purple-700', icon: '🛑' };
      default: return { label: status, color: 'bg-gray-100 text-gray-700', icon: '•' };
    }
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short'
    }) + ' WITA';
  }
</script>

<div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#DCE2DF]">
  {#if events.length === 0}
    <div class="text-[12px] text-[#66706F] italic">Belum ada peristiwa status tercatat.</div>
  {:else}
    {#each events as ev}
      {@const badge = getStatusBadge(ev.status)}
      <div class="relative flex flex-col gap-1 text-[13px]">
        <div class="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#007979] flex items-center justify-center text-[8px]">
          {badge.icon}
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold {badge.color}">
            {badge.label}
          </span>
          <span class="font-mono text-[11px] text-[#66706F]">
            {formatTime(ev.timestamp || ev.created_at)}
          </span>
        </div>
        {#if ev.raw_payload}
          <div class="mt-1 p-2 bg-[#f2fbfb] border border-[#DCE2DF] rounded text-[11px] font-mono text-[#66706F] overflow-x-auto">
            {typeof ev.raw_payload === 'string' ? ev.raw_payload : JSON.stringify(ev.raw_payload)}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>
