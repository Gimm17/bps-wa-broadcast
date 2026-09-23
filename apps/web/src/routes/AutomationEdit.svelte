<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { apiFetch } from '../lib/api/client.js';

  let { params = {} } = $props();
  let isNew = $derived(!params.id || params.id === 'new');

  // Form State
  let code = $state('');
  let name = $state('');
  let type = $state('attendance_presensi');
  let templateId = $state('');
  let isActive = $state(true);
  let reminderType = $state('in');
  let maxAgeMinutes = $state(30);

  let templates = $state([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state(null);

  async function loadData() {
    loading = true;
    error = null;
    try {
      const tplRes = await apiFetch('/api/meta/templates');
      templates = (tplRes.data || []).filter((t) => t.status === 'APPROVED');

      if (!isNew) {
        const ruleRes = await apiFetch(`/api/automations/${params.id}`);
        const rule = ruleRes.data;
        if (rule) {
          code = rule.code;
          name = rule.name;
          type = rule.type;
          templateId = rule.template_id || '';
          isActive = rule.is_active;
          reminderType = rule.config?.reminderType || 'in';
          maxAgeMinutes = rule.config?.maxAgeMinutes || 30;
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
      const config = {};
      if (type === 'attendance_presensi') {
        config.reminderType = reminderType;
        config.maxAgeMinutes = Number(maxAgeMinutes);
      }

      const body = {
        code,
        name,
        type,
        templateId: templateId || null,
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

      push('/automations');
    } catch (err) {
      error = err.message || 'Gagal menyimpan aturan otomasi';
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="max-w-3xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <button
        onclick={() => push('/automations')}
        class="text-[13px] text-[#007979] hover:underline flex items-center gap-1 mb-1"
        type="button"
      >
        ← Kembali ke Katalog Otomasi
      </button>
      <h1 class="text-[24px] font-bold text-[#172020]">
        {isNew ? 'Buat Aturan Otomasi Baru' : 'Edit Aturan Otomasi'}
      </h1>
      <p class="text-[13px] text-[#66706F]">
        Konfigurasi parameter pemicu, konektor sumber, dan mapping template WhatsApp.
      </p>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-[#FEF3F2] border border-[#B42318]/30 rounded-xl text-[#B42318] text-[13px]">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="p-8 text-center text-[#66706F]">Memuat formulir aturan...</div>
  {:else}
    <form onsubmit={handleSubmit} class="bg-white rounded-xl p-6 shadow-sm border border-[#DCE2DF] space-y-5">
      <!-- Kode & Nama -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="rule-code" class="block text-[13px] font-medium text-[#172020] mb-1">Kode Unik Aturan</label>
          <input
            id="rule-code"
            type="text"
            bind:value={code}
            disabled={!isNew}
            required
            class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] font-mono focus:outline-none focus:border-[#E37434] disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>

        <div>
          <label for="rule-name" class="block text-[13px] font-medium text-[#172020] mb-1">Nama Aturan Otomasi</label>
          <input
            id="rule-name"
            type="text"
            bind:value={name}
            placeholder="Contoh: Reminder Absensi Masuk (Pagi)"
            required
            class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] focus:outline-none focus:border-[#E37434]"
          />
        </div>
      </div>

      <!-- Tipe Sumber Otomasi -->
      <div>
        <label for="rule-type" class="block text-[13px] font-medium text-[#172020] mb-1">Kategori & Pemicu Sumber</label>
        <select
          id="rule-type"
          bind:value={type}
          class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] focus:outline-none focus:border-[#E37434]"
        >
          <option value="attendance_presensi">Internal Pegawai: SIMPEG Presensi ASN</option>
          <option value="publication_reminder">Diseminasi: Peringatan Deadline Publikasi BRS</option>
          <option value="silastik_transaction">Layanan PST: Transaksi Baru Silastik</option>
          <option value="custom">Kustom / Eksternal Trigger Lainnya</option>
        </select>
      </div>

      <!-- Specific Config Based on Type -->
      {#if type === 'attendance_presensi'}
        <div class="p-4 bg-[#ecf6f5] rounded-xl border border-[#DCE2DF] space-y-4">
          <div class="text-[13px] font-bold text-[#007979]">Pengaturan SIMPEG Presensi</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="reminder-type" class="block text-[12px] font-medium text-[#172020] mb-1">Sesi Presensi</label>
              <select
                id="reminder-type"
                bind:value={reminderType}
                class="w-full px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-[13px] bg-white"
              >
                <option value="in">Presensi Pagi / Masuk (07:15 WITA)</option>
                <option value="out">Presensi Pulang (15:45 WITA)</option>
              </select>
            </div>
            <div>
              <label for="max-age" class="block text-[12px] font-medium text-[#172020] mb-1">Batas Maksimal Usia Data (Menit)</label>
              <input
                id="max-age"
                type="number"
                bind:value={maxAgeMinutes}
                min="5"
                max="120"
                class="w-full px-3 py-1.5 border border-[#DCE2DF] rounded-lg text-[13px] bg-white"
              />
              <span class="text-[11px] text-[#66706F]">Data di atas batas ini otomatis dibatalkan (Safety Gate).</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Template Selection -->
      <div>
        <label for="rule-template" class="block text-[13px] font-medium text-[#172020] mb-1">Template Pesan WhatsApp Meta</label>
        <select
          id="rule-template"
          bind:value={templateId}
          class="w-full px-3 py-2 border border-[#DCE2DF] rounded-lg text-[13px] font-mono focus:outline-none focus:border-[#E37434]"
        >
          <option value="">-- Pilih Template yang Telah Disetujui --</option>
          {#each templates as tpl}
            <option value={tpl.id}>{tpl.name} ({tpl.language}) - {tpl.category}</option>
          {/each}
        </select>
      </div>

      <!-- Active Checkbox -->
      <div class="flex items-center gap-2 pt-2">
        <input
          id="is-active"
          type="checkbox"
          bind:checked={isActive}
          class="rounded border-[#DCE2DF] text-[#E37434] focus:ring-[#E37434]"
        />
        <label for="is-active" class="text-[13px] font-medium text-[#172020] cursor-pointer">
          Aktifkan pemicu otomasi ini sekarang
        </label>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE2DF]">
        <button
          type="button"
          onclick={() => push('/automations')}
          class="px-4 py-2 border border-[#DCE2DF] rounded-lg text-[13px] text-[#66706F] hover:bg-[#ecf6f5]"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={saving}
          class="px-5 py-2 bg-[#E37434] hover:bg-[#c96227] text-white rounded-lg text-[13px] font-medium shadow-sm transition-all"
        >
          {saving ? 'Menyimpan...' : 'Simpan Aturan Otomasi'}
        </button>
      </div>
    </form>
  {/if}
</div>
