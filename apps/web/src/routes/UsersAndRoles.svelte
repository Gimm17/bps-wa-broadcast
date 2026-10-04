<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api/client.js';
  import { confirmDialog, successDialog, errorDialog } from '../lib/stores/dialog.js';

  let activeTab = $state('users'); // 'users' | 'matrix'
  let users = $state([]);
  let roles = $state([]);
  let rbacMatrix = $state({});
  let loading = $state(true);
  let searchQuery = $state('');
  let filterRole = $state('all');

  // Modal states
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showPasswordModal = $state(false);
  let selectedUser = $state(null);

  // Form states
  let formCreate = $state({
    name: '',
    username: '',
    email: '',
    password: '',
    roleCode: 'operator'
  });

  let formEdit = $state({
    name: '',
    email: '',
    roleCode: 'operator'
  });

  let formPassword = $state({
    newPassword: '',
    confirmPassword: ''
  });

  let isSubmitting = $state(false);

  const roleLabels = {
    super_admin: { label: 'Super Admin', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    admin_diseminasi: { label: 'Admin Diseminasi', color: 'bg-[#007979]/10 text-[#007979] border-[#007979]/20' },
    operator: { label: 'Operator Layanan', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    viewer: { label: 'Pimpinan / Viewer', color: 'bg-slate-100 text-slate-700 border-slate-200' }
  };

  const permissionCategories = [
    {
      name: 'Diseminasi & Kampanye WhatsApp',
      permissions: [
        { key: 'campaign.read', label: 'Melihat Daftar & Detail Kampanye' },
        { key: 'campaign.write', label: 'Membuat & Mengedit Draf Kampanye' },
        { key: 'campaign.send', label: 'Mengeksekusi / Mengirim Siaran WhatsApp' },
        { key: 'campaign.cancel', label: 'Membatalkan / Menjeda Kampanye Berjalan' }
      ]
    },
    {
      name: 'Direktori Kontak & Buku Alamat',
      permissions: [
        { key: 'contact.read', label: 'Melihat Daftar Kontak & Label' },
        { key: 'contact.write', label: 'Menambah, Mengimpor & Mengedit Kontak' },
        { key: 'contact.export', label: 'Mengekspor Data Kontak (CSV / Excel)' },
        { key: 'contact.sensitive.read', label: 'Melihat NIP & Atribut Sensitif Pegawai' }
      ]
    },
    {
      name: 'Template Pesan & Integrasi Meta',
      permissions: [
        { key: 'template.read', label: 'Melihat Katalog Template Pesan' },
        { key: 'template.sync', label: 'Sinkronisasi Template Meta WABA' },
        { key: 'automation.read', label: 'Melihat Jadwal Otomasi & Trigger' },
        { key: 'automation.write', label: 'Mengonfigurasi Otomasi Presensi / BRS' }
      ]
    },
    {
      name: 'Tata Kelola, Keamanan & Pengguna',
      permissions: [
        { key: 'user.read', label: 'Melihat Daftar Pengguna Sistem' },
        { key: 'user.manage', label: 'Mengelola Pengguna, Peran & Password' },
        { key: 'audit.read', label: 'Mengakses Jejak Audit Sistem' },
        { key: 'report.read', label: 'Melihat Laporan Statistik Pengiriman' },
        { key: 'report.export', label: 'Mengekspor Laporan Kinerja' }
      ]
    }
  ];

  async function loadData() {
    loading = true;
    try {
      const [usersRes, rolesRes] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/roles')
      ]);
      users = usersRes.data || [];
      roles = rolesRes.data?.roles || [];
      rbacMatrix = rolesRes.data?.matrix || {};
    } catch (err) {
      errorDialog('Gagal Memuat Data', err.error?.message || err.message || 'Tidak dapat memuat pengguna dan peran.');
    } finally {
      loading = false;
    }
  }

  function getPrimaryRole(user) {
    if (user.roles && user.roles.length > 0) {
      return user.roles[0].code;
    }
    return 'viewer';
  }

  function formatTime(isoStr) {
    if (!isoStr) return 'Belum pernah login';
    const d = new Date(isoStr);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WITA';
  }

  const filteredUsers = $derived(
    users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);

      const userRole = getPrimaryRole(u);
      const matchRole = filterRole === 'all' || userRole === filterRole;

      return matchQuery && matchRole;
    })
  );

  const kpis = $derived({
    total: users.length,
    superAdmin: users.filter(u => getPrimaryRole(u) === 'super_admin').length,
    adminDiseminasi: users.filter(u => getPrimaryRole(u) === 'admin_diseminasi').length,
    operator: users.filter(u => getPrimaryRole(u) === 'operator').length,
    viewer: users.filter(u => getPrimaryRole(u) === 'viewer').length
  });

  // Modal actions
  function openCreate() {
    formCreate = {
      name: '',
      username: '',
      email: '',
      password: '',
      roleCode: 'operator'
    };
    showCreateModal = true;
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!formCreate.name || !formCreate.username || !formCreate.email || !formCreate.password) {
      return errorDialog('Validasi Gagal', 'Semua kolom wajib diisi.');
    }
    if (formCreate.password.length < 8) {
      return errorDialog('Kata Sandi Kurang Kuat', 'Kata sandi minimal 8 karakter.');
    }

    isSubmitting = true;
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(formCreate)
      });
      showCreateModal = false;
      successDialog('Pengguna Ditambahkan', `Akun untuk ${formCreate.name} berhasil dibuat.`);
      await loadData();
    } catch (err) {
      errorDialog('Gagal Menambah Pengguna', err.error?.message || err.message);
    } finally {
      isSubmitting = false;
    }
  }

  function openEdit(user) {
    selectedUser = user;
    formEdit = {
      name: user.name,
      email: user.email,
      roleCode: getPrimaryRole(user)
    };
    showEditModal = true;
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!selectedUser) return;
    isSubmitting = true;
    try {
      await apiFetch(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(formEdit)
      });
      showEditModal = false;
      successDialog('Pengguna Diperbarui', `Informasi akun ${formEdit.name} berhasil disimpan.`);
      await loadData();
    } catch (err) {
      errorDialog('Gagal Mengubah Pengguna', err.error?.message || err.message);
    } finally {
      isSubmitting = false;
    }
  }

  function openResetPassword(user) {
    selectedUser = user;
    formPassword = {
      newPassword: '',
      confirmPassword: ''
    };
    showPasswordModal = true;
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!selectedUser) return;
    if (formPassword.newPassword.length < 8) {
      return errorDialog('Validasi Gagal', 'Kata sandi baru minimal 8 karakter.');
    }
    if (formPassword.newPassword !== formPassword.confirmPassword) {
      return errorDialog('Validasi Gagal', 'Konfirmasi kata sandi tidak cocok.');
    }

    isSubmitting = true;
    try {
      await apiFetch(`/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: formPassword.newPassword })
      });
      showPasswordModal = false;
      successDialog('Kata Sandi Diperbarui', `Kata sandi untuk ${selectedUser.name} telah direset.`);
    } catch (err) {
      errorDialog('Gagal Reset Kata Sandi', err.error?.message || err.message);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleToggleStatus(user) {
    const actionText = user.is_active ? 'menonaktifkan' : 'mengaktifkan';
    confirmDialog(
      `Konfirmasi ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Akun`,
      `Apakah Anda yakin ingin ${actionText} akun ${user.name}? Pengguna ${user.is_active ? 'tidak akan dapat login' : 'akan dapat login kembali'}.`,
      async () => {
        try {
          await apiFetch(`/users/${user.id}/toggle-status`, { method: 'POST' });
          successDialog('Status Berubah', `Akun ${user.name} berhasil diperbarui.`);
          await loadData();
        } catch (err) {
          errorDialog('Gagal Mengubah Status', err.error?.message || err.message);
        }
      }
    );
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-xl p-5 shadow-sm border border-[#DCE2DF]">
    <div class="flex flex-col gap-1.5 max-w-3xl">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2 py-0.5 rounded bg-[#007979]/10 text-[#007979] text-[12px] font-semibold">Infrastruktur &amp; Sistem</span>
        <span class="px-2 py-0.5 rounded bg-[#ecf6f5] text-[#007979] text-[12px] font-mono">Manajemen Identitas &amp; RBAC</span>
      </div>
      <h1 class="text-[26px] font-bold text-[#172020] tracking-tight">Pengguna &amp; Peran (Users &amp; Roles)</h1>
      <p class="text-[14px] text-[#66706F] leading-relaxed">
        Kelola akun operator diseminasi BPS Sulteng, penugasan hak akses broadcast, dan tinjau matriks kepatuhan keamanan informasi sesuai standar ISO 27001 &amp; UU PDP.
      </p>
    </div>
    <div class="flex items-center gap-3">
      <button
        onclick={openCreate}
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F26522] hover:bg-[#d95516] text-white text-[13px] font-semibold shadow-sm transition-all active:translate-y-[1px]"
        type="button"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        <span>Tambah Pengguna</span>
      </button>
    </div>
  </div>

  <!-- KPI Summaries -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-1">
      <span class="text-[12px] text-[#66706F] font-medium">Total Akun Terdaftar</span>
      <span class="text-[24px] font-bold text-[#172020] font-mono">{kpis.total}</span>
      <span class="text-[11px] text-[#007979] font-medium">Aktif di Sistem SAPA</span>
    </div>
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-1">
      <span class="text-[12px] text-[#66706F] font-medium">Super Administrator</span>
      <span class="text-[24px] font-bold text-rose-700 font-mono">{kpis.superAdmin}</span>
      <span class="text-[11px] text-[#66706F]">Hak Akses Penuh</span>
    </div>
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-1">
      <span class="text-[12px] text-[#66706F] font-medium">Admin Diseminasi</span>
      <span class="text-[24px] font-bold text-[#007979] font-mono">{kpis.adminDiseminasi}</span>
      <span class="text-[11px] text-[#66706F]">Pengelola Siaran &amp; Kontak</span>
    </div>
    <div class="bg-white p-4 rounded-xl border border-[#DCE2DF] shadow-sm flex flex-col gap-1">
      <span class="text-[12px] text-[#66706F] font-medium">Operator &amp; Viewer</span>
      <span class="text-[24px] font-bold text-blue-700 font-mono">{kpis.operator + kpis.viewer}</span>
      <span class="text-[11px] text-[#66706F]">Petugas Lapangan &amp; Pimpinan</span>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex items-center gap-2 border-b border-[#DCE2DF] pb-1">
    <button
      onclick={() => (activeTab = 'users')}
      class="px-4 py-2.5 rounded-t-lg font-medium text-[13px] flex items-center gap-2 transition-all {activeTab === 'users' ? 'bg-white border-t-2 border-[#007979] text-[#007979] shadow-sm font-semibold' : 'text-[#66706F] hover:text-[#172020]'}"
      type="button"
    >
      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <span>Daftar Pengguna ({filteredUsers.length})</span>
    </button>
    <button
      onclick={() => (activeTab = 'matrix')}
      class="px-4 py-2.5 rounded-t-lg font-medium text-[13px] flex items-center gap-2 transition-all {activeTab === 'matrix' ? 'bg-white border-t-2 border-[#007979] text-[#007979] shadow-sm font-semibold' : 'text-[#66706F] hover:text-[#172020]'}"
      type="button"
    >
      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <span>Matriks Hak Akses (RBAC)</span>
    </button>
  </div>

  <!-- TAB 1: USERS LIST -->
  {#if activeTab === 'users'}
    <!-- Search & Filter Controls -->
    <div class="bg-white rounded-xl border border-[#DCE2DF] p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="relative w-full sm:w-80">
        <svg class="w-4 h-4 text-[#66706F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari nama, email, username..."
          class="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] bg-white text-[#172020] placeholder-[#94A3B8] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
        />
      </div>
      <div class="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
        <div class="flex items-center gap-2">
          <label for="filter-role" class="text-[12px] text-[#66706F] whitespace-nowrap">Filter Peran:</label>
          <select
            id="filter-role"
            bind:value={filterRole}
            class="text-[13px] py-1.5 px-3 rounded-lg border border-[#DCE2DF] bg-white text-[#172020] focus:outline-none focus:border-[#007979]"
          >
            <option value="all">Semua Peran</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin_diseminasi">Admin Diseminasi</option>
            <option value="operator">Operator Layanan</option>
            <option value="viewer">Viewer / Pimpinan</option>
          </select>
        </div>
        <button
          onclick={loadData}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE2DF] bg-white hover:bg-slate-50 text-[12px] font-medium text-[#66706F] hover:text-[#007979] transition-all shadow-2xs shrink-0"
          title="Segarkan data"
          type="button"
        >
          <svg class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <div class="bg-white rounded-xl border border-[#DCE2DF] shadow-sm overflow-hidden flex flex-col">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-[#f2fbfb] border-b border-[#DCE2DF] text-[#66706F] text-[11px] uppercase tracking-wider font-semibold">
              <th class="py-3 px-4">Pengguna</th>
              <th class="py-3 px-4">Email Resmi</th>
              <th class="py-3 px-4">Peran (Role)</th>
              <th class="py-3 px-4">Status Akun</th>
              <th class="py-3 px-4">Terakhir Login</th>
              <th class="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#DCE2DF] text-[13px] text-[#172020]">
            {#if loading}
              <tr>
                <td colspan="6" class="py-12 text-center text-[#66706F]">
                  <div class="flex items-center justify-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-[#007979] animate-ping"></span>
                    <span>Memuat data pengguna...</span>
                  </div>
                </td>
              </tr>
            {:else if filteredUsers.length === 0}
              <tr>
                <td colspan="6" class="py-12 text-center text-[#66706F]">
                  Tidak ada pengguna yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            {:else}
              {#each filteredUsers as user}
                {@const roleKey = getPrimaryRole(user)}
                {@const roleBadge = roleLabels[roleKey] || roleLabels.viewer}
                <tr class="hover:bg-[#ecf6f5]/40 transition-colors">
                  <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-[#007979]/10 text-[#007979] flex items-center justify-center font-bold text-[14px] shrink-0 border border-[#007979]/20">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div class="flex flex-col">
                        <span class="font-semibold text-[#172020]">{user.name}</span>
                        <span class="font-mono text-[11px] text-[#66706F]">@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 font-mono text-[12px] text-[#172020]">
                    {user.email}
                  </td>
                  <td class="py-3.5 px-4">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold border {roleBadge.color}">
                      {roleBadge.label}
                    </span>
                  </td>
                  <td class="py-3.5 px-4">
                    {#if user.is_active}
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Aktif
                      </span>
                    {:else}
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Non-aktif
                      </span>
                    {/if}
                  </td>
                  <td class="py-3.5 px-4 text-[12px] text-[#66706F]">
                    {formatTime(user.last_login_at)}
                  </td>
                  <td class="py-3.5 px-4 text-right">
                    <div class="inline-flex items-center gap-1.5 justify-end">
                      <button
                        onclick={() => openEdit(user)}
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border border-[#DCE2DF] bg-white text-[#172020] hover:bg-[#ecf6f5] hover:text-[#007979] hover:border-[#007979]/40 transition-all shadow-2xs"
                        title="Ubah info / peran"
                        type="button"
                      >
                        <svg class="w-3.5 h-3.5 text-[#007979]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        onclick={() => openResetPassword(user)}
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border border-[#DCE2DF] bg-white text-[#172020] hover:bg-[#fff5f0] hover:text-[#F26522] hover:border-[#F26522]/40 transition-all shadow-2xs"
                        title="Reset kata sandi"
                        type="button"
                      >
                        <svg class="w-3.5 h-3.5 text-[#F26522]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>Sandi</span>
                      </button>
                      <button
                        onclick={() => handleToggleStatus(user)}
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium border border-[#DCE2DF] bg-white {user.is_active ? 'hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300' : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'} transition-all shadow-2xs"
                        title={user.is_active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                        type="button"
                      >
                        {#if user.is_active}
                          <svg class="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span class="text-rose-600">Blokir</span>
                        {:else}
                          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span class="text-emerald-600">Aktifkan</span>
                        {/if}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>

  <!-- TAB 2: RBAC MATRIX -->
  {:else if activeTab === 'matrix'}
    <div class="space-y-6">
      <div class="bg-white rounded-xl border border-[#DCE2DF] p-5 shadow-sm">
        <h3 class="text-[16px] font-bold text-[#172020] mb-2">Matriks Wewenang &amp; Hak Akses (Role-Based Access Control)</h3>
        <p class="text-[13px] text-[#66706F] leading-relaxed mb-6">
          Sistem SAPA menerapkan prinsip <em>Least Privilege</em> guna memastikan privasi nomor WhatsApp ASN dan pimpinan terlindungi sesuai Undang-Undang Perlindungan Data Pribadi (UU PDP No. 27/2022).
        </p>

        <div class="overflow-x-auto border border-[#DCE2DF] rounded-xl">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#f2fbfb] border-b border-[#DCE2DF] text-[#172020] text-[12px] font-semibold">
                <th class="py-3 px-4 w-1/3">Modul &amp; Fungsi Izin</th>
                <th class="py-3 px-4 text-center w-1/6 text-rose-700">Super Admin</th>
                <th class="py-3 px-4 text-center w-1/6 text-[#007979]">Admin Diseminasi</th>
                <th class="py-3 px-4 text-center w-1/6 text-blue-700">Operator</th>
                <th class="py-3 px-4 text-center w-1/6 text-slate-700">Viewer</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#DCE2DF] text-[13px]">
              {#each permissionCategories as cat}
                <tr class="bg-slate-50/70">
                  <td colspan="5" class="py-2.5 px-4 font-semibold text-[12px] text-[#007979] uppercase tracking-wide">
                    {cat.name}
                  </td>
                </tr>
                {#each cat.permissions as perm}
                  {@const hasSuper = (rbacMatrix.super_admin || []).includes(perm.key)}
                  {@const hasAdmin = (rbacMatrix.admin_diseminasi || []).includes(perm.key)}
                  {@const hasOp = (rbacMatrix.operator || []).includes(perm.key)}
                  {@const hasView = (rbacMatrix.viewer || []).includes(perm.key)}
                  <tr class="hover:bg-slate-50/40 transition-colors">
                    <td class="py-2.5 px-4">
                      <span class="font-medium text-[#172020] block">{perm.label}</span>
                      <span class="font-mono text-[10px] text-[#66706F]">{perm.key}</span>
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      {#if hasSuper}
                        <div class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      {:else}
                        <span class="text-slate-300 font-bold">—</span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      {#if hasAdmin}
                        <div class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      {:else}
                        <span class="text-slate-300 font-bold">—</span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      {#if hasOp}
                        <div class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      {:else}
                        <span class="text-slate-300 font-bold">—</span>
                      {/if}
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      {#if hasView}
                        <div class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-600">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      {:else}
                        <span class="text-slate-300 font-bold">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- MODAL: Tambah Pengguna Baru -->
{#if showCreateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-xl border border-[#DCE2DF] w-full max-w-md overflow-hidden">
      <div class="p-5 border-b border-[#DCE2DF] flex items-center justify-between">
        <h3 class="font-bold text-[16px] text-[#172020]">Tambah Pengguna Baru</h3>
        <button onclick={() => (showCreateModal = false)} class="p-1 rounded-lg text-[#66706F] hover:text-[#172020] hover:bg-slate-100 transition-colors" type="button" aria-label="Tutup modal">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onsubmit={handleCreateUser} class="p-5 space-y-4">
        <div>
          <label for="create-name" class="block text-[12px] font-semibold text-[#172020] mb-1">Nama Lengkap &amp; Gelar</label>
          <input
            id="create-name"
            type="text"
            bind:value={formCreate.name}
            placeholder="misal: Moh. Rizky, S.Tr.Stat"
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
            required
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="create-username" class="block text-[12px] font-semibold text-[#172020] mb-1">Username</label>
            <input
              id="create-username"
              type="text"
              bind:value={formCreate.username}
              placeholder="rizky.bps"
              class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
              required
            />
          </div>
          <div>
            <label for="create-role" class="block text-[12px] font-semibold text-[#172020] mb-1">Peran (Role)</label>
            <select
              id="create-role"
              bind:value={formCreate.roleCode}
              class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] bg-white text-[#172020] focus:outline-none focus:border-[#007979]"
            >
              <option value="operator">Operator Layanan</option>
              <option value="admin_diseminasi">Admin Diseminasi</option>
              <option value="viewer">Pimpinan / Viewer</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <div>
          <label for="create-email" class="block text-[12px] font-semibold text-[#172020] mb-1">Email Resmi BPS</label>
          <input
            id="create-email"
            type="email"
            bind:value={formCreate.email}
            placeholder="nama@bps.go.id"
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
            required
          />
        </div>
        <div>
          <label for="create-password" class="block text-[12px] font-semibold text-[#172020] mb-1">Kata Sandi Awal</label>
          <input
            id="create-password"
            type="password"
            bind:value={formCreate.password}
            placeholder="Minimal 8 karakter..."
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979] focus:ring-1 focus:ring-[#007979]"
            required
          />
        </div>
        <div class="pt-3 flex items-center justify-end gap-2 border-t border-[#DCE2DF]">
          <button
            type="button"
            onclick={() => (showCreateModal = false)}
            class="px-4 py-2 text-[13px] font-medium text-[#66706F] hover:bg-slate-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-5 py-2 text-[13px] font-semibold text-white bg-[#007979] hover:bg-[#006a6a] rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL: Edit Pengguna -->
{#if showEditModal && selectedUser}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-xl border border-[#DCE2DF] w-full max-w-md overflow-hidden">
      <div class="p-5 border-b border-[#DCE2DF] flex items-center justify-between">
        <h3 class="font-bold text-[16px] text-[#172020]">Edit Pengguna: @{selectedUser.username}</h3>
        <button onclick={() => (showEditModal = false)} class="p-1 rounded-lg text-[#66706F] hover:text-[#172020] hover:bg-slate-100 transition-colors" type="button" aria-label="Tutup modal">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onsubmit={handleUpdateUser} class="p-5 space-y-4">
        <div>
          <label for="edit-name" class="block text-[12px] font-semibold text-[#172020] mb-1">Nama Lengkap &amp; Gelar</label>
          <input
            id="edit-name"
            type="text"
            bind:value={formEdit.name}
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979]"
            required
          />
        </div>
        <div>
          <label for="edit-email" class="block text-[12px] font-semibold text-[#172020] mb-1">Email Resmi</label>
          <input
            id="edit-email"
            type="email"
            bind:value={formEdit.email}
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979]"
            required
          />
        </div>
        <div>
          <label for="edit-role" class="block text-[12px] font-semibold text-[#172020] mb-1">Peran (Role)</label>
          <select
            id="edit-role"
            bind:value={formEdit.roleCode}
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] bg-white text-[#172020] focus:outline-none focus:border-[#007979]"
          >
            <option value="operator">Operator Layanan</option>
            <option value="admin_diseminasi">Admin Diseminasi</option>
            <option value="viewer">Pimpinan / Viewer</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <div class="pt-3 flex items-center justify-end gap-2 border-t border-[#DCE2DF]">
          <button
            type="button"
            onclick={() => (showEditModal = false)}
            class="px-4 py-2 text-[13px] font-medium text-[#66706F] hover:bg-slate-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-5 py-2 text-[13px] font-semibold text-white bg-[#007979] hover:bg-[#006a6a] rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- MODAL: Reset Password -->
{#if showPasswordModal && selectedUser}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div class="bg-white rounded-2xl shadow-xl border border-[#DCE2DF] w-full max-w-md overflow-hidden">
      <div class="p-5 border-b border-[#DCE2DF] flex items-center justify-between">
        <h3 class="font-bold text-[16px] text-[#172020]">Reset Kata Sandi: @{selectedUser.username}</h3>
        <button onclick={() => (showPasswordModal = false)} class="p-1 rounded-lg text-[#66706F] hover:text-[#172020] hover:bg-slate-100 transition-colors" type="button" aria-label="Tutup modal">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onsubmit={handleResetPassword} class="p-5 space-y-4">
        <p class="text-[12px] text-[#66706F]">
          Sesi aktif pengguna ini akan otomatis diakhiri dan pengguna harus login menggunakan kata sandi baru.
        </p>
        <div>
          <label for="reset-pass" class="block text-[12px] font-semibold text-[#172020] mb-1">Kata Sandi Baru</label>
          <input
            id="reset-pass"
            type="password"
            bind:value={formPassword.newPassword}
            placeholder="Minimal 8 karakter..."
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979]"
            required
          />
        </div>
        <div>
          <label for="reset-confirm" class="block text-[12px] font-semibold text-[#172020] mb-1">Ulangi Kata Sandi Baru</label>
          <input
            id="reset-confirm"
            type="password"
            bind:value={formPassword.confirmPassword}
            placeholder="Ketik ulang kata sandi..."
            class="w-full px-3 py-2 text-[13px] rounded-lg border border-[#DCE2DF] focus:outline-none focus:border-[#007979]"
            required
          />
        </div>
        <div class="pt-3 flex items-center justify-end gap-2 border-t border-[#DCE2DF]">
          <button
            type="button"
            onclick={() => (showPasswordModal = false)}
            class="px-4 py-2 text-[13px] font-medium text-[#66706F] hover:bg-slate-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-5 py-2 text-[13px] font-semibold text-white bg-[#F26522] hover:bg-[#d95516] rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses...' : 'Reset Kata Sandi'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
