'use strict';

const crypto = require('node:crypto');

// Minimal in-memory stand-in for the Supabase PostgREST client, supporting only
// the chained builder calls the backend routes actually use:
//   .from(table).select(cols).eq(col,val).maybeSingle()
//   .from(table).insert(payload).select(cols).single()
//   .from(table).update(payload).eq(col,val).select(cols).single()/.maybeSingle()
//   await .from(table).select(cols).order(...).limit(...)   (thenable)
//   .is(col, null) / .in(col, arr) / .not(col, 'is', null)
//
// It is intentionally small: enough to make the smoke tests deterministic without
// hitting a real database. It is NOT a full Supabase implementation.

function matchesFilters(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col];
    if (filter.kind === 'eq') {
      return value === filter.val;
    }
    if (filter.kind === 'in') {
      return Array.isArray(filter.val) && filter.val.includes(value);
    }
    if (filter.kind === 'is') {
      // Only null is used in the routes.
      return filter.val === null ? value === null || value === undefined : value === filter.val;
    }
    if (filter.kind === 'notIsNull') {
      return value !== null && value !== undefined;
    }
    return true;
  });
}

function createFakeSupabase(store) {
  const tables = store;

  function from(table) {
    if (!tables[table]) {
      tables[table] = [];
    }

    const state = {
      table,
      op: 'select',
      payload: null,
      filters: [],
    };

    const builder = {
      select() {
        return builder;
      },
      insert(payload) {
        state.op = 'insert';
        state.payload = payload;
        return builder;
      },
      update(payload) {
        state.op = 'update';
        state.payload = payload;
        return builder;
      },
      delete() {
        state.op = 'delete';
        return builder;
      },
      eq(col, val) {
        state.filters.push({ kind: 'eq', col, val });
        return builder;
      },
      in(col, val) {
        state.filters.push({ kind: 'in', col, val });
        return builder;
      },
      is(col, val) {
        state.filters.push({ kind: 'is', col, val });
        return builder;
      },
      not(col, op, val) {
        if (op === 'is' && val === null) {
          state.filters.push({ kind: 'notIsNull', col });
        }
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      _resolveRows() {
        const rows = tables[state.table] || [];

        if (state.op === 'insert') {
          const inserted = (Array.isArray(state.payload) ? state.payload : [state.payload]).map((entry) => ({
            id: entry.id || crypto.randomUUID(),
            created_at: entry.created_at || new Date().toISOString(),
            ...entry,
          }));
          tables[state.table] = rows.concat(inserted);
          return inserted;
        }

        const matched = rows.filter((row) => matchesFilters(row, state.filters));

        if (state.op === 'update') {
          for (const row of matched) {
            Object.assign(row, state.payload);
          }
          return matched;
        }

        if (state.op === 'delete') {
          tables[state.table] = rows.filter((row) => !matchesFilters(row, state.filters));
          return matched;
        }

        return matched;
      },
      async maybeSingle() {
        const rows = builder._resolveRows();
        return { data: rows[0] || null, error: null };
      },
      async single() {
        const rows = builder._resolveRows();
        if (!rows[0]) {
          return { data: null, error: { message: 'No rows found' } };
        }
        return { data: rows[0], error: null };
      },
      then(onFulfilled, onRejected) {
        try {
          const rows = builder._resolveRows();
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
        } catch (error) {
          return Promise.resolve({ data: null, error }).then(onFulfilled, onRejected);
        }
      },
    };

    return builder;
  }

  return { from };
}

module.exports = { createFakeSupabase };
