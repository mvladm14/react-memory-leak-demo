import { Component, createRef } from "react";

type Props = {
  label?: string;
};

type State = {
  events: number;
  pings: number;
};

/**
 * LeakyListeners — intentionally leaks memory via event listeners,
 * observers, and a pub/sub subscription.
 *
 * Every listener/observer/subscription below is registered on something that
 * outlives the component (window, document, the observed DOM node, the shared
 * emitter) and closes over `this`. Since none of them are ever removed,
 * disconnected, or unsubscribed, the instance and its ~5 MB `payload` leak on
 * every unmount.
 */
class LeakyListeners extends Component<Props, State> {
  state: State = { events: 0, pings: 0 };

  // ~5 MB buffer per instance, retained by every handler below.
  private payload = new Uint8Array(5_000_000);

  private boxRef = createRef<HTMLDivElement>();
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private intersectionObserver?: IntersectionObserver;
  private unsubscribe?: () => void;

  private bump = () => {
    void this.payload[0]; // keep the closure retaining the instance
    this.setState((s) => ({ events: s.events + 1 }));
  };

  componentDidMount() {
    // LEAK 1: window/document event listeners — never removed.
    window.addEventListener("resize", this.bump);
    window.addEventListener("scroll", this.bump);
    window.addEventListener("mousemove", this.bump);
    document.addEventListener("visibilitychange", this.bump);

    // LEAK 2: observers on a DOM node — never disconnected.
    const node = this.boxRef.current;
    if (node) {
      this.resizeObserver = new ResizeObserver(this.bump);
      this.resizeObserver.observe(node);

      this.mutationObserver = new MutationObserver(this.bump);
      this.mutationObserver.observe(node, { childList: true, subtree: true });

      this.intersectionObserver = new IntersectionObserver(this.bump);
      this.intersectionObserver.observe(node);
    }

    // LEAK 3: pub/sub subscription — never unsubscribed. `subscribe` returns
    // an unsubscribe fn we simply throw away.
    this.unsubscribe = emitter.subscribe(() => {
      void this.payload[0];
      this.setState((s) => ({ pings: s.pings + 1 }));
    });

    // Emit periodically so subscribers stay "warm" — this interval is also
    // never cleared, but the point here is the retained subscription list.
    startEmitting();
  }

  // ---------------------------------------------------------------------------
  // THE BUG: there is deliberately NO `componentWillUnmount`. The method below
  // is exactly what it should be — but it is never called anywhere, so nothing
  // is ever removed/disconnected/unsubscribed. To fix every leak in this file,
  // simply rename `teardown` to `componentWillUnmount`.
  // ---------------------------------------------------------------------------
  teardown() {
    window.removeEventListener("resize", this.bump);
    window.removeEventListener("scroll", this.bump);
    window.removeEventListener("mousemove", this.bump);
    document.removeEventListener("visibilitychange", this.bump);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.unsubscribe?.();
  }

  render() {
    return (
      <div className="leaky-card" ref={this.boxRef}>
        <h3>📡 LeakyListeners {this.props.label ?? ""}</h3>
        <p>
          dom/window events: <strong>{this.state.events}</strong> · emitter
          pings: <strong>{this.state.pings}</strong>
        </p>
        <p className="leaky-note">
          window + document listeners, Resize/Mutation/Intersection observers,
          and a pub/sub subscription — none ever removed. Holds ~5&nbsp;MB.
        </p>
      </div>
    );
  }
}

export default LeakyListeners;

// -----------------------------------------------------------------------------
// A tiny module-level pub/sub emitter. It lives for the lifetime of the page,
// so any subscriber that never unsubscribes is retained forever.
// -----------------------------------------------------------------------------
type Listener = () => void;

const listeners = new Set<Listener>();

const emitter = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit() {
    listeners.forEach((fn) => fn());
  },
};

let emitting = false;
function startEmitting() {
  if (emitting) return;
  emitting = true;
  // Never cleared either — drives the leaked subscriptions.
  setInterval(() => emitter.emit(), 1000);
}
