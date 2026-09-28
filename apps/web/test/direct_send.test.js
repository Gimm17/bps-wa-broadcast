import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DirectSend from '../src/routes/DirectSend.svelte';

describe('DirectSend UI Screen', () => {
  it('renders DirectSend screen with operational header and controls', () => {
    render(DirectSend);

    expect(screen.getByText('Kirim Manual & Uji Pesan WhatsApp')).toBeDefined();
    expect(screen.getByText('Nova Media MPWA Gateway')).toBeDefined();
    expect(screen.getByText(/Nomor WhatsApp Tujuan/)).toBeDefined();
    expect(screen.getByText('Cek Nomor WA')).toBeDefined();
    expect(screen.getByText('Pesan Teks Bebas')).toBeDefined();
    expect(screen.getByText('Template Resmi WABA')).toBeDefined();
    expect(screen.getByText('Kirim Pesan Sekarang')).toBeDefined();
    expect(screen.getByText('Pratinjau Langsung')).toBeDefined();
    expect(screen.getByText('BPS Sulteng')).toBeDefined();
  });
});
