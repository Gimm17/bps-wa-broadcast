import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Sidebar from '../src/lib/components/Sidebar.svelte';
import StatusChip from '../src/lib/components/StatusChip.svelte';
import DataTable from '../src/lib/components/DataTable.svelte';

describe('Accessibility & Core Components', () => {
  it('renders sidebar with aria-label Navigasi utama', () => {
    render(Sidebar, { props: { isOpen: true } });
    const nav = screen.getByLabelText('Navigasi utama');
    expect(nav).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Campaigns')).toBeDefined();
  });

  it('renders StatusChip with status text', () => {
    render(StatusChip, { props: { status: 'operational', text: 'Terhubung' } });
    expect(screen.getByText('Terhubung')).toBeDefined();
  });

  it('renders DataTable with caption and columns', () => {
    const cols = [{ label: 'Nama' }, { label: 'Status' }];
    render(DataTable, {
      props: {
        columns: cols,
        caption: 'Daftar Siaran',
        isEmpty: true,
        emptyMessage: 'Belum ada data'
      }
    });

    expect(screen.getByText('Daftar Siaran')).toBeDefined();
    expect(screen.getByText('Nama')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Belum ada data')).toBeDefined();
  });
});
