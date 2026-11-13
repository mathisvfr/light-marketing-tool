# Backend Vitest Migration — Design Spec

**Status:** Specced, ready for implementation
**Date:** 2026-11-13
**Effort:** ~2-3 hours

## Current state

- 13 test files in `backend/test/`, 102 tests total
- Runner: Node's built-in `node --test` (Node 22)
- Assertions: `node:assert/strict`
- Mocking: require-cache patching via `test-helpers/harness.js` `mockModule()`
- Fake DB: `test-helpers/fakeSupabase.js` — in-memory store
- Backend is **CommonJS** (`"type": "commonjs"`)

## Why migrate

- **Unified runner**: frontend already uses Vitest 5 — one tool for both
- **Better DX**: watch mode, filtering, coverage, snapshot testing
- **Faster feedback**: Vitest's worker pool parallelises test files
- **Richer assertions**: `expect()` chain syntax is more readable than `assert`
- **Built-in mocking**: `vi.mock()`, `vi.fn()`, `vi.spyOn()` replace manual require-cache patching

## Migration strategy

### Phase 1: Add Vitest alongside `node --test` (non-breaking)

1. `cd backend && npm install -D vitest`
2. Create `backend/vitest.config.js`:
   ```js
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       globals: true,
       include: ['test/**/*.test.js'],
       testTimeout: 15_000,
       hookTimeout: 10_000,
       // CJS support — Vitest transforms CJS require() automatically
       deps: { interopDefault: true },
     },
   });
   ```
3. Add `"test:vitest": "vitest run"` to package.json scripts
4. Verify existing tests still pass with `node --test`

### Phase 2: Migrate test files (one at a time)

For each test file:
1. Replace `const { test, describe, before, after } = require('node:test')` with Vitest globals (`test`, `describe`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`)
2. Replace `assert.equal(a, b)` → `expect(a).toBe(b)`
3. Replace `assert.ok(x)` → `expect(x).toBeTruthy()`
4. Replace `assert.deepStrictEqual(a, b)` → `expect(a).toEqual(b)`
5. Replace `assert.rejects(fn)` → `expect(fn).rejects.toThrow()`

### Phase 3: Migrate mocking pattern

The biggest risk is the `mockModule()` require-cache pattern:
```js
// Current (harness.js)
function mockModule(relativePath, exportsValue) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = { ... exports: exportsValue };
}
```

Vitest equivalent:
```js
// Option A: vi.mock with factory (hoisted)
vi.mock('../src/services/claude', () => ({
  generate: vi.fn().mockResolvedValue({ ... }),
  criticus: vi.fn().mockResolvedValue({ passed: true, notes: '' }),
}));

// Option B: Keep require-cache in CJS (Vitest supports it)
// Since the backend is CJS, require.cache manipulation still works
// in Vitest. Test this first — may need no migration at all.
```

**Recommended**: Try Option B first. If Vitest runs CJS test files and the require-cache mocking still works, the migration is purely syntactic (test/assert → test/expect).

### Phase 4: Switch default test script

Once all tests pass with Vitest:
```json
{
  "test": "vitest run",
  "test:legacy": "node --test"
}
```

## API mapping cheat sheet

| node:test | Vitest |
|-----------|--------|
| `test(name, fn)` | `test(name, fn)` (same) |
| `describe(name, fn)` | `describe(name, fn)` (same) |
| `before(fn)` | `beforeAll(fn)` |
| `after(fn)` | `afterAll(fn)` |
| `beforeEach(fn)` | `beforeEach(fn)` (same) |
| `afterEach(fn)` | `afterEach(fn)` (same) |
| `assert.equal(a, b)` | `expect(a).toBe(b)` |
| `assert.deepStrictEqual(a, b)` | `expect(a).toEqual(b)` |
| `assert.ok(x)` | `expect(x).toBeTruthy()` |
| `assert.strictEqual(a, b)` | `expect(a).toBe(b)` |
| `assert.match(str, re)` | `expect(str).toMatch(re)` |
| `assert.rejects(fn)` | `await expect(fn()).rejects.toThrow()` |

## Risks

- **require-cache mocking**: May or may not work in Vitest's CJS transform. Test early.
- **Process isolation**: `node --test` runs each file in a separate process. Vitest uses workers but shares some state. The `setup()` function in harness.js sets process.env — verify no cross-test leakage.
- **Startup env**: Tests set `process.env` before `require('../src/index')`. Vitest's module transform may change timing. Validate.

## Tests needed

- All 102 existing tests pass under Vitest
- No flaky tests from shared state
- Coverage report (`vitest run --coverage`) works
