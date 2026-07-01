import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isInitializing } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Inloggen is mislukt.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        {/* subtle brand glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative flex items-center">
          <span className="inline-flex rounded-md bg-white/95 p-3 shadow-lg ring-1 ring-black/5">
            <Logo variant="default" className="h-11 w-auto" />
          </span>
        </div>

        <div className="relative max-w-md">
          <span
            className="inline-flex items-center bg-primary px-4 py-2 text-xs font-display font-bold uppercase tracking-[0.16em] text-white shadow-lg"
            style={{ clipPath: 'var(--clip-notch)' }}
          >
            Marketing tool
          </span>
          <h2 className="mt-6 font-display text-5xl font-bold leading-[1.05] text-white">
            De juiste mensen, op de juiste plek
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/75">
            Vacatures en marketingcontent voor Light Personeelsdiensten — snel opgesteld, op merk, klaar om te publiceren.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Light Personeelsdiensten B.V. · Rotterdam
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-grey-50 px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-[0_10px_40px_-12px_rgba(31,33,35,0.18)]"
        >
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo variant="default" className="h-14 w-auto" />
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight">Inloggen</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Log in om verder te gaan.</p>

          <div className="mt-8 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="naam@lightpersoneelsdiensten.nl"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="mt-2 h-11 w-full text-base" disabled={isSubmitting || isInitializing}>
              {isSubmitting ? 'Bezig met inloggen...' : 'Inloggen'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
