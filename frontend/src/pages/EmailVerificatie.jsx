import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import FormMessage from '../components/shared/FormMessage';

export default function EmailVerificatie() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // If no token in URL, render error immediately without an effect
  const initialStatus = token ? 'loading' : 'error';
  const initialMessage = token ? '' : 'Geen verificatietoken gevonden in de URL.';

  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState(initialMessage);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    api('/profile/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        setStatus('success');
        setMessage(data?.message || 'E-mailadres succesvol gewijzigd.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Verificatie mislukt.');
      });
  }, [token]);

  return (
    <div className="email-verificatie-page">
      <h2>E-mailverificatie</h2>

      {status === 'loading' && <p>Bezig met verwerken...</p>}

      {status === 'success' && (
        <>
          <FormMessage variant="success">{message}</FormMessage>
          <Link to="/profiel">Terug naar je profiel</Link>
        </>
      )}

      {status === 'error' && (
        <>
          <FormMessage variant="error">{message}</FormMessage>
          <Link to="/profiel">Terug naar je profiel</Link>
        </>
      )}
    </div>
  );
}
