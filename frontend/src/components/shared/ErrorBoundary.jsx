// ErrorBoundary rondom de ToastProvider (autoplan-review recommendation:
// een throw in de reducer mag niet de hele app slopen). Als er in de tree
// eronder iets crasht, tonen we een minimalistische fallback in plaats van
// een lege pagina.

import { Component } from 'react';

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
