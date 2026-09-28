<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api } from '../lib/api/client.js';
  import MessagePreview from '../lib/components/MessagePreview.svelte';
  import { successDialog, errorDialog } from '../lib/stores/dialog.js';

  let currentStep = $state(1); // 1: Audience, 2: Template, 3: Schedule, 4: Review

  // Form states
  let title = $state('');
  let contactType = $state('public'); // 'employee' | 'public' | 'all'
  let selectedTopicId = $state('');
  let selectedTemplateId = $state('');
  let sendTiming = $state('now'); // 'now' | 'scheduled'
  let scheduledDate = $state('');
  let scheduledTime = $state('08:00');

  // Variable parameter mappings { '1': { source: 'contact.name', value: '' } }
  let paramMappings = $state({});

  // Remote data
  let templates = $state([]);
  let topics = $state([]);
  let internalContacts = $state([]);
  let selectedTestContactId = $state('');

  let isLoading = $state(false);
  let isSaving = $state(false);
  let isTesting = $state(false);
  let isSyncing = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  async function syncTemplates() {
    isSyncing = true;
    errorMsg = '';
    try {
      await api.post('/api/templates/sync');
      const tmplRes = await api.get('/api/templates?status=APPROVED');
      templates = tmplRes?.templates || [];
    } catch (err) {
      errorMsg = err.message || 'Gagal menyinkronkan template';
    } finally {
      isSyncing = false;
    }
  }

  onMount(async () => {
    try {
      const [tmplRes, topRes, contRes] = await Promise.all([
        api.get('/api/templates?status=APPROVED'),
        api.get('/api/subscriptions/topics'),
        api.get('/api/contacts?limit=5&type=employee')
      ]);

      templates = tmplRes?.templates || [];
      topics = topRes?.topics || [];
      internalContacts = contRes?.data || [];
      if (internalContacts.length > 0) {
        selectedTestContactId = internalContacts[0].id;
      }
    } catch (err) {
      errorMsg = err.message || 'Gagal memuat referensi';
    }
  });

  const selectedTemplate = $derived(templates.find(t => t.id === selectedTemplateId) || null);

  const templateVariables = $derived(() => {
    if (!selectedTemplate) return [];
    const bodyComp = selectedTemplate.components?.find(c => c.type === 'BODY');
    if (!bodyComp || !bodyComp.text) return [];
    const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[\{\}]/g, '')))].sort((a, b) => Number(a) - Number(b));
  });

  function getTemplateComponentText(type) {
    if (!selectedTemplate) return '';
    return selectedTemplate.components?.find(c => c.type === type)?.text || '';
  }

  function getRenderedPreviewText() {
    let text = getTemplateComponentText('BODY');
    if (!text) return '';
    for (const [idx, mapping] of Object.entries(paramMappings)) {
      const val = mapping.source === 'literal' ? (mapping.value || `{{${idx}}}`) : `[${mapping.source}]`;
      text = text.replaceAll(`{{${idx}}}`, val);
    }
    return text;
  }

  async function handleCreateCampaign() {
    isSaving = true;
    errorMsg = '';

    try {
      let scheduledAt = null;
      if (sendTiming === 'scheduled') {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00+08:00`).toISOString();
      }

      // 1. Create draft
      const draftRes = await api.post('/api/campaigns', {
        title,
        type: sendTiming === 'scheduled' ? 'scheduled' : 'manual',
        templateId: selectedTemplateId,
        targetSegment: {
          contactType,
          topicId: selectedTopicId || undefined
        },
        templateParams: paramMappings,
        scheduledAt: scheduledAt || undefined
      });

      const campaignId = draftRes.campaign.id;

      // 2. Expand recipients
      await api.post(`/api/campaigns/${campaignId}/expand`);

      // 3. If scheduled or instant, schedule it
      if (sendTiming === 'scheduled') {
        await api.post(`/api/campaigns/${campaignId}/schedule`, { scheduledAt });
      }

      await successDialog({
        title: sendTiming === 'scheduled' ? 'Kampanye Berhasil Dijadwalkan' : 'Kampanye Berhasil Dibuat',
        message: sendTiming === 'scheduled'
          ? `Kampanye "${title}" telah berhasil dijadwalkan untuk pengiriman otomatis.`
          : `Kampanye "${title}" telah dibuat dan antrean pesan siap didistribusikan.`
      });

      push(`/campaigns/${campaignId}`);
    } catch (err) {
      errorMsg = err.message || 'Gagal menyimpan kampanye';
      await errorDialog({
        title: 'Gagal Menyimpan Kampanye',
        message: errorMsg
      });
      isSaving = false;
    }
  }

  async function handleTestSend() {
    if (!selectedTestContactId) {
      errorMsg = 'Pilih kontak internal untuk pengujian';
      await errorDialog({
        title: 'Kontak Belum Dipilih',
        message: 'Silakan pilih kontak internal untuk menerima pesan pengujian.'
      });
      return;
    }

    isTesting = true;
    errorMsg = '';
    successMsg = '';

    try {
      // Create temporary draft to test send
      const draftRes = await api.post('/api/campaigns', {
        title: `[Uji Coba] ${title || 'Test Campaign'}`,
        type: 'manual',
        templateId: selectedTemplateId,
        targetSegment: { contactType: 'employee' },
        templateParams: paramMappings
      });

      const res = await api.post(`/api/campaigns/${draftRes.campaign.id}/test-send`, {
        contactId: selectedTestContactId
      });

      successMsg = res.message || 'Pesan pengujian berhasil dikirim ke antrean!';
      await successDialog({
        title: 'Pesan Pengujian Terkirim! 🚀',
        message: 'Pesan simulasi pengujian berhasil diteruskan ke antrean pengiriman WhatsApp.'
      });
    } catch (err) {
      errorMsg = err.message || 'Gagal mengirim pesan pengujian';
      await errorDialog({
        title: 'Pengujian Gagal',
        message: errorMsg
      });
    } finally {
      isTesting = false;
    }
  }
</script>

<div class="p-6 lg:p-8 flex flex-col gap-6 max-w-5xl mx-auto">
  <!-- Top Navigation & Title -->
  <div class="flex items-center justify-between pb-4 border-b border-[#DCE2DF]">
    <div>
      <h1 class="text-2xl font-bold text-[#172020]">Buat Campaign Broadcast WhatsApp Baru</h1>
      <p class="text-xs text-[#66706F] mt-1">Konfigurasi 4 tahap pengiriman siaran resmi Meta WABA</p>
    </div>
    <a href="#/campaigns" class="px-3.5 py-1.5 rounded-lg border border-[#DCE2DF] text-xs font-semibold hover:bg-gray-50">
      Kembali
    </a>
  </div>

  {#if successMsg}
    <div class="p-3 bg-[#E0EAE9] text-[#007979] rounded-xl text-xs flex items-center justify-between">
      <span>✓ {successMsg}</span>
      <button type="button" onclick={() => { successMsg = ''; }}>✕</button>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-3 bg-[#FEF3F2] border border-[#ffdad6] text-[#B42318] rounded-xl text-xs flex items-center justify-between">
      <span>⚠ {errorMsg}</span>
      <button type="button" onclick={() => { errorMsg = ''; }}>✕</button>
    </div>
  {/if}

  <!-- Step Wizard Tabs -->
  <div class="grid grid-cols-4 gap-2 text-xs">
    <button
      type="button"
      onclick={() => { currentStep = 1; }}
      class="p-3 rounded-xl border text-left transition-all {currentStep === 1 ? 'border-[#007979] bg-[#E0EAE9]/30 font-bold text-[#007979]' : 'border-[#DCE2DF] bg-white text-[#66706F]'}"
    >
      <span class="block text-[10px] uppercase">Tahap 1</span>
      <span>1. Audiens &amp; Target</span>
    </button>
    <button
      type="button"
      onclick={() => { currentStep = 2; }}
      class="p-3 rounded-xl border text-left transition-all {currentStep === 2 ? 'border-[#007979] bg-[#E0EAE9]/30 font-bold text-[#007979]' : 'border-[#DCE2DF] bg-white text-[#66706F]'}"
    >
      <span class="block text-[10px] uppercase">Tahap 2</span>
      <span>2. Template &amp; Variabel</span>
    </button>
    <button
      type="button"
      onclick={() => { currentStep = 3; }}
      class="p-3 rounded-xl border text-left transition-all {currentStep === 3 ? 'border-[#007979] bg-[#E0EAE9]/30 font-bold text-[#007979]' : 'border-[#DCE2DF] bg-white text-[#66706F]'}"
    >
      <span class="block text-[10px] uppercase">Tahap 3</span>
      <span>3. Jadwal Siaran</span>
    </button>
    <button
      type="button"
      onclick={() => { currentStep = 4; }}
      class="p-3 rounded-xl border text-left transition-all {currentStep === 4 ? 'border-[#007979] bg-[#E0EAE9]/30 font-bold text-[#007979]' : 'border-[#DCE2DF] bg-white text-[#66706F]'}"
    >
      <span class="block text-[10px] uppercase">Tahap 4</span>
      <span>4. Tinjauan &amp; Uji Coba</span>
    </button>
  </div>

  <!-- Wizard Content Container -->
  <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 shadow-sm">
    <!-- Step 1: Audience -->
    {#if currentStep === 1}
      <div class="space-y-6">
        <div>
          <h2 class="text-base font-bold text-[#172020] mb-1">Target Segmen &amp; Judul Campaign</h2>
          <p class="text-xs text-[#66706F]">Tentukan nama campaign dan kelompok kontak yang akan menerima siaran.</p>
        </div>

        <div>
          <label for="campTitle" class="block text-xs font-semibold text-[#172020] mb-1.5">
            Judul Campaign Broadcast <span class="text-[#ba1a1a]">*</span>
          </label>
          <input
            id="campTitle"
            type="text"
            bind:value={title}
            placeholder="Contoh: Rilis BRS Inflasi & Pertumbuhan Ekonomi Q3 2026"
            class="w-full px-3.5 py-2.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
          />
        </div>

        <div>
          <span class="block text-xs font-semibold text-[#172020] mb-2">Tipe Kontak Tujuan</span>
          <div class="grid grid-cols-3 gap-3 text-xs">
            <button
              type="button"
              onclick={() => { contactType = 'public'; }}
              class="p-3 rounded-xl border text-center font-semibold transition-all {contactType === 'public' ? 'border-[#007979] bg-[#E0EAE9]/30 text-[#007979]' : 'border-[#DCE2DF]'}"
            >
              👥 Masyarakat / Publik
            </button>
            <button
              type="button"
              onclick={() => { contactType = 'employee'; }}
              class="p-3 rounded-xl border text-center font-semibold transition-all {contactType === 'employee' ? 'border-[#007979] bg-[#E0EAE9]/30 text-[#007979]' : 'border-[#DCE2DF]'}"
            >
              👔 Pegawai ASN Sulteng
            </button>
            <button
              type="button"
              onclick={() => { contactType = 'all'; }}
              class="p-3 rounded-xl border text-center font-semibold transition-all {contactType === 'all' ? 'border-[#007979] bg-[#E0EAE9]/30 text-[#007979]' : 'border-[#DCE2DF]'}"
            >
              🌐 Seluruh Kontak
            </button>
          </div>
        </div>

        {#if contactType === 'public' || contactType === 'all'}
          <div>
            <label for="topicSelect" class="block text-xs font-semibold text-[#172020] mb-1.5">
              Filter Berdasarkan Topik Langganan
            </label>
            <select
              id="topicSelect"
              bind:value={selectedTopicId}
              class="w-full px-3.5 py-2.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
            >
              <option value="">Semua Pelanggan Aktif</option>
              {#each topics as top}
                <option value={top.id}>{top.title} ({top.code})</option>
              {/each}
            </select>
            <span class="text-[11px] text-[#66706F] mt-1 block">Hanya kontak publik yang memiliki status langganan aktif untuk topik ini yang akan menerima siaran.</span>
          </div>
        {/if}

        <div class="pt-4 flex justify-end">
          <button
            type="button"
            onclick={() => {
              if (!title) { errorMsg = 'Judul campaign wajib diisi'; return; }
              currentStep = 2;
            }}
            class="px-5 py-2.5 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a]"
          >
            Lanjut ke Template →
          </button>
        </div>
      </div>
    {/if}

    <!-- Step 2: Template Selection & Mapping -->
    {#if currentStep === 2}
      <div class="space-y-6">
        <div>
          <h2 class="text-base font-bold text-[#172020] mb-1">Pilih Template WhatsApp HSM &amp; Petakan Variabel</h2>
          <p class="text-xs text-[#66706F]">Gunakan template resmi yang telah disetujui oleh Meta.</p>
        </div>

        {#if templates.length === 0}
          <div class="p-4 bg-[#FFF8EC] border border-[#FFE2AF] rounded-xl text-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-[#793100]">⚠️ Belum ada template WhatsApp resmi di sistem</span>
              <button
                type="button"
                onclick={syncTemplates}
                disabled={isSyncing}
                class="px-3 py-1.5 rounded-lg bg-[#007979] text-white font-semibold text-xs hover:bg-[#006a6a] disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
              >
                <span class="{isSyncing ? 'animate-spin' : ''}">🔄</span>
                <span>{isSyncing ? 'Menyinkronkan...' : 'Muat Template Sekarang'}</span>
              </button>
            </div>
            <p class="text-[#793100] text-[11px] leading-relaxed">
              Klik tombol di atas untuk menyinkronkan template standar resmi BPS Sulteng dari gateway WhatsApp.
            </p>
          </div>
        {:else}
          <div>
            <div class="flex justify-between items-center mb-1.5">
              <label for="tmplSelect" class="text-xs font-semibold text-[#172020]">
                Template Disetujui (Approved) <span class="text-[#ba1a1a]">*</span>
              </label>
              <button
                type="button"
                onclick={syncTemplates}
                disabled={isSyncing}
                class="text-[11px] font-semibold text-[#007979] hover:underline inline-flex items-center gap-1"
              >
                <span class="{isSyncing ? 'animate-spin' : ''}">🔄</span>
                <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Ulang'}</span>
              </button>
            </div>
            <select
              id="tmplSelect"
              bind:value={selectedTemplateId}
              class="w-full px-3.5 py-2.5 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
            >
              <option value="">-- Pilih Template --</option>
              {#each templates as t}
                <option value={t.id}>{t.name} [{t.category}] ({t.language})</option>
              {/each}
            </select>
          </div>
        {/if}

        {#if selectedTemplate}
          <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-4">
            <span class="font-bold text-xs text-[#172020] block">Teks Template Asli:</span>
            <p class="text-xs text-[#66706F] whitespace-pre-wrap">{getTemplateComponentText('BODY')}</p>

            {#if templateVariables().length > 0}
              <div class="border-t border-[#DCE2DF] pt-3 space-y-3">
                <span class="font-bold text-xs text-[#172020] block">Konfigurasi Nilai Variabel Dinamis:</span>
                {#each templateVariables() as vIdx}
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-xs">
                    <span class="font-mono font-bold text-[#007979]">Variabel {'{{' + vIdx + '}}'}:</span>
                    <select
                      onchange={(e) => {
                        paramMappings[vIdx] = {
                          source: e.target.value,
                          value: paramMappings[vIdx]?.value || ''
                        };
                      }}
                      class="px-2.5 py-1.5 border border-[#DCE2DF] rounded-lg text-xs"
                    >
                      <option value="literal">Teks Manual (Literal)</option>
                      <option value="contact.name">Nama Lengkap Kontak</option>
                      <option value="contact.phone">Nomor Telepon Kontak</option>
                      <option value="employee.nip">NIP Pegawai</option>
                      <option value="employee.unit_kerja">Unit Kerja</option>
                    </select>
                    {#if !paramMappings[vIdx] || paramMappings[vIdx].source === 'literal'}
                      <input
                        type="text"
                        placeholder="Nilai teks..."
                        oninput={(e) => {
                          paramMappings[vIdx] = {
                            source: 'literal',
                            value: e.target.value
                          };
                        }}
                        class="px-2.5 py-1.5 border border-[#DCE2DF] rounded-lg text-xs"
                      />
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="pt-4 flex justify-between">
          <button
            type="button"
            onclick={() => { currentStep = 1; }}
            class="px-4 py-2 rounded-lg border border-[#DCE2DF] text-xs font-semibold"
          >
            ← Kembali
          </button>
          <button
            type="button"
            onclick={() => {
              if (!selectedTemplateId) { errorMsg = 'Pilih template WhatsApp terlebih dahulu'; return; }
              currentStep = 3;
            }}
            class="px-5 py-2.5 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a]"
          >
            Lanjut ke Jadwal →
          </button>
        </div>
      </div>
    {/if}

    <!-- Step 3: Schedule -->
    {#if currentStep === 3}
      <div class="space-y-6">
        <div>
          <h2 class="text-base font-bold text-[#172020] mb-1">Jadwal &amp; Waktu Pengiriman</h2>
          <p class="text-xs text-[#66706F]">Waktu dijadwalkan dalam zona waktu resmi WITA (Asia/Makassar).</p>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onclick={() => { sendTiming = 'now'; }}
            class="p-4 rounded-xl border text-center font-semibold transition-all {sendTiming === 'now' ? 'border-[#007979] bg-[#E0EAE9]/30 text-[#007979]' : 'border-[#DCE2DF]'}"
          >
            ⚡ Kirim Segera (Setelah Konfirmasi)
          </button>
          <button
            type="button"
            onclick={() => { sendTiming = 'scheduled'; }}
            class="p-4 rounded-xl border text-center font-semibold transition-all {sendTiming === 'scheduled' ? 'border-[#007979] bg-[#E0EAE9]/30 text-[#007979]' : 'border-[#DCE2DF]'}"
          >
            📅 Jadwalkan Tanggal &amp; Waktu Tertentu
          </button>
        </div>

        {#if sendTiming === 'scheduled'}
          <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] grid grid-cols-2 gap-4 text-xs">
            <div>
              <label for="schedDate" class="block font-semibold mb-1">Tanggal Eksekusi</label>
              <input
                id="schedDate"
                type="date"
                bind:value={scheduledDate}
                required
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs"
              />
            </div>
            <div>
              <label for="schedTime" class="block font-semibold mb-1">Waktu (WITA)</label>
              <input
                id="schedTime"
                type="time"
                bind:value={scheduledTime}
                required
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs"
              />
            </div>
          </div>
        {/if}

        <div class="pt-4 flex justify-between">
          <button
            type="button"
            onclick={() => { currentStep = 2; }}
            class="px-4 py-2 rounded-lg border border-[#DCE2DF] text-xs font-semibold"
          >
            ← Kembali
          </button>
          <button
            type="button"
            onclick={() => { currentStep = 4; }}
            class="px-5 py-2.5 rounded-lg bg-[#007979] text-white text-xs font-semibold hover:bg-[#006a6a]"
          >
            Lanjut ke Tinjauan →
          </button>
        </div>
      </div>
    {/if}

    <!-- Step 4: Review, Preview & Test Send -->
    {#if currentStep === 4}
      <div class="space-y-6">
        <div>
          <h2 class="text-base font-bold text-[#172020] mb-1">Tinjauan Akhir &amp; Uji Coba Pengiriman</h2>
          <p class="text-xs text-[#66706F]">Pastikan redaksi pesan telah sesuai dan lakukan uji coba ke nomor internal sebelum meluncurkan.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <!-- Summary Left -->
          <div class="space-y-4 text-xs">
            <div class="p-4 bg-[#F7F7F3] rounded-xl border border-[#DCE2DF] space-y-2">
              <div class="flex justify-between">
                <span class="text-[#66706F]">Judul:</span>
                <strong class="text-[#172020]">{title}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-[#66706F]">Target Segmen:</span>
                <span class="font-semibold uppercase">{contactType}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[#66706F]">Template Meta:</span>
                <span class="font-mono">{selectedTemplate?.name}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[#66706F]">Waktu Kirim:</span>
                <span>{sendTiming === 'now' ? 'Segera' : `${scheduledDate} ${scheduledTime} WITA`}</span>
              </div>
            </div>

            <!-- Test Send Section -->
            <div class="p-4 bg-[#FFF8EC] rounded-xl border border-[#FFE2AF] space-y-3">
              <span class="font-bold text-[#793100] block">🧪 Uji Coba Pengiriman Internal:</span>
              <p class="text-[#793100] text-[11px]">Kirimkan pesan sampel ke nomor staf/admin sebelum broadcast massal dieksekusi.</p>
              <div class="flex gap-2">
                <select
                  bind:value={selectedTestContactId}
                  class="flex-1 px-3 py-1.5 border border-[#FFE2AF] rounded-lg text-xs bg-white"
                >
                  {#each internalContacts as c}
                    <option value={c.id}>{c.name} ({c.phone_e164})</option>
                  {/each}
                </select>
                <button
                  type="button"
                  onclick={handleTestSend}
                  disabled={isTesting}
                  class="px-3 py-1.5 rounded-lg bg-[#E37434] text-white font-bold hover:bg-[#9e4200] disabled:opacity-50"
                >
                  {isTesting ? 'Mengirim...' : 'Kirim Tes'}
                </button>
              </div>
            </div>
          </div>

          <!-- Preview Right -->
          <div class="flex justify-center">
            <MessagePreview
              header={getTemplateComponentText('HEADER')}
              body={getRenderedPreviewText() || 'Pratinjau pesan akan muncul di sini'}
              footer={getTemplateComponentText('FOOTER') || 'BPS Provinsi Sulawesi Tengah'}
            />
          </div>
        </div>

        <div class="pt-6 border-t border-[#DCE2DF] flex justify-between items-center">
          <button
            type="button"
            onclick={() => { currentStep = 3; }}
            class="px-4 py-2 rounded-lg border border-[#DCE2DF] text-xs font-semibold"
          >
            ← Kembali
          </button>
          <button
            type="button"
            onclick={handleCreateCampaign}
            disabled={isSaving}
            class="px-6 py-2.5 rounded-xl bg-[#007979] text-white text-xs font-bold hover:bg-[#006a6a] disabled:opacity-50 shadow-sm"
          >
            {isSaving ? 'Menyimpan...' : (sendTiming === 'scheduled' ? 'Jadwalkan Campaign Sekarang' : 'Luncurkan Campaign Broadcast')}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
