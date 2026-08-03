import { useEffect, useRef, useState } from "react";

/**
 * LeakyInterval — leaks via a `setInterval` that is never cleared.
 *
 * The effect sets up the interval but returns no cleanup, so on unmount React
 * has nothing to tear down. The interval callback closes over this component's
 * refs and the `setTicks` dispatcher, so the whole thing — including the ~5 MB
 * `payload` — stays reachable and can never be garbage-collected.
 */
function LeakyInterval() {
  const [ticks, setTicks] = useState(0);

  // ~5 MB per instance, lazily created once. Retained by the interval callback.
  const payloadRef = useRef<Uint8Array | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = new Uint8Array(5_000_000);
  }

  // Grows forever because the interval is never cleared.
  const leakedRef = useRef<number[]>([]);

  useEffect(() => {
    // LEAK: never cleared. Fix: capture the id and
    // `return () => clearInterval(id)` from this effect.
    setInterval(() => {
      leakedRef.current.push(payloadRef.current!.length + leakedRef.current.length);
      const count = leakedRef.current.length;
      setTicks(count);
      console.log("LeakyInterval: ticks", count, "leaked", count);
    }, 500);
  }, []);

  return (
    <div className="leaky-card">
      <h3>⏱️ LeakyInterval</h3>
      <p>
        interval ticks: <strong>{ticks}</strong>
      </p>
      <p className="leaky-note">
        <code>setInterval</code> that is never <code>clearInterval</code>'d.
        Holds ~5&nbsp;MB.
      </p>
    </div>
  );
}

export default LeakyInterval;
