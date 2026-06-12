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
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <Logo className="h-12 w-auto" />

        <div className="max-w-md">
          <p className="text-xs font-display font-bold uppercase tracking-[0.14em] text-white/70">Marketing tool</p>
          <h2 className="mt-3 text-4xl leading-tight text-white">De productie moet draaien. Punt.</h2>
          <p className="mt-4 text-base text-white/80">
            Vacatures en marketingcontent voor Light Personeelsdiensten — snel opgesteld, op merk, klaar om te publiceren.
          </p>
        </div>

        <div
          className="absolute bottom-0 right-0 h-2 w-40 bg-primary"
          style={{ clipPath: 'var(--clip-notch)' }}
          aria-hidden="true"
        />
      </section>

      <section className="flex items-center justify-center bg-grey-50 px-4 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 lg:hidden">
            <Logo className="h-12 w-auto" />
          </div>

          <h1 className="text-2xl">Inloggen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log in om verder te gaan.</p>

          <div className="mt-6 grid gap-4">
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
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="mt-2 w-full" disabled={isSubmitting || isInitializing}>
              {isSubmitting ? 'Bezig met inloggen...' : 'Inloggen'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
