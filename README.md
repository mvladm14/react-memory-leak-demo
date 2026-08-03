# react-leak-demo

A deliberately leaky React app. Vite + **React 18** + TypeScript, written with
**functional components and hooks**. It exists to be leaked on purpose so
memory-leak tooling has something to catch — and it's wired up to
[`react-memory-leak-detector`](https://www.npmjs.com/package/react-memory-leak-detector)
so the leaks report themselves live in the console (see
[Live leak detection](#live-leak-detection)).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## What's in it (6 components)

Every leaky child starts **unmounted** — mount them yourself from the UI.

| Component | Leaks? | What it does |
| --- | --- | --- |
| `src/App.tsx` | No | Controller. Mounts/unmounts the leaky children; has a **"Mount + unmount all 10×"** stress button. |
| `src/components/LeakyInterval.tsx` | **Yes** | `setInterval` never cleared. |
| `src/components/LeakyTimeout.tsx` | **Yes** | Recursive `setTimeout` never cleared. |
| `src/components/LeakyAnimationFrame.tsx` | **Yes** | `requestAnimationFrame` loop never cancelled. |
| `src/components/LeakyListeners.tsx` | **Yes** | Event-listener / observer / subscription leaks. |
| `src/components/LeakyPromise.tsx` | **Yes** | Slow (>10s) in-flight HTTP request never cancelled. |

## The intentional leaks

Every leak follows the same pattern: inside a `useEffect(… , [])` a callback is
registered on something that outlives the component (a timer queue, `window`,
`document`, an observed DOM node, a shared emitter, a pending promise), and that
callback closes over the component's refs/state setters. The effect **returns no
cleanup function**, so on unmount React has nothing to tear down — the component
and the ~5 MB `Uint8Array` it holds can never be garbage-collected.

**`LeakyInterval`** — `setInterval`, never `clearInterval`'d

**`LeakyTimeout`** — recursive `setTimeout`, never `clearTimeout`'d

**`LeakyAnimationFrame`** — `requestAnimationFrame` loop, never `cancelAnimationFrame`'d

**`LeakyListeners`**

- `window` listeners (`resize`, `scroll`, `mousemove`) — never `removeEventListener`'d
- `document` listener (`visibilitychange`) — never removed
- `ResizeObserver` / `MutationObserver` / `IntersectionObserver` — never `disconnect()`'d
- a module-level pub/sub subscription — never unsubscribed

**`LeakyPromise`** — a single simulated HTTP request that takes >10s. Its
`.then` closes over the component, so while the request is pending the promise
keeps the instance (and its ~5 MB buffer) reachable. Unmount the component
before the request resolves and it leaks for the rest of that window; when the
request finally resolves, the `.then` still runs — it pops an `alert` even
though the component is gone, which is the classic setState-on-an-unmounted-
component side effect made visible.

Its fix uses **`makeCancelable`**, vendored into `src/utils/makeCancelable.ts`
from Happeo's [`@universe/frontend-utils`](https://bitbucket.org/getuniverse/frontend-utils)
(`src/promise.js`). `cancel()` makes the wrapped promise reject with
`{ isCanceled: true }` so the component's `.then` never runs after unmount (no
alert, no setState). (It relies on the request eventually settling — it guards
the callback, it doesn't abort the socket. A permanently hung request needs an
`AbortController` instead.) The package lives on a private registry, so the util
is inlined here to keep the demo self-contained.

Each leaky file's `useEffect` shows the exact fix as a commented-out
`return () => { … }` cleanup. Uncommenting it (and capturing the timer id where
noted) makes React run the cleanup on unmount and fixes that component's leak.

## Live leak detection

This app is configured with
[`react-memory-leak-detector`](https://www.npmjs.com/package/react-memory-leak-detector)
(a dev dependency), so leaks announce themselves in the console — no heap
snapshot needed.

**How it's wired (dev-only, zero prod impact):**

- `vite.config.ts` — the detector's Babel plugin runs via `@vitejs/plugin-react`'s
  `babel.plugins`, gated to `mode === 'development'`. It tags every component/hook
  with a heap marker and a synthetic unmount-tracking effect. `leakAgeMs: 5000`
  means an unmounted-but-retained component is flagged 5s after it should have
  been collected.
- `src/main.tsx` — the runtime is dynamically imported behind `import.meta.env.DEV`,
  so it's dead-code-eliminated from production builds (the prod bundle is byte-for-byte
  the same as without the detector).
- `@vitejs/plugin-react` is pinned to **v5** (Babel-based). v6 switched to Oxc and
  has no `babel` option; v5 still supports Vite 8, so no other downgrade is needed.
- `src/heap-tracker.d.ts` — ambient types for the package's two untyped subpath
  exports.

**Using it** — mount a leaky component, unmount it, and ~5s later:

```
[heap-leak] Suspected leak: LeakyListeners — 1 instance(s) unmounted >5s ago still retained (live 1 total)
```

The tracker lives on `window.__heapTracker`:

| Call | Purpose |
| --- | --- |
| `window.__heapTracker.report()` | `console.table` of every tracked component (`live` vs `stale`). |
| `window.__heapTracker.subscribe(fn)` | Forward stale-leak events anywhere (overlay, logger, Sentry). Returns an unsubscribe fn. |
| `window.__heapTracker.sweep()` | Force an immediate leak sweep. |
| `window.__heapTracker.configure({ … })` | Hot-update options, e.g. `configure({ logging: false })`. |

> **Heads up:** `LeakyInterval`'s `console.log` fires a few times a second and — once
> leaked — never stops, which can bury the `[heap-leak]` warnings in the console.
> Leak a different component to see the warnings cleanly, or remove that log.

## Finding it in a heap snapshot

1. Open the app and mount some (or all) of the leaky components.
2. Open Chrome DevTools → **Memory** and take a **heap snapshot** (baseline).
3. Click **"Mount + unmount all 10×"** a few times.
4. Take another snapshot and compare. Filter for the component names and
   `Uint8Array`: the unmounted instances are still retained, and total heap
   size has grown by roughly 5 MB per leaked instance.

Other views: **Performance monitor** (watch *JS heap size* climb) and
**Rendering → detached elements** (the observer-held DOM nodes).

> **Note on StrictMode:** `main.tsx` keeps `<React.StrictMode>`. In React 18 dev
> mode it intentionally runs each effect twice (setup → cleanup → setup). Since
> these effects return no cleanup, the setup simply runs twice, so a single
> mount already leaks an extra set of timers/listeners/requests. That's expected
> here and actually helps demonstrate the missing cleanup. Production builds run
> effects once, but the leaks still happen on every real unmount.
