/**
 * Centralised TanStack Query key factories.
 *
 * Usage:
 *   useQuery({ ...queryKeys.drafts.list({ status: 'pending' }) })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all })
 *
 * Each factory returns a `queryKey` array. The `list` and `detail` helpers
 * also bundle a `staleTime` so cache freshness is consistent across the app.
 */

// ── Drafts ──────────────────────────────────────────────────────────
const draftsAll = ['drafts'];
const drafts = {
  all: draftsAll,
  lists: () => [...draftsAll, 'list'],
  list: (filters = {}) => ({
    queryKey: [...draftsAll, 'list', filters],
    staleTime: 30_000, // 30s — drafts change frequently
  }),
  details: () => [...draftsAll, 'detail'],
  detail: (id) => ({
    queryKey: [...draftsAll, 'detail', id],
    staleTime: 15_000, // 15s — open draft may be edited
  }),
};

// ── Publications ────────────────────────────────────────────────────
const publicationsAll = ['publications'];
const publications = {
  all: publicationsAll,
  lists: () => [...publicationsAll, 'list'],
  list: (filters = {}) => ({
    queryKey: [...publicationsAll, 'list', filters],
    staleTime: 60_000, // 1min — published items don't change often
  }),
  detail: (id) => ({
    queryKey: [...publicationsAll, 'detail', id],
    staleTime: 60_000,
  }),
};

// ── Dashboard ───────────────────────────────────────────────────────
const dashboardAll = ['dashboard'];
const dashboard = {
  all: dashboardAll,
  summary: () => ({
    queryKey: [...dashboardAll, 'summary'],
    staleTime: 60_000, // 1min
  }),
  queue: () => ({
    queryKey: [...dashboardAll, 'queue'],
    staleTime: 30_000,
  }),
  activity: () => ({
    queryKey: [...dashboardAll, 'activity'],
    staleTime: 30_000,
  }),
};

// ── Brand settings ──────────────────────────────────────────────────
const brandAll = ['brand'];
const brand = {
  all: brandAll,
  settings: () => ({
    queryKey: [...brandAll, 'settings'],
    staleTime: 5 * 60_000, // 5min — rarely changes
  }),
  channels: () => ({
    queryKey: [...brandAll, 'channels'],
    staleTime: 5 * 60_000,
  }),
};

// ── Users ───────────────────────────────────────────────────────────
const usersAll = ['users'];
const users = {
  all: usersAll,
  list: () => ({
    queryKey: [...usersAll, 'list'],
    staleTime: 2 * 60_000, // 2min
  }),
  detail: (id) => ({
    queryKey: [...usersAll, 'detail', id],
    staleTime: 2 * 60_000,
  }),
};

// ── Media ───────────────────────────────────────────────────────────
const mediaAll = ['media'];
const media = {
  all: mediaAll,
  list: (filters = {}) => ({
    queryKey: [...mediaAll, 'list', filters],
    staleTime: 60_000,
  }),
};

// ── Integrations / Channels ─────────────────────────────────────────
const integrationsAll = ['integrations'];
const integrations = {
  all: integrationsAll,
  channels: () => ({
    queryKey: [...integrationsAll, 'channels'],
    staleTime: 5 * 60_000,
  }),
  status: () => ({
    queryKey: [...integrationsAll, 'status'],
    staleTime: 2 * 60_000,
  }),
};

// ── Rapportage ──────────────────────────────────────────────────────
const rapportageAll = ['rapportage'];
const rapportage = {
  all: rapportageAll,
  overview: (range) => ({
    queryKey: [...rapportageAll, 'overview', range],
    staleTime: 5 * 60_000, // 5min — snapshots are nightly
  }),
};

// ── Calendar ─────────────────────────────────────────────────────────
const calendarAll = ['calendar'];
const calendar = {
  all: calendarAll,
  range: (from, to) => ({
    queryKey: [...calendarAll, { from, to }],
    staleTime: 30_000, // 30s — calendar items change when scheduling
  }),
  slots: (from, to, channel) => ({
    queryKey: [...calendarAll, 'slots', { from, to, channel }],
    staleTime: 15_000,
  }),
  unscheduled: () => ({
    queryKey: [...calendarAll, 'unscheduled'],
    staleTime: 30_000,
  }),
};

// ── Health ──────────────────────────────────────────────────────────
const health = {
  check: () => ({
    queryKey: ['health'],
    staleTime: 60_000,
  }),
};

export const queryKeys = {
  drafts,
  publications,
  dashboard,
  brand,
  users,
  media,
  integrations,
  calendar,
  rapportage,
  health,
};
