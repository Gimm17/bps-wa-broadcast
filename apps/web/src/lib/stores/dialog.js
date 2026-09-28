import { writable } from 'svelte/store';

export const dialogStore = writable(null);

/**
 * Open a custom confirmation modal with frosted glass blur backdrop.
 * Returns a Promise that resolves to true if confirmed, false if cancelled.
 *
 * @param {Object} options
 * @param {string} [options.title='Konfirmasi Tindakan']
 * @param {string} [options.message='Apakah Anda yakin ingin melanjutkan tindakan ini?']
 * @param {string} [options.confirmText='Ya, Lanjutkan']
 * @param {string} [options.cancelText='Batal']
 * @param {boolean} [options.isDanger=false]
 * @param {string} [options.badge='Konfirmasi']
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = false,
  badge = 'Konfirmasi'
} = {}) {
  return new Promise((resolve) => {
    dialogStore.set({
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      isDanger,
      badge,
      onConfirm: () => {
        dialogStore.set(null);
        resolve(true);
      },
      onCancel: () => {
        dialogStore.set(null);
        resolve(false);
      }
    });
  });
}

/**
 * Open a custom success modal with frosted glass blur backdrop.
 *
 * @param {Object} options
 * @param {string} [options.title='Berhasil!']
 * @param {string} [options.message='Tindakan Anda telah berhasil diproses.']
 * @param {string} [options.buttonText='OK, Mengerti']
 * @param {string} [options.badge='Sukses']
 * @returns {Promise<void>}
 */
export function successDialog({
  title = 'Berhasil!',
  message = 'Tindakan Anda telah berhasil diproses.',
  buttonText = 'OK, Mengerti',
  badge = 'Sukses'
} = {}) {
  return new Promise((resolve) => {
    dialogStore.set({
      type: 'success',
      title,
      message,
      buttonText,
      badge,
      onConfirm: () => {
        dialogStore.set(null);
        resolve(true);
      }
    });
  });
}

/**
 * Open a custom error / failed modal with frosted glass blur backdrop.
 *
 * @param {Object} options
 * @param {string} [options.title='Gagal Memproses']
 * @param {string} [options.message='Terjadi kesalahan saat memproses permintaan Anda.']
 * @param {string|Object} [options.details=null]
 * @param {string} [options.buttonText='Tutup']
 * @param {string} [options.badge='Gagal']
 * @returns {Promise<void>}
 */
export function errorDialog({
  title = 'Gagal Memproses',
  message = 'Terjadi kesalahan saat memproses permintaan Anda.',
  details = null,
  buttonText = 'Tutup',
  badge = 'Gagal'
} = {}) {
  return new Promise((resolve) => {
    dialogStore.set({
      type: 'error',
      title,
      message,
      details: typeof details === 'object' && details !== null ? JSON.stringify(details, null, 2) : details,
      buttonText,
      badge,
      onConfirm: () => {
        dialogStore.set(null);
        resolve(false);
      }
    });
  });
}

/**
 * Open a custom info modal with frosted glass blur backdrop.
 *
 * @param {Object} options
 * @param {string} [options.title='Informasi']
 * @param {string} [options.message='']
 * @param {string} [options.buttonText='Tutup']
 * @param {string} [options.badge='Info']
 * @returns {Promise<void>}
 */
export function infoDialog({
  title = 'Informasi',
  message = '',
  buttonText = 'Tutup',
  badge = 'Informasi'
} = {}) {
  return new Promise((resolve) => {
    dialogStore.set({
      type: 'info',
      title,
      message,
      buttonText,
      badge,
      onConfirm: () => {
        dialogStore.set(null);
        resolve(true);
      }
    });
  });
}

// Global modal helper object
export const dialog = {
  confirm: confirmDialog,
  success: successDialog,
  error: errorDialog,
  info: infoDialog
};
