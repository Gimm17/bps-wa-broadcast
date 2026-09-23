<script>
  let {
    columns = [],
    caption = '',
    emptyMessage = 'Tidak ada data yang ditemukan',
    isEmpty = false,
    children
  } = $props();
</script>

<div class="w-full bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] overflow-hidden shadow-sm">
  {#if caption}
    <div class="px-4 py-3 border-b border-[#DCE2DF] bg-[#F7F7F3] flex items-center justify-between">
      <h3 class="text-[14px] font-semibold text-[#172020]">{caption}</h3>
    </div>
  {/if}

  <div class="w-full overflow-x-auto">
    <table class="w-full border-collapse text-left text-[13px] text-[#172020]">
      <thead>
        <tr class="bg-[#F7F7F3] border-b border-[#DCE2DF] text-[11px] font-semibold uppercase tracking-wider text-[#66706F]">
          {#each columns as col}
            <th scope="col" class="px-4 py-3 {col.class || ''}">
              {col.label}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody class="divide-y divide-[#DCE2DF]">
        {#if isEmpty}
          <tr>
            <td colspan={columns.length} class="px-4 py-8 text-center text-[#66706F]">
              <p>{emptyMessage}</p>
            </td>
          </tr>
        {:else}
          {@render children?.()}
        {/if}
      </tbody>
    </table>
  </div>
</div>
