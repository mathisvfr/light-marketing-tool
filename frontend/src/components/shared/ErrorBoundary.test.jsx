import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary, { PageErrorBoundary } from './ErrorBoundary';

// Suppress React's console.error for expected error boundary triggers
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

function ThrowingComponent({ message }) {
  throw new Error(message || 'Test crash');
}

function WorkingComponent() {
  return <div>Alles werkt</div>;
}

describe('ErrorBoundary (global)', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Alles werkt')).toBeInTheDocument();
  });

  it('shows Dutch error message when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Kapot" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Er ging iets mis')).toBeInTheDocument();
    expect(screen.getByText(/Kapot/)).toBeInTheDocument();
  });
});

describe('PageErrorBoundary (subtree)', () => {
  it('renders children when no error', () => {
    render(
      <PageErrorBoundary label="Test">
        <WorkingComponent />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Alles werkt')).toBeInTheDocument();
  });

  it('shows error with retry button when child throws', () => {
    render(
      <PageErrorBoundary label="Test" title="Pagina kapot">
        <ThrowingComponent />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Pagina kapot')).toBeInTheDocument();
    expect(screen.getByText('Opnieuw proberen')).toBeInTheDocument();
  });

  it('recovers after clicking retry', () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('boom');
      return <div>Hersteld</div>;
    }

    render(
      <PageErrorBoundary label="Test">
        <MaybeThrow />
      </PageErrorBoundary>
    );

    expect(screen.getByText('Opnieuw proberen')).toBeInTheDocument();

    // Fix the error and retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('Opnieuw proberen'));

    expect(screen.getByText('Hersteld')).toBeInTheDocument();
  });
});
