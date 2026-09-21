import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '@/components/shared/Logo';
import Card from '@/components/shared/Card';
import '@/components/shared/card.css';

export default function WachtwoordResetten() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-grey-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <Card tone="emphasized" padding="lg" className="shadow-[0_10px_40px_-12px_rgba(31,33,35,0.18)]">
            <div className="mb-8 flex justify-center">
              <Logo variant="default" className="h-14 w-auto" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Ongeldige link</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Deze resetlink is ongeldig. Vraag een nieuwe aan.
            </p>
            <Link
              to="/wachtwoord-vergeten"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 py-2 text-base font-display font-extrabold text-primary-foreground shadow-xs outline-none transition-all hover:bg-brand-red-600 active:bg-brand-red-700 focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              Nieuwe resetlink aanvragen
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens bevatten.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Er ging iets mis.');
      }

      navigate('/login', { state: { message: 'Wachtwoord succesvol gewijzigd. Je kunt nu inloggen.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-grey-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card tone="emphasized" padding="lg" className="shadow-[0_10px_40px_-12px_rgba(31,33,35,0.18)]">
          <div className="mb-8 flex justify-center">
            <Logo variant="default" className="h-14 w-auto" />
          </div>

          <form onSubmit={handleSubmit}>
            <h1 className="font-display text-2xl font-bold tracking-tight">Nieuw wachtwoord instellen</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Kies een nieuw wachtwoord van minimaal 8 tekens.
            </p>

            <div className="mt-6 grid gap-5">
              <div className="grid gap-2">
                <label htmlFor="newPassword" className="text-sm font-display font-bold">
                  Nieuw wachtwoord
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimaal 8 tekens"
                  required
                  minLength={8}
                  className="border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] md:text-sm"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="confirmPassword" className="text-sm font-display font-bold">
                  Wachtwoord bevestigen
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Herhaal je wachtwoord"
                  required
                  minLength={8}
                  className="border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] md:text-sm"
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2 text-base font-display font-extrabold text-primary-foreground shadow-xs outline-none transition-all hover:bg-brand-red-600 active:bg-brand-red-700 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSubmitting ? 'Bezig...' : 'Wachtwoord opslaan'}
              </button>

              <Link
                to="/login"
                className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terug naar inloggen
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
