import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import HealthBanner from './HealthBanner';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('HealthBanner', () => {
  it('renders nothing when status is ok', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', checks: { database: 'ok', ai: 'ok', buffer: 'ok' } }),
      })
    );

    const { container } = renderWithProviders(<HealthBanner />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows warning when a service is degraded', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'degraded',
            checks: { database: 'ok', ai: 'no_key', ai_provider: 'anthropic', buffer: 'ok' },
          }),
      })
    );

    renderWithProviders(<HealthBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/AI-generatie/)).toBeInTheDocument();
    expect(screen.getByText(/API-key ontbreekt/)).toBeInTheDocument();
  });

  it('shows warning when database is down', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'degraded',
            checks: { database: 'down', ai: 'ok', ai_provider: 'anthropic', buffer: 'ok' },
          }),
      })
    );

    renderWithProviders(<HealthBanner />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Database/)).toBeInTheDocument();
    expect(screen.getByText(/niet bereikbaar/)).toBeInTheDocument();
  });
});
