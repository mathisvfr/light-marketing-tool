// ErrorBoundary rondom de ToastProvider (autoplan-review recommendation:
// een throw in de reducer mag niet de hele app slopen). Als er in de tree
// eronder iets crasht, tonen we een minimalistische fallback in plaats van
// een lege pagina.
//
// PageErrorBoundary: subtree-level boundary with a retry button. Use around
// individual pages/sections so a crash in generation doesn't take down the
// content queue or publish flow.

import { Component } from 'react';

// Subtree error boundary with retry button (nested inside the global one).
export class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label || 'PageBoundary'}] caught:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '1.5rem',
            margin: '1rem 0',
            border: '1px solid #fee2e2',
            background: '#fef2f2',
            borderRadius: 8,
            fontFamily: 'system-ui',
            color: '#7f1d1d',
          }}
        >
          <h2 style={{ margin: '0 0 .5rem', fontSize: '1.1rem' }}>
            {this.props.title || 'Dit onderdeel kon niet worden geladen'}
          </h2>
          <p style={{ margin: '0 0 1rem' }}>
            Er ging iets mis bij het tonen van dit onderdeel. Probeer het opnieuw
            of ververs de pagina als het probleem aanhoudt.
          </p>
          {this.state.error?.message ? (
            <p style={{ margin: '0 0 1rem', fontSize: '.85rem', opacity: 0.8 }}>
              Foutmelding: {this.state.error.message}
            </p>
          ) : null}
          <button
            onClick={this.handleRetry}
            style={{
              padding: '.5rem 1rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '.9rem',
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Ook naar de console zodat we het lokaal zien; in productie is dit
    // meestal genoeg voor een quick-fix.
    console.error('App-boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            maxWidth: '48rem',
            margin: '3rem auto',
            border: '1px solid #fee2e2',
            background: '#fef2f2',
            borderRadius: 8,
            fontFamily: 'system-ui',
            color: '#7f1d1d',
          }}
        >
          <h1 style={{ margin: '0 0 .5rem', fontSize: '1.2rem' }}>Er ging iets mis</h1>
          <p style={{ margin: 0 }}>
            De pagina kon niet worden getoond. Ververs de browser (Ctrl+Shift+R) om opnieuw te
            proberen. Blijft het probleem? Stuur een screenshot naar de beheerder.
          </p>
          {this.state.error?.message ? (
            <p style={{ marginTop: '.75rem', fontSize: '.875rem', opacity: 0.8 }}>
              Technische melding: {this.state.error.message}
            </p>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
