import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import FormMessage from '@/components/shared/FormMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROLE_LABELS } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

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

function roleLabel(role) {
  return ROLE_LABELS?.[role] || role;
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

  if (role !== 'owner') {
    return <p className="text-muted-foreground">Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (usersQuery.isLoading) {
    return <p className="text-muted-foreground">Gebruikers worden geladen...</p>;
  }

  if (usersQuery.isError) {
    return <FormMessage variant="error">Kon gebruikers niet laden.</FormMessage>;
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">Beheer gebruikers en rollen.</p>
        <Button onClick={() => setShowCreateModal(true)}>Gebruiker toevoegen</Button>
      </div>

      <Card>
        <CardContent className="py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Aangemaakt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Geen gebruikers gevonden.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{roleLabel(item.role)}</Badge>
                        <Select
                          value={item.role}
                          onValueChange={(value) => handleRoleChange(item.id, value)}
                          disabled={updateRoleMutation.isPending}
                        >
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Eigenaar</SelectItem>
                            <SelectItem value="recruiter">Recruiter</SelectItem>
                            <SelectItem value="viewer">Kijker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FormMessage variant="error">{error}</FormMessage>
      <FormMessage variant="success">{success}</FormMessage>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe gebruiker</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe gebruiker toe met een tijdelijk wachtwoord en rol.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleCreateUser}>
            <div className="grid gap-2">
              <Label htmlFor="user-name">Naam</Label>
              <Input
                id="user-name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-password">Tijdelijk wachtwoord</Label>
              <Input
                id="user-password"
                type="text"
                value={createForm.temporaryPassword}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    temporaryPassword: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Eigenaar</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="viewer">Kijker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
