import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import './gebruikers.css';

function formatDate(value) {
  if (!value) {
    return 'Onbekend';
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function Gebruikers() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    temporaryPassword: '',
    role: 'viewer',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api('/users'),
    enabled: role === 'owner',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api('/users', {
        method: 'POST',
        body: JSON.stringify(createForm),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, nextRole }) =>
      api(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) =>
      api(`/users/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
  });

  if (role !== 'owner') {
    return <p>Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (usersQuery.isLoading) {
    return <p>Gebruikers worden geladen...</p>;
  }

  if (usersQuery.isError) {
    return <p className="users-error">Kon gebruikers niet laden.</p>;
  }

  const users = usersQuery.data?.users || [];

  async function handleCreateUser(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await createMutation.mutateAsync();
      setCreateForm({ name: '', email: '', temporaryPassword: '', role: 'viewer' });
      setShowCreateModal(false);
      setSuccess('Gebruiker toegevoegd.');
    } catch (err) {
      setError(err.message || 'Gebruiker toevoegen mislukt.');
    }
  }

  async function handleRoleChange(userId, nextRole) {
    setError('');
    setSuccess('');

    try {
      await updateRoleMutation.mutateAsync({ userId, nextRole });
      setSuccess('Rol bijgewerkt.');
    } catch (err) {
      setError(err.message || 'Rol wijzigen mislukt.');
    }
  }

  async function handleDeleteUser(userId, userName) {
    setError('');
    setSuccess('');

    if (!window.confirm(`Weet je zeker dat je ${userName} wilt verwijderen?`)) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      setSuccess('Gebruiker verwijderd.');
    } catch (err) {
      setError(err.message || 'Gebruiker verwijderen mislukt.');
    }
  }

  return (
    <div className="users-layout">
      <div className="users-toolbar">
        <p>Beheer gebruikers en rollen.</p>
        <button type="button" onClick={() => setShowCreateModal(true)}>
          Gebruiker toevoegen
        </button>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Rol</th>
              <th>Aangemaakt</th>
              <th>Actie</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5}>Geen gebruikers gevonden.</td>
              </tr>
            ) : (
              users.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.email}</td>
                  <td>
                    <span className={`role-pill ${item.role}`}>{item.role}</span>
                    {' '}
                    <select
                      value={item.role}
                      onChange={(event) => handleRoleChange(item.id, event.target.value)}
                      disabled={updateRoleMutation.isPending || deleteUserMutation.isPending}
                    >
                      <option value="owner">owner</option>
                      <option value="recruiter">recruiter</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(item.id, item.name)}
                      disabled={updateRoleMutation.isPending || deleteUserMutation.isPending}
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal ? (
        <div className="users-modal-backdrop" role="dialog" aria-modal="true">
          <form className="users-modal" onSubmit={handleCreateUser}>
            <h3>Nieuwe gebruiker</h3>

            <label>
              Naam
              <input
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Tijdelijk wachtwoord
              <input
                type="text"
                value={createForm.temporaryPassword}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Rol
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, role: event.target.value }))
                }
              >
                <option value="owner">owner</option>
                <option value="recruiter">recruiter</option>
                <option value="viewer">viewer</option>
              </select>
            </label>

            <div className="users-modal-actions">
              <button type="button" onClick={() => setShowCreateModal(false)}>
                Annuleren
              </button>
              <button type="submit" disabled={createMutation.isPending}>
                Opslaan
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {error ? <p className="users-error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </div>
  );
}
