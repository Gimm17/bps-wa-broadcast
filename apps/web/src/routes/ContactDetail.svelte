<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';

  let { params = {} } = $props();
  let contact = $state(null);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      if (params.id) {
        const data = await apiFetch(`/contacts/${params.id}`);
        contact = data.contact;
      }
    } catch (err) {
      console.error('Failed to load contact detail:', err);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="flex flex-col gap-6 max-w-4xl">
  <div class="flex items-center gap-3">
    <a href="#/contacts" class="text-[13px] font-medium text-[#007979] hover:underline">
      ← Kembali ke Direktori Kontak
    </a>
  </div>

  {#if isLoading}
    <div class="p-8 text-center text-[#66706F] font-mono text-[13px]">
      Memuat rincian kontak...
    </div>
  {:else if !contact}
    <div class="p-8 text-center text-[#B42318] text-[14px] bg-[#FEF3F2] rounded-xl border border-[#FECDCA]">
      Kontak tidak ditemukan atau telah dihapus.
    </div>
  {:else}
    <!-- Detail Card -->
    <div class="p-6 bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE2DF] pb-4">
        <div>
          <h1 class="text-[20px] font-bold text-[#172020]">{contact.name}</h1>
          <div class="text-[12px] text-[#66706F] mt-0.5">
            Dibuat pada: {new Date(contact.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <StatusChip status={contact.type === 'employee' ? 'info' : 'warning'} text={contact.type === 'employee' ? 'Pegawai ASN' : 'Masyarakat'} />
          <StatusChip status={contact.status === 'active' ? 'operational' : 'neutral'} text={contact.status} />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
        <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
          <span class="text-[11px] text-[#66706F] font-medium">Nomor WhatsApp E.164</span>
          <div class="font-mono text-[14px] font-bold text-[#172020] mt-0.5">{contact.phone_e164}</div>
        </div>

        {#if contact.type === 'employee'}
          <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
            <span class="text-[11px] text-[#66706F] font-medium">NIP BPS</span>
            <div class="font-mono text-[14px] text-[#172020] mt-0.5">{contact.nip || '-'}</div>
          </div>
          <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
            <span class="text-[11px] text-[#66706F] font-medium">Unit Kerja</span>
            <div class="text-[14px] text-[#172020] mt-0.5">{contact.unit_kerja || '-'}</div>
          </div>
          <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
            <span class="text-[11px] text-[#66706F] font-medium">Jabatan</span>
            <div class="text-[14px] text-[#172020] mt-0.5">{contact.jabatan || '-'}</div>
          </div>
        {:else}
          <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
            <span class="text-[11px] text-[#66706F] font-medium">Instansi / Lembaga</span>
            <div class="text-[14px] text-[#172020] mt-0.5">{contact.instansi || '-'}</div>
          </div>
          <div class="p-3 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF]">
            <span class="text-[11px] text-[#66706F] font-medium">Profesi</span>
            <div class="text-[14px] text-[#172020] mt-0.5">{contact.profesi || '-'}</div>
          </div>
        {/if}
      </div>

      <!-- Topics / Subscriptions -->
      <div class="pt-2 border-t border-[#DCE2DF]">
        <h3 class="text-[14px] font-semibold text-[#172020] mb-2">Langganan Topik Rilis BPS</h3>
        {#if contact.subscriptions && contact.subscriptions.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each contact.subscriptions as sub}
              <span class="px-2.5 py-1 rounded-full text-[12px] bg-[#ecf6f5] text-[#007979] border border-[#24B1B1]/30">
                {sub.topicTitle} ({sub.status})
              </span>
            {/each}
          </div>
        {:else}
          <p class="text-[12px] text-[#66706F]">Belum ada topik spesifik yang didaftarkan.</p>
        {/if}
      </div>
    </div>
  {/if}
</div>
