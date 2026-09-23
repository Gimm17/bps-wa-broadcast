import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Campaigns from '../src/routes/Campaigns.svelte';
import CampaignCreate from '../src/routes/CampaignCreate.svelte';

describe('Campaign UI Screens', () => {
  it('renders Campaigns list screen with KPI telemetry and creation action', () => {
    render(Campaigns);

    expect(screen.getByText('Daftar Campaign Siaran WhatsApp')).toBeDefined();
    expect(screen.getByText('Buat Campaign Baru')).toBeDefined();
    expect(screen.getByText('TOTAL CAMPAIGN')).toBeDefined();
    expect(screen.getByText('SELESAI (SUKSES)')).toBeDefined();
  });

  it('renders CampaignCreate 4-step wizard screen', () => {
    render(CampaignCreate);

    expect(screen.getByText('Buat Campaign Broadcast WhatsApp Baru')).toBeDefined();
    expect(screen.getByText(/Target Segmen & Judul Campaign/)).toBeDefined();
    expect(screen.getByText(/Judul Campaign Broadcast/)).toBeDefined();
    expect(screen.getByText(/Lanjut ke Template/)).toBeDefined();
  });
});
