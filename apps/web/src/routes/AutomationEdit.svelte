<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { apiFetch } from '../lib/api/client.js';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  let { params = {} } = $props();
  let isNew = $derived(!params.id || params.id === 'new');

  // Form State
  let code = $state('');
  let name = $state('');
  let type = $state('event_reminder'); // Default to event_reminder for quick customization
  let templateId = $state('');
  let isActive = $state(true);

  // Message format mode: 'custom_text' (di luar template) vs 'template' (template resmi)
  let messageMode = $state('custom_text');
  let customHeader = $state('📢 *PENGUMUMAN KEGIATAN MENDADAK BPS SULTENG*');
  let customBody = $state(
    'Yth. Bapak/Ibu {nama},\n\n' +
    'Diberitahukan bahwa pada hari ini {tanggal} pukul {jam} WITA akan diselenggarakan kegiatan mendadak bertempat di {lokasi}.\n\n' +
    'Mohon konfirmasi kehadiran dan kerja sama Bapak/Ibu tepat waktu. Terima kasih.'
  );
  let customFooter = $state('BPS Provinsi Sulawesi Tengah');

  // Schedule & Event Time configuration (Custom Jam & Hari H)
  let scheduleType = $state('event_day'); // 'event_day', 'immediate', 'recurring'
  let eventDate = $state(new Date().toISOString().slice(0, 10)); // Default today
  let eventTime = $state('09:30'); // Default custom time
  let eventLocation = $state('Aula Lantai 3 Kantor BPS Sulteng');
  let reminderOffset = $state('day_of'); // 'day_of', 'before_30m', 'before_1h', 'h_minus_1', 'h_minus_2'
  let recurringDays = $state(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);

  // Target Audience selection
  let targetAudienceType = $state('all_employees'); // 'all_employees', 'all_partners', 'all_media', 'all_contacts', 'manual_numbers'
  let manualNumbers = $state('');

  // SIMPEG Presensi settings (if type === 'attendance_presensi')
  let reminderType = $state('in');
  let maxAgeMinutes = $state(30);

  let templates = $state([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state(null);

  // Time preset buttons for quick selection
  const timePresets = [
    { label: '07:30 WITA (Pagi)', value: '07:30' },
    { label: '08:30 WITA (Awal Kerja)', value: '08:30' },
    { label: '09:30 WITA (Pertemuan)', value: '09:30' },
    { label: '11:00 WITA (Siang)', value: '11:00' },
    { label: '13:30 WITA (Setelah Ishoma)', value: '13:30' },
    { label: '15:45 WITA (Sore)', value: '15:45' }
  ];

  // Quick message presets for common BPS ad-hoc events
  function applyPreset(presetType) {
    if (presetType === 'rapat_mendadak') {
      name = name || 'Rapat Koordinasi Mendadak Hari H';
      customHeader = '📢 *PEMBERITAHUAN RAPAT MENDADAK BPS SULTENG*';
      customBody =
        'Yth. Bapak/Ibu {nama},\n\n' +
        'Menginformasikan undangan rapat koordinasi mendadak pada hari ini {tanggal} pukul {jam} WITA di {lokasi}.\n\n' +
        'Agenda: Evaluasi percepatan kegiatan sensus & survei lapangan. Mohon hadir tepat waktu.';
      customFooter = 'Subbagian Umum BPS Sulteng';
    } else if (presetType === 'deadline_lapangan') {
      name = name || 'Pengingat Deadline Data Lapangan Hari H';
      customHeader = '⏳ *PENGINGAT BATAS AKHIR SUBMIT DATA HARI H*';
      customBody =
        'Halo {nama},\n\n' +
        'Hari ini {tanggal} pukul {jam} WITA adalah batas akhir sinkronisasi dokumen survei lapangan ke sistem Web BPS.\n\n' +
        'Pastikan seluruh kuesioner terkirim sebelum batas waktu. Hubungi penanggung jawab jika mengalami kendala server.';
      customFooter = 'Tim Diseminasi & Pengolahan BPS';
    } else if (presetType === 'sosialisasi_event') {
      name = name || 'Sosialisasi & Workshop BPS Sulteng';
      customHeader = '📌 *UNDANGAN KEGIATAN SOSIALISASI BPS SULTENG*';
      customBody =
        'Kepada Yth. {nama},\n\n' +
        'Kami mengundang Bapak/Ibu dalam agenda sosialisasi statistik yang dilaksanakan pada tanggal {tanggal} pukul {jam} WITA di {lokasi}.\n\n' +
        'Kehadiran dan partisipasi aktif Bapak/Ibu sangat kami harapkan. Terima kasih.';
      customFooter = 'Humas BPS Provinsi Sulawesi Tengah';
    }
  }

  function setNowTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    eventTime = `${hh}:${mm}`;
  }

  function insertVar(variable) {
    if (!customBody) {
      customBody = variable;
    } else {
      const needsSpace = !customBody.endsWith(' ') && !customBody.endsWith('\n');
      customBody += (needsSpace ? ' ' : '') + variable;
    }
  }

  async function loadData() {
    loading = true;
    error = null;
    try {
      const tplRes = await apiFetch('/api/templates');
      const allTemplates = tplRes.templates || tplRes.data || [];
      templates = allTemplates.filter((t) => t.status === 'APPROVED');
      if (templates.length === 0 && allTemplates.length > 0) {
        templates = allTemplates;
      }

      if (!isNew) {
        const ruleRes = await apiFetch(`/api/automations/${params.id}`);
        const rule = ruleRes.data;
        if (rule) {
          code = rule.code;
          name = rule.name;
          type = rule.type;
          templateId = rule.template_id || '';
          isActive = rule.is_active;

          const cfg = rule.config || {};
          messageMode = cfg.messageMode || (rule.template_id ? 'template' : 'custom_text');

          if (cfg.customMessage) {
            customHeader = cfg.customMessage.header || '';
            customBody = cfg.customMessage.body || '';
            customFooter = cfg.customMessage.footer || '';
          }

          scheduleType = cfg.scheduleType || 'event_day';
          eventDate = cfg.eventDate || new Date().toISOString().slice(0, 10);
          eventTime = cfg.eventTime || '09:30';
          eventLocation = cfg.eventLocation || 'BPS Sulteng';
          reminderOffset = cfg.reminderOffset || 'day_of';
          recurringDays = cfg.recurringDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

          targetAudienceType = cfg.targetAudience?.type || 'all_employees';
          manualNumbers = Array.isArray(cfg.targetAudience?.manualNumbers)
            ? cfg.targetAudience.manualNumbers.join('\n')
            : (cfg.targetAudience?.manualNumbers || '');

          reminderType = cfg.reminderType || 'in';
          maxAgeMinutes = cfg.maxAgeMinutes || 30;
        }
      } else {
        code = `auto_${Date.now().toString(36)}`;
        if (templates.length > 0) templateId = templates[0].id;
      }
    } catch (err) {
      error = err.message || 'Gagal memuat data aturan otomasi';
    } finally {
      loading = false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    saving = true;
    error = null;

    try {
      const config = {
        messageMode,
        scheduleType,
        eventDate,
        eventTime,
        eventLocation,
        reminderOffset,
        recurringDays,
        targetAudience: {
          type: targetAudienceType,
          manualNumbers: manualNumbers
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        }
      };

      if (messageMode === 'custom_text') {
        config.customMessage = {
          header: customHeader.trim(),
          body: customBody.trim(),
          footer: customFooter.trim()
        };
      }

      if (type === 'attendance_presensi') {
        config.reminderType = reminderType;
        config.maxAgeMinutes = Number(maxAgeMinutes);
      }

      const body = {
        code,
        name,
        type,
        templateId: messageMode === 'template' ? (templateId || null) : null,
        isActive,
        config
      };

      if (isNew) {
        await apiFetch('/api/automations', {
          method: 'POST',
          body: JSON.stringify(body)
        });
      } else {
        await apiFetch(`/api/automations/${params.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      }

      await successDialog({
        title: isNew ? 'Aturan Berhasil Dibuat' : 'Aturan Berhasil Diperbarui',
        message: `Aturan otomasi "${name}" telah berhasil disimpan dan siap beroperasi.`
      });
      push('/automations');
    } catch (err) {
      error = err?.error?.message || err?.message || 'Gagal menyimpan aturan otomasi';
      await errorDialog({
        title: 'Gagal Menyimpan Aturan',
        message: error
      });
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    const confirmed = await confirmDialog({
      title: 'Hapus Aturan Otomasi?',
      message: `Apakah Anda yakin ingin menghapus aturan "${name}" (${code})? Tindakan ini permanen dan akan menghapus seluruh jadwal pengingat terkait.`,
      confirmText: 'Ya, Hapus Aturan',
      cancelText: 'Batal',
      isDanger: true,
      badge: 'Hapus Aturan'
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/api/automations/${params.id}`, { method: 'DELETE' });
      await successDialog({
        title: 'Aturan Telah Dihapus',
        message: `Aturan otomasi "${name}" berhasil dihapus dari sistem.`
      });
      push('/automations');
    } catch (err) {
      await errorDialog({
        title: 'Gagal Menghapus Aturan',
        message: err.message || 'Terjadi kesalahan saat menghapus aturan otomasi.'
      });
    }
  }

  // Simulated live message preview text
  function renderLivePreview() {
    if (messageMode === 'template') {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return 'Pilih template untuk melihat pratinjau pesan.';
      const bodyComp = Array.isArray(tpl.components) ? tpl.components.find((c) => c.type === 'BODY') : null;
      return bodyComp?.text || `[Template: ${tpl.name}]`;
    }

    if (!customBody) return 'Tulis isi pesan pengingat acara pada formulir di sebelah kiri...';

    return customBody
      .replace(/\{nama\}/gi, 'Bpk. Ahmad Fauzi (ASN)')
      .replace(/\{tanggal\}/gi, eventDate || '24 September 2026')
      .replace(/\{jam\}/gi, eventTime ? `${eventTime} WITA` : '09:30 WITA')
      .replace(/\{lokasi\}/gi, eventLocation || 'Ruang Rapat Utama BPS Sulteng');
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="max-w-6xl mx-auto space-y-6 pb-12">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-[#DCE2DF] pb-4">
    <div>
      <button
        onclick={() => push('/automations')}
        class="text-xs text-[#007979] hover:underline flex items-center gap-1 mb-1 font-semibold"
        type="button"
      >
        ← Kembali ke Katalog Otomasi
      </button>
      <h1 class="text-2xl font-bold text-[#172020] tracking-tight">
        {isNew ? 'Buat Aturan Otomasi & Pengingat Fleksibel' : 'Edit Aturan Otomasi'}
      </h1>
      <p class="text-xs text-[#66706F] max-w-3xl">
        Atur pemicu pengingat otomatis untuk event tiba-tiba di hari H, jadwalkan dengan custom jam, serta tulis pesan kustom bebas di luar template resmi Meta WABA.
      </p>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-[#FEF3F2] border border-[#B42318]/30 rounded-xl text-[#B42318] text-xs flex items-center justify-between">
      <span>⚠ {error}</span>
      <button type="button" onclick={() => { error = null; }} class="font-bold">✕</button>
    </div>
  {/if}

  {#if loading}
    <div class="p-12 text-center text-[#66706F]">
      <div class="w-8 h-8 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-xs">Memuat formulir aturan otomasi...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Form (7 cols) -->
      <form onsubmit={handleSubmit} class="lg:col-span-7 space-y-5">
        <!-- 1. Identitas Aturan -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
          <div class="flex items-center gap-2 border-b border-gray-100 pb-2">
            <span class="text-sm">⚙️</span>
            <h2 class="text-xs font-bold text-[#172020] uppercase tracking-wider">Identitas Aturan</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="rule-code" class="block text-xs font-semibold text-[#172020] mb-1">Kode Unik Aturan</label>
              <input
                id="rule-code"
                type="text"
                bind:value={code}
                disabled={!isNew}
                required
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs font-mono focus:outline-none focus:border-[#007979] disabled:bg-gray-100 disabled:text-gray-500 bg-[#F7F7F3]"
              />
            </div>

            <div>
              <label for="rule-name" class="block text-xs font-semibold text-[#172020] mb-1">
                Nama Aturan / Nama Event <span class="text-red-500">*</span>
              </label>
              <input
                id="rule-name"
                type="text"
                bind:value={name}
                placeholder="Contoh: Rapat Koordinasi Evaluasi Sensus Mendadak"
                required
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
              />
            </div>
          </div>

          <!-- Kategori & Tipe Pemicu Sumber -->
          <div>
            <label for="rule-type" class="block text-xs font-semibold text-[#172020] mb-1">
              Kategori &amp; Pemicu Sumber <span class="text-red-500">*</span>
            </label>
            <select
              id="rule-type"
              bind:value={type}
              class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979] bg-white font-medium"
            >
              <option value="event_reminder">📢 Event / Kegiatan Mendadak (Hari H &amp; Pengingat Kustom)</option>
              <option value="custom">⏱️ Kustom Mandiri / Pengingat Jadwal Bebas</option>
              <option value="attendance_presensi">Internal Pegawai: SIMPEG Presensi ASN</option>
              <option value="publication_reminder">Diseminasi: Peringatan Deadline Publikasi BRS</option>
              <option value="silastik_transaction">Layanan PST: Transaksi Baru Silastik</option>
            </select>
          </div>
        </div>

        <!-- 2. Pengaturan Waktu & Hari H (Khusus Event / Kustom) -->
        {#if type === 'event_reminder' || type === 'custom'}
          <div class="bg-white rounded-xl p-5 shadow-sm border border-emerald-200 bg-emerald-50/20 space-y-4">
            <div class="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm">🗓️</span>
                <h2 class="text-xs font-bold text-[#007979] uppercase tracking-wider">
                  Pengaturan Jadwal Hari H &amp; Custom Jam
                </h2>
              </div>
              <span class="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                Fleksibel &amp; Akurat
              </span>
            </div>

            <!-- Mode Jadwal -->
            <div>
              <span class="block text-xs font-semibold text-[#172020] mb-2">Tipe Waktu Pengingat:</span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors {scheduleType === 'event_day' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                  <input type="radio" bind:group={scheduleType} value="event_day" class="hidden" />
                  <span>📅 Hari H Tertentu</span>
                </label>
                <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors {scheduleType === 'immediate' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                  <input type="radio" bind:group={scheduleType} value="immediate" class="hidden" />
                  <span>⚡ Siaran Hari Ini Segera</span>
                </label>
                <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors {scheduleType === 'recurring' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                  <input type="radio" bind:group={scheduleType} value="recurring" class="hidden" />
                  <span>🔄 Rutin Berkala</span>
                </label>
              </div>
            </div>

            <!-- Tanggal & Jam Pengiriman -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {#if scheduleType !== 'recurring'}
                <div>
                  <label for="event-date" class="block text-xs font-semibold text-[#172020] mb-1">
                    Tanggal Event (Hari H)
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    bind:value={eventDate}
                    class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979] bg-white"
                  />
                </div>
              {/if}

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label for="event-time" class="text-xs font-semibold text-[#172020]">
                    Jam Pengiriman (Custom Jam WITA) <span class="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onclick={setNowTime}
                    class="text-[10px] text-[#007979] font-bold underline hover:text-[#006a6a]"
                  >
                    Set Jam Sekarang
                  </button>
                </div>
                <input
                  id="event-time"
                  type="time"
                  bind:value={eventTime}
                  required
                  class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs font-mono focus:outline-none focus:border-[#007979] bg-white font-bold text-center"
                />
              </div>
            </div>

            <!-- Preset Jam Cepat -->
            <div>
              <span class="block text-[11px] font-semibold text-[#66706F] mb-1.5">Pilihan Cepat Jam Acara:</span>
              <div class="flex flex-wrap gap-1.5">
                {#each timePresets as preset}
                  <button
                    type="button"
                    onclick={() => { eventTime = preset.value; }}
                    class="px-2.5 py-1 rounded text-[11px] border transition-colors {eventTime === preset.value ? 'bg-[#007979] text-white border-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020] hover:bg-gray-50'}"
                  >
                    {preset.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Opsi Pengingat Relatif & Lokasi -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label for="reminder-offset" class="block text-xs font-semibold text-[#172020] mb-1">
                  Waktu Pengingat Terhadap Hari H
                </label>
                <select
                  id="reminder-offset"
                  bind:value={reminderOffset}
                  class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs bg-white focus:outline-none focus:border-[#007979]"
                >
                  <option value="day_of">Tepat pada Hari H di jam tersebut</option>
                  <option value="before_30m">30 Menit Sebelum Waktu Acara</option>
                  <option value="before_1h">1 Jam Sebelum Waktu Acara</option>
                  <option value="h_minus_1">H-1 Hari H (1 Hari Sebelumnya)</option>
                  <option value="h_minus_2">H-2 Hari H (2 Hari Sebelumnya)</option>
                  <option value="h_minus_3">H-3 Hari H (3 Hari Sebelumnya)</option>
                </select>
              </div>

              <div>
                <label for="event-location" class="block text-xs font-semibold text-[#172020] mb-1">
                  Lokasi / Link Acara (Opsional)
                </label>
                <input
                  id="event-location"
                  type="text"
                  bind:value={eventLocation}
                  placeholder="Contoh: Aula Lantai 3 BPS Sulteng"
                  class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs bg-white focus:outline-none focus:border-[#007979]"
                />
              </div>
            </div>
          </div>

          <!-- 3. Target Penerima / Audiens -->
          <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
            <div class="flex items-center gap-2 border-b border-gray-100 pb-2">
              <span class="text-sm">👥</span>
              <h2 class="text-xs font-bold text-[#172020] uppercase tracking-wider">Target Penerima (Audiens)</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors {targetAudienceType === 'all_employees' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                <input type="radio" bind:group={targetAudienceType} value="all_employees" class="hidden" />
                <span>👨‍💼 Semua Pegawai Internal (ASN &amp; PPPK)</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors {targetAudienceType === 'all_partners' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                <input type="radio" bind:group={targetAudienceType} value="all_partners" class="hidden" />
                <span>🤝 Seluruh Mitra Statistik BPS Sulteng</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors {targetAudienceType === 'all_media' ? 'bg-[#E0EAE9] border-[#007979] text-[#007979] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                <input type="radio" bind:group={targetAudienceType} value="all_media" class="hidden" />
                <span>📰 Wartawan &amp; Media Mitra BPS</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors {targetAudienceType === 'manual_numbers' ? 'bg-[#FFF8EC] border-[#E37434] text-[#793100] font-bold' : 'bg-white border-[#DCE2DF] text-[#172020]'}">
                <input type="radio" bind:group={targetAudienceType} value="manual_numbers" class="hidden" />
                <span>📱 Input Nomor Tertentu (Manual)</span>
              </label>
            </div>

            {#if targetAudienceType === 'manual_numbers'}
              <div class="p-3 bg-[#FFF8EC] rounded-xl border border-[#ffe0b2] space-y-1">
                <label for="manual-numbers" class="block text-xs font-semibold text-[#793100]">
                  Daftar Nomor WhatsApp Tujuan:
                </label>
                <textarea
                  id="manual-numbers"
                  bind:value={manualNumbers}
                  rows="3"
                  placeholder="Masukkan nomor dipisah koma atau baris baru, contoh:&#10;081234567890&#10;082198765432"
                  class="w-full px-3 py-2 text-xs font-mono border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#E37434] bg-white"
                ></textarea>
                <span class="text-[10px] text-[#66706F]">
                  Nomor dapat diawali 08... atau 628... dan akan otomatis dinormalisasi.
                </span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- 4. Mode Format Pesan ("Di Luar Template" vs "Template Meta") -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF] space-y-4">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-sm">✉️</span>
              <h2 class="text-xs font-bold text-[#172020] uppercase tracking-wider">Format Pesan WhatsApp</h2>
            </div>
            <div class="flex items-center gap-1 bg-[#F7F7F3] p-0.5 rounded-lg border border-[#DCE2DF]">
              <button
                type="button"
                onclick={() => { messageMode = 'custom_text'; }}
                class="px-2.5 py-1 text-xs rounded-md font-semibold transition-all {messageMode === 'custom_text' ? 'bg-[#007979] text-white shadow-xs' : 'text-[#66706F] hover:text-[#172020]'}"
              >
                💬 Pesan Kustom Bebas (Di Luar Template)
              </button>
              <button
                type="button"
                onclick={() => { messageMode = 'template'; }}
                class="px-2.5 py-1 text-xs rounded-md font-semibold transition-all {messageMode === 'template' ? 'bg-[#007979] text-white shadow-xs' : 'text-[#66706F] hover:text-[#172020]'}"
              >
                📋 Template Resmi Meta
              </button>
            </div>
          </div>

          <!-- Opsi A: Pesan Kustom Bebas -->
          {#if messageMode === 'custom_text'}
            <div class="space-y-4">
              <!-- Quick Inspiration Presets -->
              <div>
                <span class="block text-[11px] font-semibold text-[#66706F] mb-1.5">Contoh Teks Siap Pakai:</span>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onclick={() => applyPreset('rapat_mendadak')}
                    class="px-2.5 py-1 rounded bg-[#E0EAE9] text-[#007979] text-[11px] font-semibold hover:bg-[#007979] hover:text-white transition-colors"
                  >
                    + Rapat Mendadak Hari H
                  </button>
                  <button
                    type="button"
                    onclick={() => applyPreset('deadline_lapangan')}
                    class="px-2.5 py-1 rounded bg-[#FFF8EC] text-[#793100] text-[11px] font-semibold hover:bg-[#E37434] hover:text-white transition-colors"
                  >
                    + Pengingat Deadline Lapangan
                  </button>
                  <button
                    type="button"
                    onclick={() => applyPreset('sosialisasi_event')}
                    class="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    + Undangan Sosialisasi / Workshop
                  </button>
                </div>
              </div>

              <!-- Header Teks -->
              <div>
                <label for="custom-header" class="block text-xs font-semibold text-[#172020] mb-1">
                  Header Pesan <span class="text-[#66706F] font-normal">(Opsional, otomatis ditebalkan)</span>
                </label>
                <input
                  id="custom-header"
                  type="text"
                  bind:value={customHeader}
                  placeholder="Contoh: PENGUMUMAN RAPAT MENDADAK BPS SULTENG"
                  class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
                />
              </div>

              <!-- Body Pesan Bebas -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label for="custom-body" class="text-xs font-semibold text-[#172020]">
                    Isi Pesan Bebas <span class="text-red-500">*</span>
                  </label>
                  <span class="text-[10px] text-[#66706F]">
                    {customBody.length} karakter
                  </span>
                </div>

                <!-- Variable insertion helpers -->
                <div class="mb-2 p-2 bg-[#F7F7F3] rounded-lg border border-[#DCE2DF] flex flex-wrap items-center gap-1.5">
                  <span class="text-[10px] font-bold text-[#66706F] mr-1">Sisipkan Parameter:</span>
                  <button
                    type="button"
                    onclick={() => insertVar('{nama}')}
                    class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  >
                    + &#123;nama&#125; (Penerima)
                  </button>
                  <button
                    type="button"
                    onclick={() => insertVar('{tanggal}')}
                    class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  >
                    + &#123;tanggal&#125; (Hari H)
                  </button>
                  <button
                    type="button"
                    onclick={() => insertVar('{jam}')}
                    class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  >
                    + &#123;jam&#125; (Waktu)
                  </button>
                  <button
                    type="button"
                    onclick={() => insertVar('{lokasi}')}
                    class="px-2 py-0.5 rounded bg-white border border-[#007979] text-[#007979] hover:bg-[#E0EAE9] text-[10px] font-mono font-bold"
                  >
                    + &#123;lokasi&#125; (Tempat)
                  </button>
                </div>

                <textarea
                  id="custom-body"
                  bind:value={customBody}
                  rows="7"
                  required
                  placeholder="Ketik teks pengumuman atau instruksi bebas di sini..."
                  class="w-full px-3 py-2 text-xs border border-[#DCE2DF] rounded-lg focus:outline-none focus:border-[#007979] leading-relaxed"
                ></textarea>
                <p class="text-[10px] text-[#66706F] mt-1">
                  Teks ini dikirim langsung melalui gateway WhatsApp MPWA tanpa memerlukan proses *approval* Meta Cloud API.
                </p>
              </div>

              <!-- Footer Teks -->
              <div>
                <label for="custom-footer" class="block text-xs font-semibold text-[#172020] mb-1">
                  Footer Pesan <span class="text-[#66706F] font-normal">(Opsional)</span>
                </label>
                <input
                  id="custom-footer"
                  type="text"
                  bind:value={customFooter}
                  placeholder="Contoh: BPS Provinsi Sulawesi Tengah"
                  class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs focus:outline-none focus:border-[#007979]"
                />
              </div>
            </div>
          {:else}
            <!-- Opsi B: Gunakan Template Meta -->
            <div>
              <label for="rule-template" class="block text-xs font-semibold text-[#172020] mb-1">
                Pilih Template Pesan WhatsApp Meta
              </label>
              <select
                id="rule-template"
                bind:value={templateId}
                required
                class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-xs font-mono focus:outline-none focus:border-[#007979] bg-white"
              >
                <option value="">-- Pilih Template WhatsApp --</option>
                {#each templates as tpl}
                  <option value={tpl.id}>{tpl.name} ({tpl.language}) - {tpl.category}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>

        <!-- SIMPEG Presensi ASN (Khusus attendance_presensi) -->
        {#if type === 'attendance_presensi'}
          <div class="p-4 bg-[#ecf6f5] rounded-xl border border-[#DCE2DF] space-y-4">
            <div class="text-xs font-bold text-[#007979]">Pengaturan SIMPEG Presensi</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="reminder-type" class="block text-xs font-medium text-[#172020] mb-1">Sesi Presensi</label>
                <select
                  id="reminder-type"
                  bind:value={reminderType}
                  class="w-full px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs bg-white"
                >
                  <option value="in">Presensi Pagi / Masuk (07:15 WITA)</option>
                  <option value="out">Presensi Pulang (15:45 WITA)</option>
                </select>
              </div>
              <div>
                <label for="max-age" class="block text-xs font-medium text-[#172020] mb-1">Batas Maksimal Usia Data (Menit)</label>
                <input
                  id="max-age"
                  type="number"
                  bind:value={maxAgeMinutes}
                  min="5"
                  max="120"
                  class="w-full px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-xs bg-white"
                />
              </div>
            </div>
          </div>
        {/if}

        <!-- Active Checkbox -->
        <div class="flex items-center gap-2 pt-2">
          <input
            id="is-active"
            type="checkbox"
            bind:checked={isActive}
            class="rounded border-[#DCE2DF] text-[#007979] focus:ring-[#007979]"
          />
          <label for="is-active" class="text-xs font-semibold text-[#172020] cursor-pointer">
            Aktifkan aturan otomasi pengingat ini sekarang
          </label>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-4 border-t border-[#DCE2DF]">
          <div>
            {#if !isNew}
              <button
                type="button"
                onclick={handleDelete}
                class="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                title="Hapus aturan otomasi ini"
              >
                <span>🗑️</span>
                <span>Hapus Aturan</span>
              </button>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onclick={() => push('/automations')}
              class="px-4 py-2 border border-[#DCE2DF] rounded-lg text-xs font-semibold text-[#66706F] hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              class="px-5 py-2 bg-[#007979] hover:bg-[#006a6a] text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {#if saving}
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Menyimpan...</span>
              {:else}
                <span>💾</span>
                <span>Simpan Aturan Otomasi</span>
              {/if}
            </button>
          </div>
        </div>
      </form>

      <!-- Right Column: Live Chat Mockup (5 cols) -->
      <div class="lg:col-span-5 flex flex-col">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-bold text-[#172020] flex items-center gap-1.5">
            <span>📱</span> Pratinjau Pesan Penerima (Live)
          </span>
          <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
            Real-Time WhatsApp
          </span>
        </div>

        <!-- Phone Frame Mockup -->
        <div class="bg-[#ECE5DD] rounded-xl border border-gray-300 p-3 shadow-inner flex flex-col justify-between flex-1 min-h-[460px]">
          <!-- Chat Header -->
          <div class="bg-[#075E54] text-white px-3 py-2 rounded-lg flex items-center gap-2.5 shadow-sm mb-3">
            <div class="w-8 h-8 rounded-full bg-white text-[#075E54] font-bold text-xs flex items-center justify-center">
              BPS
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold truncate">BPS Sulteng Official</div>
              <div class="text-[9px] text-[#A6D5CC]">Online • Notifikasi Resmi</div>
            </div>
          </div>

          <!-- Chat Bubble -->
          <div class="bg-white p-3.5 rounded-lg shadow-sm text-xs space-y-2 border border-gray-100 max-w-[95%] self-start relative">
            {#if messageMode === 'custom_text' && customHeader}
              <div class="font-bold text-[12px] text-[#172020] pb-1 border-b border-gray-100">
                {customHeader}
              </div>
            {/if}

            <div class="text-[#172020] whitespace-pre-wrap leading-relaxed font-sans text-[11px]">
              {renderLivePreview()}
            </div>

            {#if messageMode === 'custom_text' && customFooter}
              <div class="text-[9px] text-gray-400 pt-1 border-t border-gray-100 italic">
                {customFooter}
              </div>
            {/if}

            <div class="text-[9px] text-gray-400 text-right flex items-center justify-end gap-1 pt-1">
              <span>{eventTime || '09:30'} WITA</span>
              <span class="text-[#34B7F1] font-bold">✓✓</span>
            </div>
          </div>

          <!-- Schedule & Target Summary Badge -->
          <div class="mt-4 p-3 bg-white/95 rounded-lg text-[11px] text-[#66706F] border border-gray-200 space-y-1">
            <span class="font-bold text-[#172020] block text-xs">Ringkasan Pemicu Acara:</span>
            <div class="flex items-center gap-1.5 text-xs text-[#007979] font-semibold">
              <span>⏰ Waktu:</span>
              <span>{eventTime} WITA ({reminderOffset === 'day_of' ? 'Hari H' : reminderOffset})</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-[#172020]">
              <span>📅 Tanggal:</span>
              <span>{eventDate}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-[#172020]">
              <span>👥 Target:</span>
              <span>{targetAudienceType === 'all_employees' ? 'Pegawai Internal ASN/PPPK' : targetAudienceType === 'all_partners' ? 'Mitra Statistik' : targetAudienceType === 'all_media' ? 'Media & Wartawan' : 'Nomor Pilihan'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
