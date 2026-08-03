import { useEffect, useRef, useState } from "react";
import makeCancelable, { type Canceled } from "../utils/makeCancelable";

// How long the "request" takes. Longer than 10s so there's a comfortable
// window in which you can unmount the component and watch it keep leaking.
const REQUEST_MS = 12_000;

// Pretend to make a slow HTTP request — resolves after REQUEST_MS, like a slow
// API endpoint. Swap in a real `fetch(...)` of the same shape if you like.
const slowRequest = (): Promise<string> =>
  new Promise((resolve) => setTimeout(() => resolve("ok"), REQUEST_MS));

/**
 * LeakyPromise — leaks via a single in-flight HTTP request.
 *
 * The request's `.then` closes over this component, so while it's pending
 * (>10s) the whole thing — including its ~5 MB `payload` — is reachable from
 * the promise. Unmount before it resolves and it can't be garbage-collected
 * until then. Worse, when the request finally resolves the `.then` still runs
 * (it pops an alert) even though the component is long gone.
 */
function LeakyPromise() {
  const [pending, setPending] = useState(true);

  // ~5 MB per instance, retained by the pending request's continuation.
  const payloadRef = useRef<Uint8Array | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = new Uint8Array(5_000_000);
  }

  useEffect(() => {
    // LEAK: the request is never cancelled on unmount.
    const inFlight = makeCancelable(slowRequest());

    inFlight.promise
      .then((result) => {
        void payloadRef.current; // keep the closure retaining the component
        // Runs even if the component was unmounted mid-request — proof the
        // leaked callback still fires.
        alert(
          `LeakyPromise: request resolved ("${result}") after ${REQUEST_MS / 1000}s`,
        );
        setPending(false);
      })
      .catch((err: Canceled) => {
        // Real errors would be handled here. On the fixed path, cancel() makes
        // this reject with { isCanceled: true } and we simply stop.
        if (err?.isCanceled) return;
      });

    // THE BUG: no cleanup returned. The fix, built on
    // `@universe/frontend-utils`' makeCancelable, is to cancel on unmount so the
    // .then never runs (no alert, no setState) — deliberately omitted:
    //
    //   return () => inFlight.cancel();
  }, []);

  return (
    <div className="leaky-card">
      <h3>🌐 LeakyPromise</h3>
      <p>
        request: <strong>{pending ? "pending…" : "resolved"}</strong>
      </p>
      <p className="leaky-note">
        A simulated HTTP request that takes {REQUEST_MS / 1000}s. Unmount it
        before then and the instance leaks for the rest of that window — then
        its <code>.then</code> still fires an alert. Holds ~5&nbsp;MB. Fix:{" "}
        <code>makeCancelable().cancel()</code>.
      </p>
    </div>
  );
}

export default LeakyPromise;
