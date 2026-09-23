<script>
  let {
    id = '',
    label = '',
    required = false,
    error = '',
    hint = '',
    extraLabel = '',
    children
  } = $props();
</script>

<div class="flex flex-col gap-1.5 w-full">
  {#if label}
    <div class="flex items-center justify-between">
      <label for={id} class="text-[14px] font-medium text-[#172020] flex items-center gap-1">
        <span>{label}</span>
        {#if required}
          <span class="text-[#E37434] font-bold" aria-hidden="true">*</span>
        {/if}
      </label>
      {#if extraLabel}
        <span class="text-[11px] font-mono text-[#66706F]">{extraLabel}</span>
      {/if}
    </div>
  {/if}

  <div class="relative w-full">
    {@render children?.()}
  </div>

  {#if error}
    <p id="{id}-error" class="text-[12px] text-[#B42318] flex items-center gap-1 mt-0.5" role="alert">
      <span>{error}</span>
    </p>
  {:else if hint}
    <p id="{id}-hint" class="text-[12px] text-[#66706F] flex items-center gap-1 mt-0.5">
      <span>{hint}</span>
    </p>
  {/if}
</div>
