<script>
  import { onMount } from 'svelte';
  import { api } from '../../lib/api/client.js';
  import { confirmDialog, successDialog, errorDialog } from '../../lib/stores/dialog.js';

  let token = $state('');
  let contact = $state(null);
  let topics = $state([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');
  let isUnsubscribedAll = $state(false);

  onMount(async () => {
    // Extract token from URL hash or query params
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : window.location.search);
    token = urlParams.get('token') || '';

    if (!token) {
      errorMsg = 'Tautan manajemen langganan tidak valid atau tidak memiliki token verifikasi.';
      isLoading = false;
      return;
    }

    try {
      const res = await api.get(`/api/subscriptions/manage?token=${encodeURIComponent(token)}`);
      contact = res.contact;
      topics = res.topics;
    } catch (err) {
      errorMsg = err.message || 'Tautan manajemen langganan telah kedaluwarsa atau tidak valid.';
    } finally {
      isLoading = false;
    }
  });

  function toggleTopic(topicId) {
    topics = topics.map(t => t.id === topicId ? { ...t, isSubscribed: !t.isSubscribed } : t);
  }

  async function handleSave() {
    isSaving = true;
    errorMsg = '';
    successMsg = '';

    const selectedCodes = topics.filter(t => t.isSubscribed).map(t => t.code);

    try {
      const res = await api.post('/api/subscriptions/manage', {
        token,
        topicCodes: selectedCodes
      });
      successMsg = res.message || 'Preferensi langganan berhasil disimpan.';
    } catch (err) {
      errorMsg = err.message || 'Gagal menyimpan preferensi langganan.';
    } finally {
      isSaving = false;
    }
  }

  async function handleUnsubscribeAll() {
    const confirmed = await confirmDialog({
      title: 'Berhenti Langganan?',
      message: 'Apakah Anda yakin ingin berhenti dari seluruh informasi siaran WhatsApp BPS Provinsi Sulawesi Tengah?',
      confirmText: 'Ya, Berhenti Langganan',
      isDanger: true,
      badge: 'Unsubscribe'
    });
    if (!confirmed) return;

    isSaving = true;
    errorMsg = '';

    try {
      const res = await api.post('/api/subscriptions/unsubscribe', { token });
      isUnsubscribedAll = true;
      successMsg = res.message || 'Anda telah berhasil berhenti dari seluruh siaran.';
      await successDialog({
        title: 'Berhasil Berhenti Langganan',
        message: 'Nomor Anda telah dinonaktifkan dari seluruh daftar siaran informasi BPS Sulteng.'
      });
    } catch (err) {
      errorMsg = err.message || 'Gagal memproses pembatalan langganan.';
      await errorDialog({
        title: 'Gagal Berhenti Langganan',
        message: err.message || 'Gagal memproses pembatalan langganan.'
      });
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="min-h-screen bg-[#F7F7F3] text-[#172020] font-sans">
  <!-- Top Navigation -->
  <header class="bg-white border-b border-[#DCE2DF] sticky top-0 z-40 shadow-sm">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-[#007979] text-white flex items-center justify-center font-bold text-base">
          BPS
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-bold text-[#172020] tracking-tight">BPS PROVINSI SULAWESI TENGAH</span>
          <span class="text-[11px] text-[#66706F]">Pengelolaan Preferensi Langganan</span>
        </div>
      </div>
      <a href="#/subscribe" class="text-xs text-[#007979] hover:underline font-medium">
        Portal Utama
      </a>
    </div>
  </header>

  <main class="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    {#if isLoading}
      <div class="bg-white rounded-2xl border border-[#DCE2DF] p-12 text-center shadow-sm">
        <div class="w-8 h-8 border-3 border-[#007979] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-sm text-[#66706F]">Memverifikasi tautan keamanan...</p>
      </div>
    {:else if errorMsg && !contact}
      <div class="bg-white rounded-2xl border border-[#ffdad6] p-8 text-center shadow-sm">
        <div class="w-14 h-14 rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ✕
        </div>
        <h1 class="text-xl font-bold text-[#172020] mb-2">Tautan Tidak Valid atau Kedaluwarsa</h1>
        <p class="text-sm text-[#66706F] mb-6">{errorMsg}</p>
        <a
          href="#/subscribe"
          class="inline-block px-5 py-2.5 rounded-lg bg-[#007979] text-white text-sm font-medium hover:bg-[#006a6a] transition-colors"
        >
          Kembali ke Pendaftaran Baru
        </a>
      </div>
    {:else if isUnsubscribedAll}
      <div class="bg-white rounded-2xl border border-[#DCE2DF] p-8 text-center shadow-sm">
        <div class="w-14 h-14 rounded-full bg-[#E0EAE9] text-[#007979] flex items-center justify-center mx-auto mb-4 text-2xl">
          ✓
        </div>
        <h1 class="text-xl font-bold text-[#172020] mb-2">Seluruh Langganan Telah Dinonaktifkan</h1>
        <p class="text-sm text-[#66706F] mb-6">
          Nomor Anda tidak akan lagi menerima siaran informasi dari BPS Provinsi Sulawesi Tengah. Sesuai UU PDP No. 27/2022, hak penarikan persetujuan (opt-out) Anda telah dicatat secara permanen di buku besar konsensus kami.
        </p>
        <a
          href="#/subscribe"
          class="inline-block px-5 py-2.5 rounded-lg bg-[#007979] text-white text-sm font-medium hover:bg-[#006a6a] transition-colors"
        >
          Daftar Kembali
        </a>
      </div>
    {:else}
      <div class="bg-white rounded-2xl border border-[#DCE2DF] p-6 sm:p-8 shadow-sm">
        <div class="border-b border-[#DCE2DF] pb-4 mb-6">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-xl font-bold text-[#172020]">Preferensi Siaran WhatsApp</h1>
              <p class="text-xs text-[#66706F] mt-1">Pilih jenis informasi statistik resmi yang ingin Anda terima.</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E0EAE9] text-[#007979]">
              {contact?.status === 'active' ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>

          <div class="mt-4 p-3 bg-[#F7F7F3] rounded-xl flex flex-wrap gap-4 text-xs">
            <div>
              <span class="text-[#66706F]">Nama:</span>
              <strong class="ml-1 text-[#172020]">{contact?.name}</strong>
            </div>
            <div>
              <span class="text-[#66706F]">WhatsApp:</span>
              <strong class="ml-1 text-[#172020] font-mono">{contact?.phoneMasked}</strong>
            </div>
          </div>
        </div>

        {#if successMsg}
          <div class="p-3 mb-6 bg-[#E0EAE9] text-[#007979] rounded-xl text-xs flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        {/if}

        {#if errorMsg}
          <div class="p-3 mb-6 bg-[#FEF3F2] text-[#B42318] rounded-xl text-xs flex items-center gap-2">
            <span>⚠</span>
            <span>{errorMsg}</span>
          </div>
        {/if}

        <div class="space-y-3 mb-8">
          <span class="block text-xs font-semibold text-[#172020] uppercase tracking-wider">
            Topik Siaran Tersedia
          </span>
          {#each topics as topic}
            <div
              class="p-4 rounded-xl border transition-all flex items-center justify-between {topic.isSubscribed ? 'border-[#007979] bg-[#E0EAE9]/20' : 'border-[#DCE2DF] bg-white opacity-70'}"
            >
              <div class="flex flex-col pr-4">
                <span class="text-sm font-semibold text-[#172020]">{topic.title}</span>
                <span class="text-xs text-[#66706F] mt-0.5">{topic.description}</span>
              </div>
              <button
                type="button"
                onclick={() => toggleTopic(topic.id)}
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors {topic.isSubscribed ? 'bg-[#007979] text-white hover:bg-[#006a6a]' : 'bg-[#DCE2DF] text-[#172020] hover:bg-gray-300'}"
              >
                {topic.isSubscribed ? 'Aktif' : 'Berhenti'}
              </button>
            </div>
          {/each}
        </div>

        <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#DCE2DF]">
          <button
            type="button"
            onclick={handleSave}
            disabled={isSaving}
            class="flex-1 py-2.5 px-4 rounded-xl bg-[#007979] text-white text-sm font-bold hover:bg-[#006a6a] transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Preferensi'}
          </button>
          <button
            type="button"
            onclick={handleUnsubscribeAll}
            disabled={isSaving}
            class="py-2.5 px-4 rounded-xl border border-[#ffdad6] text-[#ba1a1a] hover:bg-[#FEF3F2] text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Berhenti dari Seluruh Layanan
          </button>
        </div>
      </div>
    {/if}
  </main>
</div>
