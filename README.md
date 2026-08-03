# react-leak-demo

A deliberately leaky React app. Vite + **React 18** + TypeScript, written with
**class components** (recent enough to migrate to functional components/hooks
later). It exists to be leaked on purpose so memory-leak tooling has something
to catch.

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

Every leak follows the same pattern: a callback is registered on something that
outlives the component (a timer queue, `window`, `document`, an observed DOM
node, a shared emitter) and that callback closes over `this`. The component
**never runs `componentWillUnmount`**, so nothing is torn down — the instance
and the ~5 MB `Uint8Array` it holds can never be garbage-collected after
unmount.

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

Each leaky file has a `teardown()` method containing the exact correct
cleanup. It's deliberately never called — that's the bug. Rename it to
`componentWillUnmount` to fix that component's leak.

## How to see the leak

1. Open the app and mount some (or all) of the leaky components.
2. Open Chrome DevTools → **Memory** and take a **heap snapshot** (baseline).
3. Click **"Mount + unmount all 10×"** a few times.
4. Take another snapshot and compare. Filter for the component names and
   `Uint8Array`: the unmounted instances are still retained, and total heap
   size has grown by roughly 5 MB per leaked instance.

Other views: **Performance monitor** (watch *JS heap size* climb) and
**Rendering → detached elements** (the observer-held DOM nodes).

> **Note on StrictMode:** `main.tsx` keeps `<React.StrictMode>`. In React 18 dev
> mode it intentionally mounts → unmounts → remounts each component once, so the
> very first mount already leaks an extra instance. That's expected here and
> actually helps demonstrate the missing cleanup. Production builds don't
> double-mount, but the leaks still happen on every real unmount.
