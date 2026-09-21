import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/shared/Toast';
import Card, { CardHeader, CardBody } from '../components/shared/Card';
import RoleBadge from '../components/shared/RoleBadge';
import '../components/shared/card.css';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateShort(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function UserAvatar({ avatarPath, name, size = 128 }) {
  const initials = (name || '?').charAt(0).toUpperCase();

  if (avatarPath) {
    return (
      <img
        src={avatarPath}
        alt={`Avatar van ${name}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '3px solid var(--light-red-100, #fecaca)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--light-red, #d42b2b)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        border: '3px solid var(--light-red-100, #fecaca)',
      }}
    >
      {initials}
    </div>
  );
}

export default function Profiel() {
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => api('/profile'),
  });

  const profile = profileQuery.data?.user;

  // Set name from fetched profile (once)
  if (profile && !nameLoaded) {
    setName(profile.name || '');
    setNameLoaded(true);
  }

  const updateNameMutation = useMutation({
    mutationFn: () =>
      api('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      refreshSession();
      toast.success('Naam bijgewerkt.');
    },
    onError: (err) => toast.error(err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      api('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Wachtwoord gewijzigd.');
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload mislukt.');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      refreshSession();
      toast.success('Avatar geüpload.');
    },
    onError: (err) => toast.error(err.message),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () =>
      api('/profile/avatar', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      refreshSession();
      toast.success('Avatar verwijderd.');
    },
    onError: (err) => toast.error(err.message),
  });

  const emailChangeMutation = useMutation({
    mutationFn: () =>
      api('/profile/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      }),
    onSuccess: (data) => {
      toast.success(data?.message || 'Verificatiemail verstuurd.');
      setShowEmailChange(false);
      setNewEmail('');
    },
    onError: (err) => toast.error(err.message),
  });

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      uploadAvatarMutation.mutate(file);
    }
  }

  function handlePasswordSubmit(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Wachtwoord moet minimaal 8 tekens bevatten.');
      return;
    }
    changePasswordMutation.mutate();
  }

  if (profileQuery.isLoading) {
    return <p style={{ padding: '2rem', color: '#6b7280' }}>Laden...</p>;
  }

  if (!profile) {
    return <p style={{ padding: '2rem', color: '#b91c1c' }}>Profiel kon niet geladen worden.</p>;
  }

  const inputClass =
    'border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] md:text-sm';

  const btnPrimary =
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2 text-sm font-display font-extrabold text-primary-foreground shadow-xs outline-none transition-all hover:bg-brand-red-600 active:bg-brand-red-700 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';

  const btnOutline =
    'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-white px-4 py-2 text-sm font-display font-bold shadow-xs outline-none transition-all hover:bg-grey-50 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 640 }}>
      {/* Avatar + basic info */}
      <Card>
        <CardHeader title="Profiel" />
        <CardBody>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <UserAvatar avatarPath={profile.avatar_path} name={profile.name} size={128} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={btnOutline}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAvatarMutation.isPending}
              >
                {uploadAvatarMutation.isPending ? 'Uploaden...' : 'Foto uploaden'}
              </button>
              {profile.avatar_path ? (
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => removeAvatarMutation.mutate()}
                  disabled={removeAvatarMutation.isPending}
                  style={{ color: 'var(--light-red)' }}
                >
                  Foto verwijderen
                </button>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Name edit */}
      <Card>
        <CardHeader title="Gegevens" />
        <CardBody>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gap: '.35rem' }}>
              <label htmlFor="profile-name" className="text-sm font-display font-bold">Naam</label>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => updateNameMutation.mutate()}
                  disabled={updateNameMutation.isPending || !name.trim() || name.trim() === profile.name}
                >
                  Opslaan
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '.35rem' }}>
              <span className="text-sm font-display font-bold">E-mailadres</span>
              <span className="text-sm text-muted-foreground">{profile.email}</span>
              {!showEmailChange ? (
                <button
                  type="button"
                  className="text-sm"
                  style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                  onClick={() => setShowEmailChange(true)}
                >
                  E-mail wijzigen
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.25rem' }}>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nieuw@voorbeeld.nl"
                    className="input"
                    style={{ flex: 1, maxWidth: 280 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={emailChangeMutation.isPending || !newEmail.trim()}
                    onClick={() => emailChangeMutation.mutate()}
                  >
                    {emailChangeMutation.isPending ? 'Versturen...' : 'Versturen'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setShowEmailChange(false); setNewEmail(''); }}
                  >
                    Annuleren
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '.35rem' }}>
              <span className="text-sm font-display font-bold">Rol</span>
              <div><RoleBadge role={profile.role} /></div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '.35rem' }}>
                <span className="text-sm font-display font-bold">Lid sinds</span>
                <span className="text-sm text-muted-foreground">{formatDateShort(profile.created_at)}</span>
              </div>
              <div style={{ display: 'grid', gap: '.35rem' }}>
                <span className="text-sm font-display font-bold">Laatst ingelogd</span>
                <span className="text-sm text-muted-foreground">{formatDate(profile.last_login_at)}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader title="Wachtwoord wijzigen" />
        <CardBody>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 400 }}>
            <div style={{ display: 'grid', gap: '.35rem' }}>
              <label htmlFor="current-password" className="text-sm font-display font-bold">
                Huidig wachtwoord
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </div>

            <div style={{ display: 'grid', gap: '.35rem' }}>
              <label htmlFor="new-password" className="text-sm font-display font-bold">
                Nieuw wachtwoord
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Minimaal 8 tekens"
                className={inputClass}
              />
            </div>

            <div style={{ display: 'grid', gap: '.35rem' }}>
              <label htmlFor="confirm-password" className="text-sm font-display font-bold">
                Wachtwoord bevestigen
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Herhaal je wachtwoord"
                className={inputClass}
              />
            </div>

            <div>
              <button
                type="submit"
                className={btnPrimary}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              >
                {changePasswordMutation.isPending ? 'Bezig...' : 'Wachtwoord wijzigen'}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export { UserAvatar };
