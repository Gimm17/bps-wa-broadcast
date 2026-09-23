import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Contacts from '../src/routes/Contacts.svelte';

describe('Contacts Component', () => {
  it('renders directory heading and operational tabs', () => {
    render(Contacts);

    expect(screen.getByText('Direktori Kontak & Manajemen Konsensus')).toBeDefined();
    expect(screen.getByText('Semua Kontak')).toBeDefined();
    expect(screen.getByText('Pegawai ASN Sulteng')).toBeDefined();
    expect(screen.getByText('Masyarakat Terdaftar')).toBeDefined();
    expect(screen.getByText('Ekspor CSV')).toBeDefined();
    expect(screen.getByText('Import Kontak Baru')).toBeDefined();
  });
});
