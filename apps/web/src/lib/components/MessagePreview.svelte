<script>
  let {
    header = '',
    body = '',
    footer = 'BPS Provinsi Sulawesi Tengah',
    buttons = [],
    time = '08:00 WITA',
    recipientName = 'Rekan Statistik'
  } = $props();

  function formatBodyWithHighlights(text) {
    if (!text) return '';
    // Replace {{1}}, {{2}} with highlighted pills
    return text.replace(/\{\{(\d+)\}\}/g, '<span class="bg-amber-200 text-[#793100] px-1.5 py-0.5 rounded font-mono text-[11px] font-bold">{{$1}}</span>');
  }
</script>

<div class="bg-[#172020] text-white rounded-2xl p-4 shadow-xl border border-gray-800 max-w-sm w-full font-sans">
  <!-- WhatsApp Chat Header -->
  <div class="flex items-center gap-3 border-b border-gray-700 pb-3 mb-3">
    <div class="w-9 h-9 rounded-full bg-[#007979] flex items-center justify-center font-bold text-xs text-white">
      BPS
    </div>
    <div class="flex flex-col min-w-0">
      <div class="flex items-center gap-1">
        <span class="text-xs font-bold truncate">BPS Sulteng Official</span>
        <span class="text-green-400 text-xs">✓</span>
      </div>
      <span class="text-[10px] text-gray-400">Akun Bisnis Resmi Terverifikasi</span>
    </div>
  </div>

  <!-- WhatsApp Chat Bubble -->
  <div class="bg-[#005c4b] text-white p-3.5 rounded-xl text-xs space-y-2.5 shadow relative">
    {#if header}
      <div class="font-bold text-[13px] text-emerald-200 pb-1 border-b border-emerald-600/40">
        {header}
      </div>
    {/if}

    <div class="text-emerald-50 whitespace-pre-wrap leading-relaxed text-[12px]">
      {@html formatBodyWithHighlights(body)}
    </div>

    {#if footer}
      <div class="text-[10px] text-emerald-300/80 pt-1 border-t border-emerald-700/50">
        {footer}
      </div>
    {/if}

    {#if buttons && buttons.length > 0}
      <div class="space-y-1.5 pt-1">
        {#each buttons as btn}
          <div class="py-1.5 px-3 bg-[#025143] rounded-lg text-center text-[11px] font-semibold text-blue-200 border border-emerald-600/30">
            {btn.text || btn}
          </div>
        {/each}
      </div>
    {/if}

    <div class="text-[9px] text-emerald-300/60 text-right pt-1 flex items-center justify-end gap-1">
      <span>{time}</span>
      <span>✓✓</span>
    </div>
  </div>
</div>
