import { Component } from "react";
import makeCancelable, {
  type Cancelable,
  type Canceled,
} from "../utils/makeCancelable";

type State = {
  pending: boolean;
};

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
 * The request's `.then` closes over `this`, so while it's pending (>10s) the
 * whole instance — and its ~5 MB `payload` — is reachable from the promise.
 * Unmount the component before the request resolves and it can't be
 * garbage-collected until then. Worse, when the request finally resolves the
 * `.then` still runs (it pops an alert) even though the component is long gone
 * — the classic "setState on an unmounted component" side effect.
 */
class LeakyPromise extends Component<object, State> {
  state: State = { pending: true };

  // ~5 MB per instance, retained by the pending request's continuation.
  private payload = new Uint8Array(5_000_000);

  // Handle to the in-flight request, so `teardown()` could cancel it.
  private inFlight?: Cancelable<string>;

  componentDidMount() {
    // LEAK: the request is never cancelled on unmount.
    this.inFlight = makeCancelable(slowRequest());

    this.inFlight.promise
      .then((result) => {
        void this.payload[0]; // keep the closure retaining the instance
        // Runs even if the component was unmounted mid-request — proof the
        // leaked instance's callback still fires.
        alert(`LeakyPromise: request resolved ("${result}") after ${REQUEST_MS / 1000}s`);
        this.setState({ pending: false });
      })
      .catch((err: Canceled) => {
        // Once `teardown()` is wired up as componentWillUnmount and calls
        // cancel(), the wrapped promise rejects with { isCanceled: true }, so
        // the alert above never fires. Real errors would be handled here.
        if (err?.isCanceled) return;
      });
  }

  // THE BUG: no `componentWillUnmount`. This is the exact fix, built on
  // `@universe/frontend-utils`' makeCancelable — rename it to
  // `componentWillUnmount` — but it is deliberately never called.
  teardown() {
    this.inFlight?.cancel();
  }

  render() {
    return (
      <div className="leaky-card">
        <h3>🌐 LeakyPromise</h3>
        <p>
          request:{" "}
          <strong>{this.state.pending ? "pending…" : "resolved"}</strong>
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
}

export default LeakyPromise;
