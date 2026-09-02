import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// Fetcht de status-catalogus uit /api/meta/statuses (server side-of-truth voor
// alle label + tone-mappings). staleTime Infinity omdat een wijziging in de
// catalogus een deploy vereist; er is geen reden om herhaaldelijk te refetchen.
//
// Consumers: <StatusBadge>, <ChannelStatus>, <RoleBadge>. Elk component valt
// terug op een hardcoded default-meta wanneer de query nog loading of errored
// is, zodat je nooit een leeg badge ziet — hoogstens verouderde labels tijdens
// de eerste render.
export default function useStatusMeta() {
  return useQuery({
    queryKey: ['meta-statuses'],
    queryFn: () => api('/meta/statuses'),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
