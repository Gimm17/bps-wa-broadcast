<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api/client.js';
  import StatusChip from '../lib/components/StatusChip.svelte';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  let templates = $state([]);
  let isLoading = $state(true);
  let isSyncing = $state(false);
  let searchQuery = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state('');
  let errorMsg = $state('');
  let successMsg = $state('');

  // Selected template for preview
  let selectedTemplate = $state(null);

  // Form Modal state (Create / Edit)
  let isFormModalOpen = $state(false);
  let isSaving = $state(false);
  let formError = $state('');
  let templateForm = $state({
    id: null,
    name: '',
    category: 'UTILITY',
    language: 'id',
    header: '',
    body: '',
    footer: '',
    status: 'APPROVED'
  });

  // Delete confirmation state
  let deleteTarget = $state(null);
  let isDeleting = $state(false);

  // Sample variable values for live preview
  let sampleVars = $state({
    '1': 'Bpk. Ahmad Fauzi',
    '2': '24 September 2026',
    '3': 'https://sulteng.bps.go.id/publikasi',
    '4': 'Statistik Ketenagakerjaan Sulteng'
  });

  onMount(async () => {
    await loadTemplates();
  });

  async function loadTemplates() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await api.get('/api/templates', {
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter
      });
      templates = res?.templates || [];
    } catch (err) {
      errorMsg = err?.error?.message || err?.message || 'Gagal memuat template dari database';
    } finally {
      isLoading = false;
    }
  }

  async function handleSync() {
    isSyncing = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await api.post('/api/templates/sync');
      successMsg = res.message || 'Sinkronisasi template dengan Meta Cloud API berhasil';
      await loadTemplates();
      await successDialog({
        title: 'Sinkronisasi Berhasil',
        message: successMsg
      });
    } catch (err) {
      errorMsg = err?.error?.message || err?.message || 'Gagal menyinkronkan template dengan Meta Cloud API';
      await errorDialog({
        title: 'Sinkronisasi Gagal',
        message: errorMsg
      });
    } finally {
      isSyncing = false;
    }
  }

  function getComponentText(components, type) {
    if (!Array.isArray(components)) return '';
    const comp = components.find(c => c.type === type);
    return comp?.text || '';
  }

  function countVariables(text) {
    if (!text) return 0;
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  }

  function openCreateModal() {
    formError = '';
    templateForm = {
      id: null,
      name: '',
      category: 'UTILITY',
      language: 'id',
      header: '',
      body: 'Halo {{1}},\n\nKami menginformasikan rilis data statistik BPS Provinsi Sulawesi Tengah tanggal {{2}}.\nInformasi lengkap dapat diakses pada tautan berikut: {{3}}.\n\nTerima kasih atas kerja sama Anda.',
      footer: 'BPS Provinsi Sulawesi Tengah | Layanan PST',
      status: 'APPROVED'
    };
    isFormModalOpen = true;
  }

  function openEditModal(template) {
    formError = '';
    templateForm = {
      id: template.id,
      name: template.name,
      category: template.category || 'UTILITY',
      language: template.language || 'id',
      header: getComponentText(template.components, 'HEADER'),
      body: getComponentText(template.components, 'BODY'),
      footer: getComponentText(template.components, 'FOOTER'),
      status: template.status || 'APPROVED'
    };
    if (selectedTemplate && selectedTemplate.id === template.id) {
      selectedTemplate = null;
    }
    isFormModalOpen = true;
  }

  function insertVariable(varNumber) {
    let toInsert = '';
    if (varNumber) {
      toInsert = `{{${varNumber}}}`;
    } else {
      const matches = templateForm.body.match(/\{\{(\d+)\}\}/g) || [];
      const numbers = matches.map(m => parseInt(m.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
      const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      toInsert = `{{${nextNum}}}`;
    }

    if (!templateForm.body) {
      templateForm.body = toInsert;
    } else {
      const needsSpace = !templateForm.body.endsWith(' ') && !templateForm.body.endsWith('\n');
      templateForm.body += (needsSpace ? ' ' : '') + toInsert;
    }
  }

  function sanitizeSlug(val) {
    return (val || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  async function handleSubmitTemplate(e) {
    if (e) e.preventDefault();
    const cleanName = sanitizeSlug(templateForm.name);
    if (!cleanName || cleanName.length < 3) {
      formError = 'Nama template minimal 3 karakter (hanya huruf kecil, angka, dan garis bawah)';
      return;
    }
    if (!templateForm.body.trim()) {
      formError = 'Isi pesan template (body) wajib diisi';
      return;
    }

    isSaving = true;
    formError = '';
    try {
      const payload = {
        name: cleanName,
        category: templateForm.category,
        language: templateForm.language,
        header: templateForm.header.trim(),
        body: templateForm.body.trim(),
        footer: templateForm.footer.trim(),
        status: templateForm.status
      };

      if (templateForm.id) {
        await api.put(`/api/templates/${templateForm.id}`, payload);
        successMsg = `Template "${cleanName}" berhasil diperbarui`;
      } else {
        await api.post('/api/templates', payload);
        successMsg = `Template baru "${cleanName}" berhasil dibuat`;
      }

      isFormModalOpen = false;
      await loadTemplates();
      await successDialog({
        title: templateForm.id ? 'Template Diperbarui' : 'Template Dibuat',
        message: successMsg
      });
    } catch (err) {
      formError = err?.error?.message || err?.message || 'Gagal menyimpan template';
    } finally {
      isSaving = false;
    }
  }

  async function confirmDelete(template) {
    const confirmed = await confirmDialog({
      title: 'Hapus Template Pesan?',
      message: `Apakah Anda yakin ingin menghapus template "${template.name}"? Template ini akan dihapus dari daftar sistem.`,
      confirmText: 'Ya, Hapus Template',
      isDanger: true,
      badge: 'Hapus Template'
    });
    if (!confirmed) return;

    isDeleting = true;
    try {
      const res = await api.delete(`/api/templates/${template.id}`);
      if (selectedTemplate && selectedTemplate.id === template.id) {
        selectedTemplate = null;
      }
      await loadTemplates();
      await successDialog({
        title: 'Template Dihapus',
        message: res?.message || `Template "${template.name}" berhasil dihapus.`
      });
    } catch (err) {
      await errorDialog({
        title: 'Gagal Menghapus Template',
        message: err?.error?.message || err?.message || 'Gagal menghapus template'
      });
    } finally {
      isDeleting = false;
    }
  }

  function renderLiveBody(bodyText) {
    if (!bodyText) return 'Ketik teks isi template pada form di samping...';
    return bodyText.replace(/\{\{(\d+)\}\}/g, (match, num) => {
      const val = sampleVars[num];
      return val ? `[${val}]` : `[Variabel {{${num}}}]`;
    });
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6">
  <!-- Operational Header -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
    <div class="space-y-1">
      <div class="flex flex-wrap items-center gap-2.5">
        <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
          Katalog &amp; Manajemen Template Meta WABA
        </h1>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#E0EAE9] text-[#007979] font-semibold">
          Meta Cloud API v21.0
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F7F7F3] text-[#66706F] font-semibold border border-[#DCE2DF]">
          Nova Media MPWA Gateway
        </span>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
          ✓ Buat &amp; Edit Bebas
        </span>
      </div>
      <p class="text-sm text-[#66706F] max-w-3xl">
        Kelola template pesan resmi BPS Sulteng. Anda dapat membuat template baru, mengedit teks dan variabel dinamis secara manual, menyinkronkan dengan Meta Cloud API, atau melakukan uji kirim langsung.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onclick={openCreateModal}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007979] text-white hover:bg-[#006a6a] transition-all text-xs font-semibold shadow-sm"
      >
        <span class="text-base font-bold leading-none">+</span>
        <span>Buat Template Baru</span>
      </button>

      <button
        type="button"
        onclick={handleSync}
        disabled={isSyncing}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#DCE2DF] text-[#172020] hover:bg-[#F7F7F3] transition-all text-xs font-semibold shadow-sm disabled:opacity-50"
      >
        <span class="{isSyncing ? 'animate-spin' : ''}">🔄</span>
        <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Meta Cloud API'}</span>
      </button>
    </div>
  </div>

  {#if successMsg}
    <div class="p-3 bg-[#E0EAE9] text-[#007979] rounded-xl text-xs flex items-center justify-between shadow-sm border border-[#c1d9d7]">
      <span class="font-medium">✓ {successMsg}</span>
      <button type="button" onclick={() => { successMsg = ''; }} class="text-sm font-bold hover:text-black">✕</button>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-3 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center justify-between shadow-sm">
      <span>⚠ {errorMsg}</span>
      <button type="button" onclick={loadTemplates} class="underline font-semibold ml-2 hover:text-[#7a120b]">Coba Lagi</button>
    </div>
  {/if}

  <!-- KPI Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">TOTAL TEMPLATE</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#172020]">{templates.length}</span>
        <span class="text-xs text-[#007979] font-medium">{templates.filter(t => t.status === 'APPROVED').length} Disetujui</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KATEGORI UTILITY</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#007979]">
          {templates.filter(t => t.category === 'UTILITY').length}
        </span>
        <span class="text-xs text-[#66706F]">prioritas diseminasi</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KATEGORI MARKETING</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-blue-700">
          {templates.filter(t => t.category === 'MARKETING').length}
        </span>
        <span class="text-xs text-[#66706F]">promosi publikasi &amp; rilis</span>
      </div>
    </div>

    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col justify-between">
      <span class="text-xs font-bold text-[#66706F] uppercase tracking-wider">KATEGORI AUTHENTICATION</span>
      <div class="flex items-baseline gap-2 mt-2">
        <span class="text-2xl font-bold text-[#E37434]">
          {templates.filter(t => t.category === 'AUTHENTICATION').length}
        </span>
        <span class="text-xs text-[#66706F]">keamanan login OTP</span>
      </div>
    </div>
  </div>

  <!-- Search & Filter Bar -->
  <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-xs">🔍</span>
        <input
          type="text"
          bind:value={searchQuery}
          onkeydown={(e) => { if (e.key === 'Enter') loadTemplates(); }}
          placeholder="Cari nama template atau isi pesan..."
          class="pl-8 pr-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs w-64 focus:outline-none focus:border-[#007979]"
        />
      </div>
      <select
        bind:value={categoryFilter}
        onchange={loadTemplates}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979] bg-white"
      >
        <option value="">Semua Kategori</option>
        <option value="UTILITY">UTILITY</option>
        <option value="MARKETING">MARKETING</option>
        <option value="AUTHENTICATION">AUTHENTICATION</option>
      </select>
      <select
        bind:value={statusFilter}
        onchange={loadTemplates}
        class="px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979] bg-white"
      >
        <option value="">Semua Status</option>
        <option value="APPROVED">APPROVED (Disetujui)</option>
        <option value="PENDING">PENDING (Menunggu)</option>
        <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
        <option value="REJECTED">REJECTED (Ditolak)</option>
      </select>
    </div>

    <div class="text-xs text-[#66706F]">
      Menampilkan <strong>{templates.length}</strong> template
    </div>
  </div>

  <!-- Templates Grid -->
  {#if isLoading}
    <div class="p-12 text-center text-[#66706F]">
      <div class="w-8 h-8 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-xs">Memuat template WhatsApp...</p>
    </div>
  {:else if templates.length === 0}
    <div class="bg-white rounded-xl border border-[#DCE2DF] p-12 text-center text-[#66706F]">
      <p class="text-sm font-semibold mb-2">Belum Ada Template Tersedia</p>
      <p class="text-xs mb-4">Anda dapat membuat template baru secara manual atau melakukan sinkronisasi dengan Meta Cloud API.</p>
      <div class="flex items-center justify-center gap-3">
        <button
          type="button"
          onclick={openCreateModal}
          class="px-4 py-2 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a]"
        >
          + Buat Template Baru
        </button>
        <button
          type="button"
          onclick={handleSync}
          class="px-4 py-2 rounded-lg bg-white border border-[#DCE2DF] text-[#172020] text-xs font-semibold hover:bg-[#F7F7F3]"
        >
          Sinkronkan Meta Cloud API
        </button>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each templates as t}
        <div class="bg-white rounded-xl border border-[#DCE2DF] p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider {t.category === 'UTILITY' ? 'bg-[#E0EAE9] text-[#007979]' : t.category === 'AUTHENTICATION' ? 'bg-[#FFF8EC] text-[#793100]' : 'bg-blue-50 text-blue-700'}">
                {t.category}
              </span>
              <StatusChip status={t.status} />
            </div>

            <h3 class="text-sm font-bold text-[#172020] mb-1 font-mono break-all">{t.name}</h3>
            <span class="text-[11px] text-[#66706F] block mb-2">Bahasa: {t.language.toUpperCase()}</span>

            {#if getComponentText(t.components, 'HEADER')}
              <div class="text-[11px] font-semibold text-[#172020] bg-gray-50 px-2 py-1 rounded border border-gray-100 mb-2 truncate">
                📌 {getComponentText(t.components, 'HEADER')}
              </div>
            {/if}

            <!-- Body snippet -->
            <div class="p-3 bg-[#F7F7F3] rounded-lg text-xs text-[#172020] leading-relaxed mb-4 font-sans line-clamp-4 whitespace-pre-line">
              {getComponentText(t.components, 'BODY') || 'Tidak ada teks isi'}
            </div>

            {#if getComponentText(t.components, 'FOOTER')}
              <div class="text-[10px] text-gray-500 italic mb-3 px-1 truncate">
                ℹ️ {getComponentText(t.components, 'FOOTER')}
              </div>
            {/if}
          </div>

          <div class="border-t border-[#DCE2DF] pt-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs text-[#66706F]">
              <span>
                Variabel: <strong>{countVariables(getComponentText(t.components, 'BODY'))}</strong>
              </span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onclick={() => openEditModal(t)}
                  class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-semibold"
                  title="Edit template ini"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onclick={() => confirmDelete(t)}
                  class="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-semibold"
                  title="Hapus template"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1 border-t border-gray-100">
              <a
                href="#/direct-send?templateId={t.id}"
                class="flex-1 text-center py-1.5 rounded bg-[#FFF8EC] text-[#793100] hover:bg-[#E37434] hover:text-white transition-colors text-xs font-semibold"
                title="Kirim pesan uji coba dengan template ini"
              >
                🚀 Uji Kirim
              </a>
              <button
                type="button"
                onclick={() => { selectedTemplate = t; }}
                class="flex-1 text-center py-1.5 rounded bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-colors text-xs font-semibold"
              >
                👁️ Pratinjau
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Interactive WhatsApp Preview Modal -->
  {#if selectedTemplate}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#DCE2DF] max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-3 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xl">📱</span>
            <div>
              <h3 class="font-bold text-sm text-[#172020] font-mono">{selectedTemplate.name}</h3>
              <p class="text-[11px] text-[#66706F]">Kategori: {selectedTemplate.category} ({selectedTemplate.language.toUpperCase()})</p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => { selectedTemplate = null; }}
            class="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <!-- WhatsApp Chat Mockup -->
        <div class="bg-[#ECE5DD] p-4 rounded-xl border border-gray-300">
          <div class="bg-white p-3 rounded-lg shadow-sm max-w-sm text-xs space-y-2">
            {#if getComponentText(selectedTemplate.components, 'HEADER')}
              <div class="font-bold text-[13px] text-[#172020] pb-1 border-b border-gray-100">
                {getComponentText(selectedTemplate.components, 'HEADER')}
              </div>
            {/if}
            <div class="text-[#172020] whitespace-pre-wrap leading-relaxed">
              {getComponentText(selectedTemplate.components, 'BODY')}
            </div>
            {#if getComponentText(selectedTemplate.components, 'FOOTER')}
              <div class="text-[10px] text-gray-500 pt-1 border-t border-gray-100">
                {getComponentText(selectedTemplate.components, 'FOOTER')}
              </div>
            {/if}
            <div class="text-[9px] text-gray-400 text-right flex items-center justify-end gap-1">
              <span>08:30 WITA</span>
              <span class="text-[#34B7F1] font-bold">✓✓</span>
            </div>
          </div>
        </div>

        <div class="mt-4 p-3 bg-[#F7F7F3] rounded-xl text-xs space-y-1 border border-[#E0EAE9]">
          <span class="font-semibold text-[#172020] flex items-center gap-1.5">
            <span>ℹ️</span> Status &amp; Penggunaan Template
          </span>
          <p class="text-[#66706F]">
            Template berstatus <strong>{selectedTemplate.status}</strong>. Siap digunakan untuk pengiriman broadcast kampanye, otomatisasi rilis BRS, atau pengujian langsung via MPWA Gateway.
          </p>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => openEditModal(selectedTemplate)}
              class="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>✏️</span>
              <span>Edit Template</span>
            </button>
            <button
              type="button"
              onclick={() => confirmDelete(selectedTemplate)}
              class="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors inline-flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>Hapus</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <a
              href="#/direct-send?templateId={selectedTemplate.id}"
              class="px-4 py-2 rounded-lg bg-[#E37434] text-white text-xs font-semibold hover:bg-[#9e4200] transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              <span>🚀</span>
              <span>Uji Kirim</span>
            </a>
            <button
              type="button"
              onclick={() => { selectedTemplate = null; }}
              class="px-4 py-2 rounded-lg bg-[#F7F7F3] border border-[#DCE2DF] text-[#172020] text-xs font-semibold hover:bg-[#E0EAE9]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Form Modal (Create / Edit Template) with Live Chat Preview -->
  {#if isFormModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#DCE2DF] my-auto">
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-4 mb-4">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-[#E0EAE9] text-[#007979] flex items-center justify-center font-bold text-sm">
              {templateForm.id ? '✏️' : '➕'}
            </span>
            <div>
              <h2 class="text-base font-bold text-[#172020]">
                {templateForm.id ? 'Edit Template Pesan WhatsApp' : 'Buat Template Baru WhatsApp'}
              </h2>
              <p class="text-xs text-[#66706F]">
                Sesuaikan teks, komponen header/footer, serta parameter variabel dinamis HSM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onclick={() => { isFormModalOpen = false; }}
            class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {#if formError}
          <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
            <span>⚠ {formError}</span>
            <button type="button" onclick={() => { formError = ''; }} class="font-bold">✕</button>
          </div>
        {/if}

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Form Inputs (Left: 7 cols) -->
          <form onsubmit={handleSubmitTemplate} class="lg:col-span-7 flex flex-col gap-4">
            <!-- Slug Name & Category -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="template-name" class="block text-xs font-semibold text-[#172020] mb-1">
                  Nama Template (Slug) <span class="text-red-500">*</span>
                </label>
                <input
                  id="template-name"
                  type="text"
                  bind:value={templateForm.name}
                  oninput={(e) => { templateForm.name = sanitizeSlug(e.target.value); }}
                  placeholder="contoh: rilis_brs_pertanian"
                  required
                  class="w-full px-3 py-2 text-xs font-mono border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] bg-[#F7F7F3]"
                />
                <span class="text-[10px] text-[#66706F] mt-0.5 block">Huruf kecil, angka, dan garis bawah (_)</span>
              </div>

              <div>
                <label for="template-category" class="block text-xs font-semibold text-[#172020] mb-1">
                  Kategori Meta <span class="text-red-500">*</span>
                </label>
                <select
                  id="template-category"
                  bind:value={templateForm.category}
                  class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] bg-white"
                >
                  <option value="UTILITY">UTILITY (Pemberitahuan, Pengingat, Layanan)</option>
                  <option value="MARKETING">MARKETING (Sosialisasi, Rilis Data, Promosi)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (OTP Keamanan)</option>
                </select>
                <span class="text-[10px] text-[#66706F] mt-0.5 block">Pilih jenis pesan sesuai aturan Meta WABA</span>
              </div>
            </div>

            <!-- Language & Status -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="template-language" class="block text-xs font-semibold text-[#172020] mb-1">
                  Bahasa Template
                </label>
                <select
                  id="template-language"
                  bind:value={templateForm.language}
                  class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] bg-white"
                >
                  <option value="id">Bahasa Indonesia (id)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>

              <div>
                <label for="template-status" class="block text-xs font-semibold text-[#172020] mb-1">
                  Status Template
                </label>
                <select
                  id="template-status"
                  bind:value={templateForm.status}
                  class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] bg-white"
                >
                  <option value="APPROVED">APPROVED (Siap Digunakan)</option>
                  <option value="PENDING">PENDING (Menunggu)</option>
                  <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
                </select>
              </div>
            </div>

            <!-- Header (Optional) -->
            <div>
              <label for="template-header" class="block text-xs font-semibold text-[#172020] mb-1">
                Header Teks <span class="text-[#66706F] font-normal">(Opsional)</span>
              </label>
              <input
                id="template-header"
                type="text"
                bind:value={templateForm.header}
                placeholder="Contoh: BPS PROVINSI SULAWESI TENGAH"
                class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979]"
              />
            </div>

            <!-- Body (Required) with Variable Insert Tools -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="template-body" class="text-xs font-semibold text-[#172020]">
                  Isi Pesan (Body) <span class="text-red-500">*</span>
                </label>
                <span class="text-[10px] text-[#66706F]">
                  Variabel: <strong>{countVariables(templateForm.body)}</strong>
                </span>
              </div>

              <!-- Variable Insert Buttons Toolbar -->
              <div class="mb-2 p-2 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF] flex flex-wrap items-center gap-1.5">
                <span class="text-[10px] font-bold text-[#66706F] mr-1">Sisipkan Variabel:</span>
                <button
                  type="button"
                  onclick={() => insertVariable(1)}
                  class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  title="Sisipkan Variabel 1"
                >
                  + &#123;&#123;1&#125;&#125; (Nama)
                </button>
                <button
                  type="button"
                  onclick={() => insertVariable(2)}
                  class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  title="Sisipkan Variabel 2"
                >
                  + &#123;&#123;2&#125;&#125; (Tanggal/Nilai)
                </button>
                <button
                  type="button"
                  onclick={() => insertVariable(3)}
                  class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  title="Sisipkan Variabel 3"
                >
                  + &#123;&#123;3&#125;&#125; (Tautan)
                </button>
                <button
                  type="button"
                  onclick={() => insertVariable()}
                  class="px-2 py-0.5 rounded bg-[#007979] text-white hover:bg-[#006a6a] text-[10px] font-mono font-bold"
                  title="Sisipkan variabel baru berikutnya"
                >
                  + Variabel Baru
                </button>
              </div>

              <textarea
                id="template-body"
                bind:value={templateForm.body}
                rows="7"
                required
                placeholder="Tulis pesan lengkap di sini. Gunakan &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; untuk variabel dinamis penerima..."
                class="w-full px-3 py-2 text-xs font-sans border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] leading-relaxed"
              ></textarea>
              <p class="text-[10px] text-[#66706F] mt-1">
                Gunakan format <code class="bg-gray-100 px-1 py-0.5 rounded font-mono">&#123;&#123;1&#125;&#125;</code>, <code class="bg-gray-100 px-1 py-0.5 rounded font-mono">&#123;&#123;2&#125;&#125;</code> untuk parameter dinamis yang akan diisi otomatis dari kontak/kampanye saat pengiriman.
              </p>
            </div>

            <!-- Footer (Optional) -->
            <div>
              <label for="template-footer" class="block text-xs font-semibold text-[#172020] mb-1">
                Footer Teks <span class="text-[#66706F] font-normal">(Opsional)</span>
              </label>
              <input
                id="template-footer"
                type="text"
                bind:value={templateForm.footer}
                placeholder="Contoh: BPS Provinsi Sulawesi Tengah | Balas STOP untuk berhenti"
                class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979]"
              />
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE2DF]">
              <button
                type="button"
                onclick={() => { isFormModalOpen = false; }}
                class="px-4 py-2 rounded-lg bg-[#F7F7F3] border border-[#DCE2DF] text-[#172020] text-xs font-semibold hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                class="px-5 py-2 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a] transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
              >
                {#if isSaving}
                  <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Menyimpan...</span>
                {:else}
                  <span>💾</span>
                  <span>{templateForm.id ? 'Perbarui Template' : 'Simpan Template'}</span>
                {/if}
              </button>
            </div>
          </form>

          <!-- Live WhatsApp Chat Preview (Right: 5 cols) -->
          <div class="lg:col-span-5 flex flex-col">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-bold text-[#172020] flex items-center gap-1.5">
                <span>📱</span> Pratinjau Chat WhatsApp (Live)
              </span>
              <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                Real-Time
              </span>
            </div>

            <!-- Phone Frame Mockup -->
            <div class="bg-[#ECE5DD] rounded-xl border border-gray-300 p-3 shadow-inner flex flex-col justify-between flex-1 min-h-[380px]">
              <!-- Mock Header -->
              <div class="bg-[#075E54] text-white px-3 py-2 rounded-lg flex items-center gap-2.5 shadow-sm mb-3">
                <div class="w-7 h-7 rounded-full bg-white text-[#075E54] font-bold text-xs flex items-center justify-center">
                  BPS
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-bold truncate">BPS Sulteng Official</div>
                  <div class="text-[9px] text-[#A6D5CC]">Online • Akun Resmi</div>
                </div>
              </div>

              <!-- Message Bubble -->
              <div class="bg-white p-3.5 rounded-lg shadow-sm text-xs space-y-2 border border-gray-100 max-w-[95%] self-start relative">
                {#if templateForm.header}
                  <div class="font-bold text-[12px] text-[#172020] pb-1 border-b border-gray-100">
                    {templateForm.header}
                  </div>
                {/if}

                <div class="text-[#172020] whitespace-pre-wrap leading-relaxed font-sans text-[11px]">
                  {renderLiveBody(templateForm.body)}
                </div>

                {#if templateForm.footer}
                  <div class="text-[9px] text-gray-400 pt-1 border-t border-gray-100 italic">
                    {templateForm.footer}
                  </div>
                {/if}

                <div class="text-[9px] text-gray-400 text-right flex items-center justify-end gap-1 pt-1">
                  <span>08:30 WITA</span>
                  <span class="text-[#34B7F1] font-bold">✓✓</span>
                </div>
              </div>

              <!-- Simulation Values Note -->
              <div class="mt-4 p-2.5 bg-white/90 rounded-lg text-[10px] text-[#66706F] border border-gray-200">
                <span class="font-bold text-[#172020] block mb-1">Simulasi Parameter Variabel:</span>
                <ul class="space-y-0.5">
                  <li><span class="font-mono font-bold text-[#007979]">&lbrace;&lbrace;1&rbrace;&rbrace;</span> : {sampleVars['1']}</li>
                  <li><span class="font-mono font-bold text-[#007979]">&lbrace;&lbrace;2&rbrace;&rbrace;</span> : {sampleVars['2']}</li>
                  <li><span class="font-mono font-bold text-[#007979]">&lbrace;&lbrace;3&rbrace;&rbrace;</span> : {sampleVars['3']}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if deleteTarget}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#DCE2DF]">
        <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl mx-auto mb-4">
          🗑️
        </div>

        <h3 class="text-base font-bold text-[#172020] text-center mb-2">
          Hapus Template "{deleteTarget.name}"?
        </h3>

        <p class="text-xs text-[#66706F] text-center leading-relaxed mb-6">
          Apakah Anda yakin ingin menghapus template ini? Jika template pernah digunakan dalam pesan atau kampanye riwayat broadcast, template akan otomatis <strong>diarsipkan (ARCHIVED)</strong> agar integritas data audit tetap terjaga.
        </p>

        <div class="flex items-center justify-center gap-3">
          <button
            type="button"
            onclick={() => { deleteTarget = null; }}
            disabled={isDeleting}
            class="px-4 py-2 rounded-lg bg-[#F7F7F3] border border-[#DCE2DF] text-[#172020] text-xs font-semibold hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            type="button"
            onclick={handleDeleteTemplate}
            disabled={isDeleting}
            class="px-5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
          >
            {#if isDeleting}
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Menghapus...</span>
            {:else}
              <span>Ya, Hapus Template</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
