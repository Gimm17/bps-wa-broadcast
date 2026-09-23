<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';
  import DataTable from '../lib/components/DataTable.svelte';

  let { params = {} } = $props();
  let jobData = $state(null);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      if (params.id) {
        const data = await apiFetch(`/imports/contacts/${params.id}`);
        jobData = data;
      }
    } catch (err) {
      console.error('Failed to load import job:', err);
    } finally {
      isLoading = false;
    }
  });

  const columns = [
    { label: 'Baris' },
    { label: 'Nama' },
    { label: 'Nomor WhatsApp' },
    { label: 'Status Validasi' },
    { label: 'Catatan / Kesalahan' }
  ];
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <a href="#/contacts" class="text-[13px] font-medium text-[#007979] hover:underline">
      ← Kembali ke Direktori Kontak
    </a>
  </div>

  {#if isLoading}
    <div class="p-8 text-center text-[#66706F] font-mono text-[13px]">
      Memuat tinjauan impor...
    </div>
  {:else if !jobData}
    <div class="p-8 text-center text-[#B42318] bg-[#FEF3F2] rounded-xl border border-[#FECDCA]">
      Laporan impor tidak ditemukan.
    </div>
  {:else}
    <!-- Summary Header -->
    <div class="p-6 bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-[20px] font-bold text-[#172020]">Laporan Validasi Impor Kontak</h1>
          <p class="text-[13px] text-[#66706F] font-mono mt-0.5">
            File: {jobData.job.filename} (Checksum: {jobData.job.file_checksum?.slice(0, 12)}...)
          </p>
        </div>
        <StatusChip
          status={jobData.job.status === 'applied' ? 'operational' : 'warning'}
          text={jobData.job.status === 'applied' ? 'Diterapkan' : 'Siap Diterapkan'}
        />
      </div>

      <!-- Stats row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#DCE2DF]">
        <div class="p-3 bg-[#F7F7F3] rounded-lg">
          <span class="text-[11px] text-[#66706F]">Total Baris</span>
          <div class="text-[20px] font-bold font-mono text-[#172020]">{jobData.job.total_rows}</div>
        </div>
        <div class="p-3 bg-[#ecfdf3] rounded-lg border border-[#027a48]/20">
          <span class="text-[11px] text-[#027a48]">Diterima (Sah E.164)</span>
          <div class="text-[20px] font-bold font-mono text-[#027a48]">{jobData.job.accepted_rows}</div>
        </div>
        <div class="p-3 bg-[#fffaeb] rounded-lg border border-[#b54708]/20">
          <span class="text-[11px] text-[#b54708]">Peringatan</span>
          <div class="text-[20px] font-bold font-mono text-[#b54708]">{jobData.job.warning_rows}</div>
        </div>
        <div class="p-3 bg-[#fef3f2] rounded-lg border border-[#b42318]/20">
          <span class="text-[11px] text-[#b42318]">Ditolak (Format Salah)</span>
          <div class="text-[20px] font-bold font-mono text-[#b42318]">{jobData.job.rejected_rows}</div>
        </div>
      </div>
    </div>

    <!-- Rows review table -->
    <DataTable columns={columns} caption="Detail Baris Impor">
      {#each jobData.rows as r}
        <tr class="hover:bg-[#F7F7F3] transition-colors {r.validation_status === 'rejected' ? 'bg-[#FEF3F2]/50' : ''}">
          <td class="px-4 py-2.5 font-mono text-[12px]">{r.row_number}</td>
          <td class="px-4 py-2.5 font-medium">{r.parsed_data?.name || '-'}</td>
          <td class="px-4 py-2.5 font-mono text-[12px]">{r.parsed_data?.phoneE164 || r.raw_data?.['Nomor WhatsApp'] || '-'}</td>
          <td class="px-4 py-2.5">
            <StatusChip
              status={r.validation_status === 'valid' ? 'operational' : 'error'}
              text={r.validation_status === 'valid' ? 'Valid' : 'Ditolak'}
            />
          </td>
          <td class="px-4 py-2.5 text-[12px] text-[#B42318]">
            {Array.isArray(r.errors) ? r.errors.join(', ') : ''}
          </td>
        </tr>
      {/each}
    </DataTable>
  {/if}
</div>
