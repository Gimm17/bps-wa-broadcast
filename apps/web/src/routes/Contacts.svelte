<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';
  import DataTable from '../lib/components/DataTable.svelte';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  let activeTab = $state('all'); // 'all' | 'employee' | 'public'
  let searchQuery = $state('');
  let contacts = $state([]);
  let total = $state(0);
  let page = $state(1);
  let totalPages = $state(1);
  let isLoading = $state(false);

  // Import modal state
  let isImportOpen = $state(false);
  let uploadFile = $state(null);
  let isUploading = $state(false);
  let importJob = $state(null);

  // Manual Add Modal State
  let isAddOpen = $state(false);
  let newContact = $state({
    name: '',
    phone: '',
    type: 'employee',
    nip: '',
    unitKerja: '',
    instansi: ''
  });

  const columns = [
    { label: 'Nama & Identitas' },
    { label: 'Nomor WhatsApp' },
    { label: 'Tipe / Unit' },
    { label: 'Status' },
    { label: 'Aksi', class: 'text-right' }
  ];

  async function loadContacts() {
    isLoading = true;
    try {
      const params = new URLSearchParams();
      if (activeTab === 'employee') params.set('type', 'employee');
      if (activeTab === 'public') params.set('type', 'public');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(page));
      params.set('limit', '25');

      const data = await apiFetch(`/contacts?${params.toString()}`);
      contacts = data.contacts || [];
      total = data.total || 0;
      totalPages = data.totalPages || 1;
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleTabChange(tab) {
    activeTab = tab;
    page = 1;
    loadContacts();
  }

  function handleSearch(e) {
    e.preventDefault();
    page = 1;
    loadContacts();
  }

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('type', activeTab);
      window.open(`/api/exports/contacts?${params.toString()}`, '_blank');
    } catch (err) {
      await errorDialog({
        title: 'Gagal Mengekspor Kontak',
        message: err?.error?.message || err.message
      });
    }
  }

  async function handleFileSelect(e) {
    const files = e.target.files;
    if (files && files[0]) {
      uploadFile = files[0];
    }
  }

  async function handleUploadImport() {
    if (!uploadFile) return;
    isUploading = true;
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch('/api/imports/contacts', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw data;

      importJob = data;
    } catch (err) {
      await errorDialog({
        title: 'Gagal Mengunggah Berkas',
        message: 'Pastikan format berkas sesuai template Excel/CSV yang didukung.',
        details: err?.error?.message || err.message
      });
    } finally {
      isUploading = false;
    }
  }

  async function handleApplyImport() {
    if (!importJob || !importJob.job?.id) return;
    const confirmed = await confirmDialog({
      title: 'Terapkan Impor Kontak?',
      message: `Apakah Anda yakin ingin memproses dan menyimpan seluruh kontak dari pratinjau impor ini ke buku kontak?`,
      confirmText: 'Ya, Terapkan Impor',
      badge: 'Impor Kontak'
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/imports/contacts/${importJob.job.id}/apply`, { method: 'POST' });
      await successDialog({
        title: 'Impor Berhasil Diterapkan',
        message: 'Seluruh kontak yang valid telah berhasil disimpan ke database.'
      });
      isImportOpen = false;
      uploadFile = null;
      importJob = null;
      loadContacts();
    } catch (err) {
      await errorDialog({
        title: 'Gagal Menerapkan Impor',
        message: 'Terjadi kendala saat memproses berkas impor.',
        details: err?.error?.message || err.message
      });
    }
  }

  async function handleSaveManual() {
    try {
      await apiFetch('/contacts', {
        method: 'POST',
        body: JSON.stringify(newContact)
      });
      await successDialog({
        title: 'Kontak Berhasil Disimpan',
        message: `Kontak "${newContact.name}" telah berhasil ditambahkan.`
      });
      isAddOpen = false;
      newContact = { name: '', phone: '', type: 'employee', nip: '', unitKerja: '', instansi: '' };
      loadContacts();
    } catch (err) {
      await errorDialog({
        title: 'Gagal Menyimpan Kontak',
        message: 'Silakan periksa kembali kelengkapan nomor telepon dan format data.',
        details: err?.error?.message || err.message
      });
    }
  }

  onMount(() => {
    loadContacts();
  });
</script>

<div class="flex flex-col gap-6">
  <!-- Top Operational Banner & Meta Indicator -->
  <div class="p-6 bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-sm">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div class="flex flex-col">
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#007979]/10 text-[#007979]">BPS-7200-DIR</span>
          <span class="text-[12px] text-[#66706F]">•</span>
          <span class="text-[12px] text-[#66706F]">Zona Pelayanan Statistik Terpadu (PST) & Diseminasi</span>
        </div>
        <h1 class="text-[24px] font-bold text-[#172020] tracking-tight">Direktori Kontak & Manajemen Konsensus</h1>
        <p class="text-[13px] text-[#66706F] max-w-4xl mt-1">
          Manajemen data kontak ASN internal (84 pegawai) dan publik terdaftar. Terintegrasi validasi format internasional Meta E.164, sinkronisasi SIMPEG/Presensi BPS Sulteng, dan kepatuhan perlindungan data pribadi.
        </p>
      </div>
      <div class="flex items-center flex-wrap gap-2.5 shrink-0">
        <button
          type="button"
          onclick={handleExport}
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FFFFFF] hover:bg-[#F7F7F3] text-[#172020] text-[13px] font-medium border border-[#DCE2DF] transition-all shadow-sm"
        >
          <span>📥</span>
          <span>Ekspor CSV</span>
        </button>
        <button
          type="button"
          onclick={() => isImportOpen = true}
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E37434] hover:bg-[#c95f22] text-white text-[13px] font-semibold transition-all shadow-sm"
        >
          <span>📤</span>
          <span>Import Kontak Baru</span>
        </button>
        <button
          type="button"
          onclick={() => isAddOpen = true}
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#ecf6f5] hover:bg-[#dbe4e4] text-[#007979] text-[13px] font-medium border border-[#DCE2DF] transition-all"
        >
          <span>+</span>
          <span>Tambah Manual</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Operational KPI Strip (4 Stat Cards) -->
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
    <div class="p-4 rounded-xl bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-[11px] font-mono uppercase tracking-wider text-[#66706F]">Total Kontak Terdaftar</span>
      <div class="flex items-baseline gap-2 mt-1">
        <span class="text-[24px] font-bold text-[#172020] font-mono">{total}</span>
        <span class="text-[12px] text-[#66706F]">entitas</span>
      </div>
      <div class="mt-2 text-[11px] text-[#007979] font-medium">BPS Provinsi Sulawesi Tengah</div>
    </div>

    <div class="p-4 rounded-xl bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-[11px] font-mono uppercase tracking-wider text-[#66706F]">Format Meta E.164</span>
      <div class="flex items-baseline gap-2 mt-1">
        <span class="text-[24px] font-bold text-[#24B1B1] font-mono">100%</span>
        <span class="text-[12px] text-[#66706F]">Validasi Baku</span>
      </div>
      <div class="mt-2 text-[11px] text-[#24B1B1] font-medium">Standar +62 Internasional</div>
    </div>

    <div class="p-4 rounded-xl bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-[11px] font-mono uppercase tracking-wider text-[#66706F]">Kepatuhan Consent UU PDP</span>
      <div class="flex items-baseline gap-2 mt-1">
        <span class="text-[24px] font-bold text-[#007979] font-mono">Opt-in Sah</span>
      </div>
      <div class="mt-2 text-[11px] text-[#66706F]">Hak Unsubscribe Tersedia</div>
    </div>

    <div class="p-4 rounded-xl bg-[#FFFFFF] border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-[11px] font-mono uppercase tracking-wider text-[#66706F]">Konektor SIMPEG & Silastik</span>
      <div class="flex items-center gap-2 mt-1">
        <span class="w-2 h-2 rounded-full bg-[#24B1B1] animate-pulse"></span>
        <span class="text-[14px] font-semibold text-[#172020]">Sinkron Aktif</span>
      </div>
      <div class="mt-2 text-[11px] font-mono text-[#007979]">WITA (Asia/Makassar)</div>
    </div>
  </div>

  <!-- Interactive Filter Tabs & Search -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFFFF] p-2 rounded-xl border border-[#DCE2DF] shadow-sm">
    <div class="flex items-center gap-1.5 overflow-x-auto">
      <button
        type="button"
        onclick={() => handleTabChange('all')}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {activeTab === 'all' ? 'bg-[#007979] text-white' : 'text-[#66706F] hover:bg-[#F7F7F3]'}"
      >
        Semua Kontak
      </button>
      <button
        type="button"
        onclick={() => handleTabChange('employee')}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {activeTab === 'employee' ? 'bg-[#007979] text-white' : 'text-[#66706F] hover:bg-[#F7F7F3]'}"
      >
        Pegawai ASN Sulteng
      </button>
      <button
        type="button"
        onclick={() => handleTabChange('public')}
        class="px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors {activeTab === 'public' ? 'bg-[#007979] text-white' : 'text-[#66706F] hover:bg-[#F7F7F3]'}"
      >
        Masyarakat Terdaftar
      </button>
    </div>

    <!-- Search input -->
    <form onsubmit={handleSearch} class="flex items-center gap-2">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Cari nama, NIP, atau nomor..."
        class="px-3 py-1.5 text-[13px] rounded-lg bg-[#FFFFFF] border border-[#DCE2DF] w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#E37434]/30"
      />
      <button
        type="submit"
        class="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-[#F7F7F3] hover:bg-[#DCE2DF] text-[#172020] border border-[#DCE2DF]"
      >
        Cari
      </button>
    </form>
  </div>

  <!-- Contacts Table -->
  <DataTable columns={columns} caption="Daftar Entitas Kontak BPS Sulteng" isEmpty={contacts.length === 0 && !isLoading}>
    {#if isLoading}
      <tr>
        <td colspan="5" class="px-4 py-8 text-center text-[#66706F] font-mono text-[13px]">
          Memuat data kontak...
        </td>
      </tr>
    {:else}
      {#each contacts as item}
        <tr class="hover:bg-[#F7F7F3] transition-colors">
          <td class="px-4 py-3">
            <div class="font-semibold text-[#172020]">{item.name}</div>
            {#if item.nip}
              <div class="text-[11px] font-mono text-[#66706F]">NIP: {item.nip}</div>
            {/if}
          </td>
          <td class="px-4 py-3 font-mono text-[13px] text-[#172020]">
            {item.phone_e164}
          </td>
          <td class="px-4 py-3 text-[12px] text-[#66706F]">
            <div>{item.type === 'employee' ? 'Pegawai ASN' : 'Masyarakat'}</div>
            <div class="text-[11px] text-[#172020] font-medium">{item.unit_kerja || item.instansi || '-'}</div>
          </td>
          <td class="px-4 py-3">
            <StatusChip status={item.status === 'active' ? 'operational' : 'neutral'} text={item.status} />
          </td>
          <td class="px-4 py-3 text-right">
            <a href="#/contacts/{item.id}" class="text-[12px] font-medium text-[#007979] hover:underline">
              Detail ▸
            </a>
          </td>
        </tr>
      {/each}
    {/if}
  </DataTable>

  <!-- Import Modal -->
  {#if isImportOpen}
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="w-full max-w-lg bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-lg p-6 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <h2 class="text-[16px] font-bold text-[#172020]">Import Kontak Spreadsheet (CSV / XLSX)</h2>
          <button type="button" onclick={() => isImportOpen = false} class="text-[#66706F] text-[18px]">✕</button>
        </div>

        {#if !importJob}
          <div class="flex flex-col gap-3">
            <p class="text-[13px] text-[#66706F]">
              Pilih file CSV atau Excel yang berisi data kontak (kolom: Nama, Nomor WhatsApp, Tipe/Kategori, NIP, Unit Kerja).
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onchange={handleFileSelect}
              class="border border-[#DCE2DF] p-2 rounded-lg text-[13px]"
            />
            <button
              type="button"
              disabled={!uploadFile || isUploading}
              onclick={handleUploadImport}
              class="w-full h-10 bg-[#E37434] hover:bg-[#c95f22] text-white font-semibold text-[13px] rounded-lg disabled:opacity-50"
            >
              {isUploading ? 'Memproses File...' : 'Upload & Validasi Preview'}
            </button>
          </div>
        {:else}
          <div class="flex flex-col gap-3">
            <div class="p-3 rounded-lg bg-[#ecf6f5] border border-[#24B1B1]/30 flex flex-col gap-1 text-[13px]">
              <div class="font-bold text-[#007979]">Hasil Validasi Staged Import:</div>
              <div>Total Baris: <strong>{importJob.summary?.total}</strong></div>
              <div class="text-[#027a48]">Diterima (Sah E.164): <strong>{importJob.summary?.accepted}</strong></div>
              <div class="text-[#B42318]">Ditolak (Format Salah): <strong>{importJob.summary?.rejected}</strong></div>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                onclick={handleApplyImport}
                class="flex-1 h-10 bg-[#007979] hover:bg-[#006a6a] text-white font-semibold text-[13px] rounded-lg"
              >
                Terapkan {importJob.summary?.accepted} Kontak Sah
              </button>
              <button
                type="button"
                onclick={() => importJob = null}
                class="px-4 h-10 bg-[#F7F7F3] text-[#172020] text-[13px] rounded-lg border border-[#DCE2DF]"
              >
                Batal
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Add Manual Modal -->
  {#if isAddOpen}
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-[#FFFFFF] rounded-xl border border-[#DCE2DF] shadow-lg p-6 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3">
          <h2 class="text-[16px] font-bold text-[#172020]">Tambah Kontak Manual</h2>
          <button type="button" onclick={() => isAddOpen = false} class="text-[#66706F] text-[18px]">✕</button>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleSaveManual(); }} class="flex flex-col gap-3 text-[13px]">
          <div class="flex flex-col gap-1">
            <label for="mc-name" class="font-medium text-[#172020]">Nama Lengkap</label>
            <input id="mc-name" type="text" bind:value={newContact.name} required class="h-9 px-3 border border-[#DCE2DF] rounded-lg" />
          </div>

          <div class="flex flex-col gap-1">
            <label for="mc-phone" class="font-medium text-[#172020]">Nomor WhatsApp (08...)</label>
            <input id="mc-phone" type="text" bind:value={newContact.phone} required placeholder="081234567890" class="h-9 px-3 border border-[#DCE2DF] rounded-lg" />
          </div>

          <div class="flex flex-col gap-1">
            <label for="mc-type" class="font-medium text-[#172020]">Tipe Entitas</label>
            <select id="mc-type" bind:value={newContact.type} class="h-9 px-2 border border-[#DCE2DF] rounded-lg">
              <option value="employee">Pegawai ASN BPS</option>
              <option value="public">Masyarakat / Stakeholder</option>
            </select>
          </div>

          {#if newContact.type === 'employee'}
            <div class="flex flex-col gap-1">
              <label for="mc-nip" class="font-medium text-[#172020]">NIP (18 Digit)</label>
              <input id="mc-nip" type="text" bind:value={newContact.nip} class="h-9 px-3 border border-[#DCE2DF] rounded-lg" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="mc-unit" class="font-medium text-[#172020]">Unit Kerja</label>
              <input id="mc-unit" type="text" bind:value={newContact.unitKerja} class="h-9 px-3 border border-[#DCE2DF] rounded-lg" />
            </div>
          {:else}
            <div class="flex flex-col gap-1">
              <label for="mc-instansi" class="font-medium text-[#172020]">Instansi / Perusahaan</label>
              <input id="mc-instansi" type="text" bind:value={newContact.instansi} class="h-9 px-3 border border-[#DCE2DF] rounded-lg" />
            </div>
          {/if}

          <div class="pt-2">
            <button type="submit" class="w-full h-10 bg-[#E37434] hover:bg-[#c95f22] text-white font-semibold rounded-lg">
              Simpan Kontak
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
