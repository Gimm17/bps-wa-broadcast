import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { dialogStore, confirmDialog, successDialog, errorDialog, infoDialog } from '../src/lib/stores/dialog.js';

describe('Custom Dialog Store', () => {
  it('triggers a confirm dialog and resolves to true on confirm', async () => {
    const promise = confirmDialog({
      title: 'Hapus Item?',
      message: 'Apakah Anda yakin?',
      isDanger: true
    });

    const current = get(dialogStore);
    expect(current).not.toBeNull();
    expect(current.type).toBe('confirm');
    expect(current.title).toBe('Hapus Item?');
    expect(current.isDanger).toBe(true);

    current.onConfirm();
    const result = await promise;
    expect(result).toBe(true);
    expect(get(dialogStore)).toBeNull();
  });

  it('triggers a confirm dialog and resolves to false on cancel', async () => {
    const promise = confirmDialog({
      title: 'Batal Operasi'
    });

    const current = get(dialogStore);
    expect(current).not.toBeNull();

    current.onCancel();
    const result = await promise;
    expect(result).toBe(false);
    expect(get(dialogStore)).toBeNull();
  });

  it('triggers a success dialog and clears store on dismiss', async () => {
    const promise = successDialog({
      title: 'Berhasil!',
      message: 'Pesan terkirim'
    });

    const current = get(dialogStore);
    expect(current.type).toBe('success');
    expect(current.title).toBe('Berhasil!');

    current.onConfirm();
    await promise;
    expect(get(dialogStore)).toBeNull();
  });

  it('triggers an error dialog with details', async () => {
    const promise = errorDialog({
      title: 'Gagal',
      message: 'Koneksi putus',
      details: { code: 'NETWORK_TIMEOUT' }
    });

    const current = get(dialogStore);
    expect(current.type).toBe('error');
    expect(current.details).toContain('NETWORK_TIMEOUT');

    current.onConfirm();
    await promise;
    expect(get(dialogStore)).toBeNull();
  });
});
