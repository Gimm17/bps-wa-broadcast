import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Sidebar from '../../apps/web/src/lib/components/Sidebar.svelte';
import StatusChip from '../../apps/web/src/lib/components/StatusChip.svelte';
import DataTable from '../../apps/web/src/lib/components/DataTable.svelte';
import HealthStrip from '../../apps/web/src/lib/components/HealthStrip.svelte';
import MessageTimeline from '../../apps/web/src/lib/components/MessageTimeline.svelte';

describe('E2E Acceptance: WCAG AA Accessibility & Design Tokens', () => {
  it('1. Sidebar has accessible navigation landmark and labels', () => {
    render(Sidebar, { props: { isOpen: true, currentPath: '/overview' } });
    const nav = screen.getByLabelText('Navigasi utama');
    expect(nav).toBeDefined();

    // Verify key interactive navigation links exist with accessible names
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Campaigns')).toBeDefined();
    expect(screen.getByText('Schedules & Calendar')).toBeDefined();
    expect(screen.getByText('Automations')).toBeDefined();
    expect(screen.getByText('Contacts')).toBeDefined();
    expect(screen.getByText('Message Logs')).toBeDefined();
  });

  it('2. Status indicators provide textual state (never color alone)', () => {
    const states = [
      { status: 'operational', text: 'Terhubung' },
      { status: 'degraded', text: 'Terganggu' },
      { status: 'down', text: 'Terputus' }
    ];

    for (const s of states) {
      const { container } = render(StatusChip, { props: s });
      // Verify visible text is present
      expect(container.textContent).toContain(s.text);
    }
  });

  it('3. DataTable uses semantic HTML table structure with caption and th elements', () => {
    const columns = [
      { key: 'name', label: 'Nama Kontak' },
      { key: 'phone', label: 'Nomor WhatsApp' },
      { key: 'status', label: 'Status' }
    ];

    const { container } = render(DataTable, {
      props: {
        columns,
        caption: 'Tabel Rekapitulasi Broadcast',
        isEmpty: true,
        emptyMessage: 'Tidak ada data siaran'
      }
    });

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.textContent).toContain('Tabel Rekapitulasi Broadcast');

    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(3);
    expect(ths[0].textContent).toContain('Nama Kontak');
  });

  it('4. HealthStrip provides status indicators for critical system connectors', () => {
    const healthData = {
      overall: 'healthy',
      checks: {
        database: { status: 'healthy', label: 'PostgreSQL 17' },
        meta_api: { status: 'healthy', label: 'Meta Cloud API' },
        cron_worker: { status: 'healthy', label: 'Cron Worker (WITA)' }
      }
    };

    const { container } = render(HealthStrip, { props: { health: healthData } });
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Sistem');
  });

  it('5. MessageTimeline provides an accessible timeline of delivery milestones', () => {
    const events = [
      { status: 'queued', timestamp: '2026-09-23T08:00:00Z' },
      { status: 'sent', timestamp: '2026-09-23T08:00:05Z' },
      { status: 'delivered', timestamp: '2026-09-23T08:00:10Z' },
      { status: 'read', timestamp: '2026-09-23T08:01:00Z' }
    ];

    const { container } = render(MessageTimeline, { props: { events } });
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Dibaca');
    expect(container.textContent).toContain('Terkirim (Delivered)');
  });
});
