<script>
  let {
    status = 'info', // 'success' | 'warning' | 'error' | 'info' | 'neutral'
    text = '',
    pulse = false
  } = $props();

  const variantClasses = {
    success: 'bg-[rgba(36,177,177,0.15)] text-[#007979] border-[rgba(36,177,177,0.3)]',
    operational: 'bg-[rgba(36,177,177,0.15)] text-[#007979] border-[rgba(36,177,177,0.3)]',
    warning: 'bg-[#FFF8EC] text-[#E37434] border-[#FFE2AF]',
    error: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
    neutral: 'bg-[#F7F7F3] text-[#66706F] border-[#DCE2DF]',
    info: 'bg-[#F2FBFB] text-[#007979] border-[#DCE2DF]'
  };

  const dotClasses = {
    success: 'bg-[#24B1B1]',
    operational: 'bg-[#24B1B1]',
    warning: 'bg-[#E37434]',
    error: 'bg-[#B42318]',
    neutral: 'bg-[#66706F]',
    info: 'bg-[#24B1B1]'
  };
</script>

<span
  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border {variantClasses[status] || variantClasses.info}"
  style="font-family: var(--font-ui);"
>
  <span class="relative flex h-2 w-2">
    {#if pulse}
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {dotClasses[status] || dotClasses.info}"></span>
    {/if}
    <span class="relative inline-flex rounded-full h-2 w-2 {dotClasses[status] || dotClasses.info}"></span>
  </span>
  <span>{text}</span>
</span>
