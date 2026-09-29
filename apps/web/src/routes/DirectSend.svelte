<script>
  import { onMount } from 'svelte';
  import { querystring, push } from 'svelte-spa-router';
  import { api } from '../lib/api/client.js';
  import MessagePreview from '../lib/components/MessagePreview.svelte';
  import { successDialog, errorDialog } from '../lib/stores/dialog.js';

  // Form states
  let mode = $state('free_text'); // 'free_text' | 'template'
  let recipientPhone = $state('');
  let recipientName = $state('');
  let freeTextMessage = $state('');
  let customFooter = $state('');
  let logMessage = $state(true);

  // Template states
  let templates = $state([]);
  let selectedTemplateId = $state('');
  let templateParams = $state({});

  // Contacts for quick selection
  let contacts = $state([]);
  let selectedContactId = $state('');

  // Status & loading states
  let isLoading = $state(true);
  let isSending = $state(false);
  let isCheckingNumber = $state(false);
  let checkNumberResult = $state(null); // { exists: boolean, jid: string }
  let successResult = $state(null); // response object
  let errorMessage = $state('');

  // Gateway info
  let gatewaySender = $state('—');
  let gatewayStatus = $state('connected');

  onMount(async () => {
    await Promise.all([
      loadTemplates(),
      loadContacts(),
      loadGatewayInfo()
    ]);

    // Handle template query parameter if redirected from Templates screen
    if ($querystring) {
      const params = new URLSearchParams($querystring);
      const tid = params.get('templateId');
      if (tid) {
        mode = 'template';
        selectedTemplateId = tid;
      }
      const phoneParam = params.get('phone');
      if (phoneParam) {
        recipientPhone = phoneParam;
      }
    }

    isLoading = false;
  });

  async function loadGatewayInfo() {
    try {
      const res = await api.get('/api/integrations');
      const meta = res?.integrations?.find(i => i.type === 'meta_waba');
      if (meta) {
        gatewayStatus = meta.status;
        if (meta.credentials?.sender) {
          gatewaySender = meta.credentials.sender;
        }
      }
    } catch {
      // Keep defaults
    }
  }

  let isSyncingTemplates = $state(false);

  async function loadTemplates() {
    try {
      const res = await api.get('/api/templates');
      const all = res?.templates || [];
      const approved = all.filter(t => t.status === 'APPROVED');
      templates = approved.length > 0 ? approved : all;
      if (templates.length > 0) {
        if (!selectedTemplateId || !templates.some(t => t.id === selectedTemplateId)) {
          selectedTemplateId = templates[0].id;
        }
      }
    } catch (err) {
      console.error('Gagal memuat daftar template:', err);
    }
  }

  async function handleQuickSyncTemplates() {
    isSyncingTemplates = true;
    errorMessage = '';
    try {
      await api.post('/api/templates/sync');
      await loadTemplates();
    } catch (err) {
      errorMessage = err?.message || 'Gagal menyinkronkan template dari gateway';
    } finally {
      isSyncingTemplates = false;
    }
  }

  async function loadContacts() {
    try {
      const res = await api.get('/api/contacts', { limit: 20 });
      contacts = res?.contacts || [];
    } catch (err) {
      console.error('Gagal memuat kontak:', err);
    }
  }

  function handleSelectContact(e) {
    const contactId = e.target.value;
    selectedContactId = contactId;
    if (!contactId) return;

    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      recipientPhone = contact.phone_e164 || '';
      recipientName = contact.name || '';
      checkNumberResult = null;
    }
  }

  async function handleCheckNumber() {
    if (!recipientPhone.trim()) {
      errorMessage = 'Masukkan nomor telepon WhatsApp terlebih dahulu';
      return;
    }

    isCheckingNumber = true;
    errorMessage = '';
    checkNumberResult = null;

    try {
      const res = await api.post('/api/send/check-number', { phone: recipientPhone });
      checkNumberResult = {
        exists: res.exists,
        jid: res.jid,
        phone: res.phone
      };
      if (res.phone) {
        recipientPhone = res.phone;
      }
    } catch (err) {
      errorMessage = err?.error?.message || err?.message || 'Gagal memeriksa nomor WhatsApp';
    } finally {
      isCheckingNumber = false;
    }
  }

  const selectedTemplate = $derived(
    templates.find(t => t.id === selectedTemplateId) || null
  );

  const templateComponents = $derived(
    selectedTemplate?.components || []
  );

  const templateHeader = $derived(
    templateComponents.find(c => c.type === 'HEADER')?.text || ''
  );

  const templateBody = $derived(
    templateComponents.find(c => c.type === 'BODY')?.text || ''
  );

  const templateFooter = $derived(
    templateComponents.find(c => c.type === 'FOOTER')?.text || customFooter
  );

  // Extract variables like {{1}}, {{2}} from template body
  const templateVariables = $derived.by(() => {
    if (!templateBody) return [];
    const matches = templateBody.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    const unique = [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    return unique.sort((a, b) => Number(a) - Number(b));
  });

  // Render preview body with parameters substituted
  const previewBody = $derived.by(() => {
    if (mode === 'free_text') {
      return freeTextMessage || 'Ketik pesan Anda pada formulir di sebelah kiri untuk melihat pratinjau pesan WhatsApp.';
    }

    if (!templateBody) return '';
    let rendered = templateBody;
    for (const v of templateVariables) {
      const val = templateParams[v] || `{{${v}}}`;
      rendered = rendered.replaceAll(`{{${v}}}`, val);
    }
    return rendered;
  });

  const previewFooter = $derived(
    mode === 'free_text' ? customFooter : templateFooter
  );

  function applyPresetMessage(presetText) {
    freeTextMessage = presetText;
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!recipientPhone.trim()) {
      errorMessage = 'Nomor telepon tujuan wajib diisi';
      return;
    }

    if (mode === 'free_text' && !freeTextMessage.trim()) {
      errorMessage = 'Isi pesan tidak boleh kosong';
      return;
    }

    isSending = true;
    errorMessage = '';
    successResult = null;

    try {
      const payload = {
        to: recipientPhone,
        recipientName: recipientName.trim() || undefined,
        logMessage
      };

      if (mode === 'template') {
        payload.templateId = selectedTemplateId;
        payload.templateParams = templateParams;
        payload.footer = templateFooter;
      } else {
        payload.message = freeTextMessage.trim();
        payload.footer = customFooter.trim() || undefined;
      }

      const res = await api.post('/api/send/direct', payload);
      successResult = res;

      // Update phone to normalized
      if (res.recipient) {
        recipientPhone = res.recipient;
      }

      await successDialog({
        title: 'Pesan Terkirim ke WhatsApp! 🚀',
        message: `Pesan siaran langsung berhasil dikirimkan ke nomor ${res.recipient || recipientPhone} via gateway MPWA.`
      });
    } catch (err) {
      errorMessage = err?.error?.message || err?.message || 'Gagal mengirim pesan melalui WhatsApp Gateway';
      await errorDialog({
        title: 'Pengiriman Pesan Gagal',
        message: errorMessage
      });
    } finally {
      isSending = false;
    }
  }

  function resetForm() {
    successResult = null;
    errorMessage = '';
    checkNumberResult = null;
    freeTextMessage = '';
    templateParams = {};
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
  <!-- Operational Header -->
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#DCE2DF]">
    <div class="space-y-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#E0EAE9] text-[#007979]">
          <span class="w-1.5 h-1.5 rounded-full bg-[#007979]"></span>
          Nova Media MPWA Gateway
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono bg-[#F7F7F3] text-[#66706F] border border-[#DCE2DF]">
          Sender: {gatewaySender}
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono bg-[#F7F7F3] text-[#66706F] border border-[#DCE2DF]">
          Zona Waktu: WITA
        </span>
      </div>
      <h1 class="text-2xl lg:text-3xl font-bold text-[#172020] tracking-tight">
        Kirim Manual &amp; Uji Pesan WhatsApp
      </h1>
      <p class="text-sm text-[#66706F] leading-relaxed">
        Kirim pesan WhatsApp langsung ke satu nomor tujuan secara instan (real-time) via SAPA BPS Sulteng. Cocok untuk pengujian koneksi, verifikasi tampilan template, atau pesan koordinasi dan agenda darurat bagi pegawai dan mitra.
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        type="button"
        onclick={() => push('/message-logs')}
        class="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg text-xs font-semibold bg-white text-[#172020] border border-[#DCE2DF] hover:bg-[#F7F7F3] transition-all shadow-sm"
      >
        <span>📋</span>
        <span>Lihat Message Logs</span>
      </button>
      <button
        type="button"
        onclick={() => push('/integrations')}
        class="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-lg text-xs font-semibold bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-all shadow-sm"
      >
        <span>⚙️</span>
        <span>Status Integrasi</span>
      </button>
    </div>
  </div>

  {#if successResult}
    <!-- Success Banner Card -->
    <div class="bg-[#E0EAE9] border-2 border-[#007979] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-[#007979] text-white flex items-center justify-center font-bold text-2xl flex-shrink-0">
          ✓
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-[#007979]">Pesan WhatsApp Berhasil Dikirim!</h3>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#007979] text-white">200 OK</span>
          </div>
          <p class="text-xs text-[#172020]">
            Pesan telah diteruskan ke gateway MPWA dan terkirim ke nomor penerima <strong>{successResult.recipient}</strong>.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-[#66706F]">
            <span>ID Pesan: <strong class="text-[#172020]">{successResult.messageId}</strong></span>
            <span>•</span>
            <span>Waktu: <strong>{new Date(successResult.sentAt).toLocaleTimeString('id-ID')} WITA</strong></span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end md:self-center">
        <button
          type="button"
          onclick={resetForm}
          class="px-4 py-2 rounded-lg bg-white text-[#172020] border border-[#DCE2DF] hover:bg-[#F7F7F3] text-xs font-semibold shadow-sm"
        >
          Kirim Pesan Lain
        </button>
        <button
          type="button"
          onclick={() => push('/message-logs')}
          class="px-4 py-2 rounded-lg bg-[#007979] text-white hover:bg-[#006a6a] text-xs font-semibold shadow-sm"
        >
          Buka Message Logs ➔
        </button>
      </div>
    </div>
  {/if}

  {#if errorMessage}
    <div class="bg-[#FEF3F2] border border-[#ffdad6] rounded-2xl p-4 text-[#B42318] text-xs flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-2.5">
        <span class="text-base">⚠️</span>
        <span class="font-medium">{errorMessage}</span>
      </div>
      <button
        type="button"
        onclick={() => { errorMessage = ''; }}
        class="text-sm font-bold hover:text-black"
      >
        ✕
      </button>
    </div>
  {/if}

  <!-- Main 2-Column Work Area -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- Left Column: Form Controls (7 cols) -->
    <div class="lg:col-span-7 space-y-6">
      <form onsubmit={handleSend} class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm space-y-6">
        <!-- Recipient Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-[#DCE2DF]">
            <h2 class="text-sm font-bold text-[#172020] uppercase tracking-wider font-mono">
              1. Nomor WhatsApp Tujuan
            </h2>
            <span class="text-[11px] text-[#66706F]">Wajib terdaftar di WhatsApp</span>
          </div>

          <!-- Quick Contact Picker -->
          {#if contacts.length > 0}
            <div>
              <label for="contact-picker" class="block text-xs font-semibold text-[#172020] mb-1">
                Pilih Dari Kontak Terdaftar (Opsional)
              </label>
              <select
                id="contact-picker"
                value={selectedContactId}
                onchange={handleSelectContact}
                class="w-full h-10 px-3 rounded-lg border border-[#DCE2DF] text-xs bg-[#F7F7F3] text-[#172020] focus:outline-none focus:border-[#007979] focus:bg-white"
              >
                <option value="">-- Ketik nomor manual atau pilih kontak di sini --</option>
                {#each contacts as c}
                  <option value={c.id}>
                    {c.name} ({c.phone_e164}) {c.type === 'employee' ? '• Pegawai ASN' : '• Publik'}
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          <!-- Phone Number Input with Check Number Button -->
          <div>
            <label for="recipient-phone" class="block text-xs font-semibold text-[#172020] mb-1">
              Nomor Telepon Tujuan <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input
                  id="recipient-phone"
                  type="text"
                  bind:value={recipientPhone}
                  placeholder="Contoh: 08123456789 atau 628123456789"
                  class="w-full h-10 pl-3 pr-8 rounded-lg border border-[#DCE2DF] text-xs font-mono text-[#172020] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
                  required
                />
                {#if checkNumberResult?.exists}
                  <span class="absolute right-2.5 top-2.5 text-emerald-600 text-sm font-bold" title="Nomor aktif di WhatsApp">
                    ✓
                  </span>
                {/if}
              </div>
              <button
                type="button"
                onclick={handleCheckNumber}
                disabled={isCheckingNumber || !recipientPhone}
                class="px-3.5 h-10 rounded-lg text-xs font-semibold bg-[#E0EAE9] text-[#007979] hover:bg-[#007979] hover:text-white transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                <span class="{isCheckingNumber ? 'animate-spin' : ''}">🔍</span>
                <span>{isCheckingNumber ? 'Mengecek...' : 'Cek Nomor WA'}</span>
              </button>
            </div>

            <!-- WhatsApp Validity Indicator Badge -->
            {#if checkNumberResult}
              <div class="mt-2 text-xs">
                {#if checkNumberResult.exists}
                  <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center justify-between">
                    <span class="flex items-center gap-1.5">
                      <span class="font-bold">✓ Terdaftar di WhatsApp</span>
                      <code class="text-[10px] text-emerald-600 font-mono">({checkNumberResult.jid})</code>
                    </span>
                    <span class="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold uppercase">Aktif</span>
                  </div>
                {:else}
                  <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center justify-between">
                    <span class="flex items-center gap-1.5">
                      <span class="font-bold">✕ Nomor ini tidak terdaftar di WhatsApp</span>
                    </span>
                    <span class="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold uppercase">Tidak Ditemukan</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Recipient Name (Optional) -->
          <div>
            <label for="recipient-name" class="block text-xs font-semibold text-[#172020] mb-1">
              Nama Penerima (Opsional)
            </label>
            <input
              id="recipient-name"
              type="text"
              bind:value={recipientName}
              placeholder="Contoh: Budi Santoso / Pak Kadis"
              class="w-full h-10 px-3 rounded-lg border border-[#DCE2DF] text-xs text-[#172020] focus:outline-none focus:border-[#007979]"
            />
          </div>
        </div>

        <!-- Mode Selector: Teks Bebas vs Template Resmi -->
        <div class="space-y-4 pt-2">
          <div class="flex items-center justify-between pb-2 border-b border-[#DCE2DF]">
            <h2 class="text-sm font-bold text-[#172020] uppercase tracking-wider font-mono">
              2. Format Pesan
            </h2>
            <div class="flex rounded-lg bg-[#F7F7F3] p-1 border border-[#DCE2DF]">
              <button
                type="button"
                onclick={() => { mode = 'free_text'; }}
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all {mode === 'free_text' ? 'bg-[#007979] text-white shadow-sm' : 'text-[#66706F] hover:text-[#172020]'}"
              >
                Pesan Teks Bebas
              </button>
              <button
                type="button"
                onclick={() => { mode = 'template'; }}
                class="px-3 py-1 rounded-md text-xs font-semibold transition-all {mode === 'template' ? 'bg-[#007979] text-white shadow-sm' : 'text-[#66706F] hover:text-[#172020]'}"
              >
                Template Resmi WABA
              </button>
            </div>
          </div>

          <!-- MODE 1: Free Text Input -->
          {#if mode === 'free_text'}
            <div class="space-y-3">
              <div>
                <div class="flex justify-between items-center mb-1">
                  <label for="free-text-area" class="text-xs font-semibold text-[#172020]">
                    Isi Pesan WhatsApp <span class="text-red-500">*</span>
                  </label>
                  <span class="text-[11px] font-mono text-[#66706F]">
                    {freeTextMessage.length} karakter
                  </span>
                </div>
                <textarea
                  id="free-text-area"
                  rows="5"
                  bind:value={freeTextMessage}
                  placeholder="Ketik isi pesan WhatsApp di sini... Mendukung format *tebal*, _miring_, dan emoji."
                  class="w-full p-3 rounded-xl border border-[#DCE2DF] text-xs text-[#172020] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979] font-sans leading-relaxed"
                  required
                ></textarea>
              </div>

              <!-- Quick Presets -->
              <div>
                <span class="text-[11px] font-semibold text-[#66706F] block mb-1.5">Template Cepat:</span>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onclick={() => applyPresetMessage('Halo, ini adalah pesan uji koneksi SAPA (Sistem Automasi Pesan & Agenda) BPS Provinsi Sulawesi Tengah. Layanan berjalan normal.')}
                    class="px-2.5 py-1 rounded bg-[#F7F7F3] border border-[#DCE2DF] text-[11px] text-[#172020] hover:bg-[#E0EAE9] hover:text-[#007979] transition-colors"
                  >
                    📡 Uji Koneksi Gateway
                  </button>
                  <button
                    type="button"
                    onclick={() => applyPresetMessage('Pemberitahuan: Rilis Berita Resmi Statistik (BRS) BPS Sulteng periode ini telah dipublikasikan di sulteng.bps.go.id.')}
                    class="px-2.5 py-1 rounded bg-[#F7F7F3] border border-[#DCE2DF] text-[11px] text-[#172020] hover:bg-[#E0EAE9] hover:text-[#007979] transition-colors"
                  >
                    📊 Info Rilis BRS
                  </button>
                  <button
                    type="button"
                    onclick={() => applyPresetMessage('Yth. Pegawai BPS Sulteng, dimohon segera melengkapi data presensi pada aplikasi SIMPEG hari ini. Terima kasih.')}
                    class="px-2.5 py-1 rounded bg-[#F7F7F3] border border-[#DCE2DF] text-[11px] text-[#172020] hover:bg-[#E0EAE9] hover:text-[#007979] transition-colors"
                  >
                    ⏰ Pengingat Presensi
                  </button>
                </div>
              </div>

              <!-- Custom Footer -->
              <div>
                <div class="flex justify-between items-center mb-1">
                  <label for="custom-footer" class="text-xs font-semibold text-[#172020]">
                    Footer Pesan (Opsional)
                  </label>
                  <span class="text-[10px] text-[#007979]">Kosong = Teks polos murni (direkomendasikan)</span>
                </div>
                <input
                  id="custom-footer"
                  type="text"
                  bind:value={customFooter}
                  placeholder="Kosongkan untuk pesan teks biasa (paling cepat terbuka di HP)"
                  class="w-full h-9 px-3 rounded-lg border border-[#DCE2DF] text-xs text-[#172020] focus:outline-none focus:border-[#007979]"
                />
              </div>
            </div>
          {:else}
            <!-- MODE 2: Template Selection & Dynamic Parameters -->
            <div class="space-y-4">
              {#if templates.length === 0}
                <div class="p-4 bg-[#FFF8EC] border border-[#FFE2AF] rounded-xl text-xs space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-[#793100]">⚠️ Belum ada template di sistem</span>
                    <button
                      type="button"
                      onclick={handleQuickSyncTemplates}
                      disabled={isSyncingTemplates}
                      class="px-3 py-1.5 rounded-lg bg-[#007979] text-white font-semibold text-xs hover:bg-[#006a6a] disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span class="{isSyncingTemplates ? 'animate-spin' : ''}">🔄</span>
                      <span>{isSyncingTemplates ? 'Menyinkronkan...' : 'Muat Template Sekarang'}</span>
                    </button>
                  </div>
                  <p class="text-[#793100] text-[11px] leading-relaxed">
                    Klik tombol di atas untuk menyinkronkan 3 template standar resmi BPS Sulteng (BRS Rilis Bulanan, Presensi Pegawai, Silastik PST) ke database.
                  </p>
                </div>
              {:else}
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label for="template-selector" class="text-xs font-semibold text-[#172020]">
                      Pilih Template Terdaftar
                    </label>
                    <button
                      type="button"
                      onclick={handleQuickSyncTemplates}
                      disabled={isSyncingTemplates}
                      class="text-[11px] font-semibold text-[#007979] hover:underline inline-flex items-center gap-1"
                    >
                      <span class="{isSyncingTemplates ? 'animate-spin' : ''}">🔄</span>
                      <span>{isSyncingTemplates ? 'Sinkronisasi...' : 'Sinkronkan Ulang'}</span>
                    </button>
                  </div>
                  <select
                    id="template-selector"
                    bind:value={selectedTemplateId}
                    class="w-full h-10 px-3 rounded-lg border border-[#DCE2DF] text-xs text-[#172020] bg-white focus:outline-none focus:border-[#007979]"
                  >
                    {#each templates as t}
                      <option value={t.id}>
                        {t.name} ({t.category} • {t.language.toUpperCase()})
                      </option>
                    {/each}
                  </select>
                </div>
              {/if}

              {#if selectedTemplate}
                <div class="p-3 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] text-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-[#172020] font-mono">{selectedTemplate.name}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E0EAE9] text-[#007979]">
                      {selectedTemplate.category}
                    </span>
                  </div>
                  <p class="text-[#66706F] text-[11px] italic">
                    "{templateBody}"
                  </p>
                </div>

                <!-- Dynamic Parameters Input List -->
                {#if templateVariables.length > 0}
                  <div class="space-y-2.5 pt-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-[#172020]">Variabel Dinamis Template:</span>
                      <span class="text-[11px] text-[#66706F]">{templateVariables.length} parameter ditemukan</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {#each templateVariables as v}
                        <div class="space-y-1">
                          <label for="param-{v}" class="text-[11px] font-mono font-semibold text-[#007979] flex items-center gap-1">
                            <span>Variabel</span>
                            <span class="bg-amber-100 text-amber-900 px-1 rounded font-bold">{`{{${v}}}`}</span>
                          </label>
                          <input
                            id="param-{v}"
                            type="text"
                            bind:value={templateParams[v]}
                            placeholder="Nilai untuk {`{{${v}}}`}"
                            class="w-full h-9 px-3 rounded-lg border border-[#DCE2DF] text-xs text-[#172020] focus:outline-none focus:border-[#007979]"
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="text-xs text-[#66706F] italic p-2 bg-[#F7F7F3] rounded-lg">
                    Template ini adalah template statis tanpa variabel pengganti dinamis.
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>

        <!-- Logging Options & Actions -->
        <div class="pt-4 border-t border-[#DCE2DF] space-y-4">
          <label class="flex items-center gap-2 cursor-pointer text-xs text-[#172020]">
            <input
              type="checkbox"
              bind:checked={logMessage}
              class="w-4 h-4 rounded text-[#007979] focus:ring-[#007979] border-gray-300"
            />
            <span>Catat riwayat pengiriman ini ke tabel <strong>Message Logs</strong> sistem</span>
          </label>

          <div class="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onclick={resetForm}
              class="px-4 py-2.5 rounded-lg border border-[#DCE2DF] bg-white text-[#66706F] hover:bg-[#F7F7F3] text-xs font-semibold"
            >
              Reset Formulir
            </button>

            <button
              type="submit"
              disabled={isSending || !recipientPhone}
              class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#E37434] text-white hover:bg-[#9e4200] transition-all text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {#if isSending}
                <span class="animate-spin">🔄</span>
                <span>Mengirim ke MPWA...</span>
              {:else}
                <span>🚀</span>
                <span>Kirim Pesan Sekarang</span>
              {/if}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Right Column: Live WhatsApp Interactive Mockup Preview (5 cols) -->
    <div class="lg:col-span-5 space-y-4 sticky top-20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-[#172020] uppercase tracking-wider font-mono">
            Pratinjau Langsung
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E0EAE9] text-[#007979]">
            Real-time
          </span>
        </div>
        <span class="text-[11px] text-[#66706F]">Tampilan di Smartphone Penerima</span>
      </div>

      <!-- Smartphone Frame Container -->
      <div class="bg-[#0b141a] rounded-[2.5rem] p-3 shadow-2xl border-4 border-[#374151] max-w-sm mx-auto">
        <!-- Phone Camera Notch / Speaker -->
        <div class="w-28 h-4 bg-[#1f2937] rounded-full mx-auto mb-2 flex items-center justify-center">
          <div class="w-2.5 h-2.5 bg-black rounded-full"></div>
        </div>

        <!-- WhatsApp App Screen Mockup -->
        <div class="bg-[#efeae2] rounded-[2rem] overflow-hidden shadow-inner flex flex-col min-h-[460px]">
          <!-- WhatsApp Top App Bar -->
          <div class="bg-[#007979] text-white px-3 py-2.5 flex items-center justify-between shadow-md">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs">‹</span>
              <div class="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                🏛️
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-xs font-bold truncate">BPS Sulteng</span>
                  <span class="text-[#97f2f1] text-[10px]" title="Akun Resmi Terverifikasi">✓</span>
                </div>
                <span class="text-[9px] text-[#97f2f1]/90 truncate">Akun Resmi Layanan Statistik</span>
              </div>
            </div>
            <div class="flex items-center gap-2.5 text-xs text-white/90">
              <span>📹</span>
              <span>📞</span>
              <span>⋮</span>
            </div>
          </div>

          <!-- Chat Canvas Body with WhatsApp Wallpaper Pattern -->
          <div class="p-3.5 flex-1 flex flex-col justify-end space-y-2 overflow-y-auto">
            <!-- Encryption Security Banner -->
            <div class="p-1.5 bg-[#FFF8EC] rounded-lg text-center text-[9px] text-[#793100] border border-[#FFE2AF] shadow-xs">
              🔒 Pesan ini terenkripsi secara end-to-end melalui gateway resmi WABA BPS Sulteng.
            </div>

            <!-- WhatsApp Message Bubble (Incoming / BPS Sent) -->
            <div class="bg-[#d9fdd3] text-[#111b21] p-3 rounded-2xl rounded-tl-none text-xs space-y-2 shadow-sm border border-emerald-200/50 max-w-[92%] self-start relative">
              <!-- Header if exists -->
              {#if templateHeader}
                <div class="font-bold text-[12px] text-[#007979] pb-1 border-b border-emerald-200">
                  {templateHeader}
                </div>
              {/if}

              <!-- Body Text -->
              <div class="whitespace-pre-wrap leading-relaxed font-sans text-[12px]">
                {previewBody}
              </div>

              <!-- Footer Text -->
              {#if previewFooter}
                <div class="text-[10px] text-gray-500 pt-1 border-t border-emerald-200/60 font-sans">
                  {previewFooter}
                </div>
              {/if}

              <!-- Bubble Timestamp & Double Checkmark -->
              <div class="text-[9px] text-gray-500 text-right flex items-center justify-end gap-1 pt-0.5">
                <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA</span>
                <span class="text-[#53bdeb] font-bold">✓✓</span>
              </div>
            </div>
          </div>

          <!-- Simulated Bottom Input Bar -->
          <div class="bg-[#f0f2f5] p-2 flex items-center gap-2 border-t border-gray-200">
            <span class="text-sm">😊</span>
            <div class="bg-white rounded-full flex-1 px-3 py-1.5 text-[10px] text-gray-400">
              Balas pesan...
            </div>
            <span class="text-sm">📎</span>
            <span class="text-sm">🎙️</span>
          </div>
        </div>
      </div>

      <!-- Quick Info Cards -->
      <div class="p-3.5 bg-white rounded-xl border border-[#DCE2DF] text-xs space-y-1.5 text-[#66706F]">
        <div class="flex items-center gap-2 text-[#172020] font-semibold">
          <span>ℹ️</span>
          <span>Ketentuan Pengiriman Langsung:</span>
        </div>
        <ul class="list-disc list-inside space-y-0.5 text-[11px] pl-1">
          <li>Pesan dikirim langsung seketika (*synchronous*) tanpa melalui antrean.</li>
          <li>Nomor penerima harus aktif di WhatsApp (format internasional diawali `62`).</li>
          <li>Setiap pengiriman tercatat di audit log &amp; riwayat pesan untuk pemantauan kepatuhan.</li>
        </ul>
      </div>
    </div>
  </div>
</div>
