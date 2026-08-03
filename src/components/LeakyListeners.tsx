import { useEffect, useRef, useState } from "react";

/**
 * LeakyListeners — leaks via event listeners, observers, and a pub/sub
 * subscription.
 *
 * The effect registers everything on things that outlive the component (window,
 * document, the observed DOM node, the shared emitter) and returns no cleanup.
 * Every handler closes over this component, so it and its ~5 MB `payload` leak
 * on every unmount.
 */
function LeakyListeners() {
  const [events, setEvents] = useState(0);
  const [pings, setPings] = useState(0);

  // ~5 MB per instance, retained by every handler below.
  const payloadRef = useRef<Uint8Array | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = new Uint8Array(5_000_000);
  }

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bump = () => {
      void payloadRef.current; // keep the closure retaining the component
      setEvents((e) => e + 1);
    };

    // LEAK 1: window/document event listeners — never removed.
    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump);
    window.addEventListener("mousemove", bump);
    document.addEventListener("visibilitychange", bump);

    // LEAK 2: observers on a DOM node — never disconnected.
    const node = boxRef.current;
    const resizeObserver = new ResizeObserver(bump);
    const mutationObserver = new MutationObserver(bump);
    const intersectionObserver = new IntersectionObserver(bump);
    if (node) {
      resizeObserver.observe(node);
      mutationObserver.observe(node, { childList: true, subtree: true });
      intersectionObserver.observe(node);
    }

    // LEAK 3: pub/sub subscription — the unsubscribe fn is thrown away.
    emitter.subscribe(() => {
      void payloadRef.current;
      setPings((p) => p + 1);
    });

    // Emit periodically so subscribers stay "warm".
    startEmitting();

    // THE BUG: this effect returns no cleanup. The fix is to return one that
    // undoes everything above — deliberately omitted so it all leaks:
    //
    //   return () => {
    //     window.removeEventListener("resize", bump);
    //     window.removeEventListener("scroll", bump);
    //     window.removeEventListener("mousemove", bump);
    //     document.removeEventListener("visibilitychange", bump);
    //     resizeObserver.disconnect();
    //     mutationObserver.disconnect();
    //     intersectionObserver.disconnect();
    //     // ...and call the unsubscribe returned by emitter.subscribe(...).
    //   };
  }, []);

  return (
    <div className="leaky-card" ref={boxRef}>
      <h3>📡 LeakyListeners</h3>
      <p>
        dom/window events: <strong>{events}</strong> · emitter pings:{" "}
        <strong>{pings}</strong>
      </p>
      <p className="leaky-note">
        window + document listeners, Resize/Mutation/Intersection observers, and
        a pub/sub subscription — none ever removed. Holds ~5&nbsp;MB.
      </p>
    </div>
  );
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
