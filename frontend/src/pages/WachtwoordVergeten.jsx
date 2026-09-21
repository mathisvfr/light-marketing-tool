import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/shared/Logo';
import Card from '@/components/shared/Card';
import '@/components/shared/card.css';

export default function WachtwoordVergeten() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Er ging iets mis.');
      }

      setSubmitted(true);
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

          {submitted ? (
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Controleer je e-mail</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Als dit e-mailadres bij ons bekend is, ontvang je een resetlink.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 py-2 text-base font-display font-extrabold text-primary-foreground shadow-xs outline-none transition-all hover:bg-brand-red-600 active:bg-brand-red-700 focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                Terug naar inloggen
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="font-display text-2xl font-bold tracking-tight">Wachtwoord vergeten?</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Vul je e-mailadres in en we sturen je een link om je wachtwoord te resetten.
              </p>

              <div className="mt-6 grid gap-5">
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-display font-bold">
                    E-mailadres
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="naam@lightpersoneelsdiensten.nl"
                    required
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
                  {isSubmitting ? 'Bezig...' : 'Resetlink versturen'}
                </button>

                <Link
                  to="/login"
                  className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terug naar inloggen
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
