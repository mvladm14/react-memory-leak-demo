import { useEffect, useRef, useState } from "react";

/**
 * LeakyTimeout — leaks via a recursive `setTimeout` that reschedules itself
 * forever and is never cleared.
 *
 * The effect returns no cleanup, and each scheduled callback closes over this
 * component and queues the next one, so the chain (and the ~5 MB `payload` it
 * captures) keeps the component alive well after unmount.
 */
function LeakyTimeout() {
  const [ticks, setTicks] = useState(0);

  // ~5 MB per instance, retained by the pending timeout callback.
  const payloadRef = useRef<Uint8Array | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = new Uint8Array(5_000_000);
  }

  useEffect(() => {
    // LEAK: recursive setTimeout, never cleared. Fix: track the latest id and
    // `return () => clearTimeout(id)` from this effect.
    const schedule = () => {
      setTimeout(() => {
        void payloadRef.current; // keep the closure retaining the component
        setTicks((t) => t + 1);
        schedule();
      }, 1000);
    };
    schedule();
  }, []);

  return (
    <div className="leaky-card">
      <h3>⏳ LeakyTimeout</h3>
      <p>
        timeout ticks: <strong>{ticks}</strong>
      </p>
      <p className="leaky-note">
        Recursive <code>setTimeout</code> that reschedules itself and is never{" "}
        <code>clearTimeout</code>'d. Holds ~5&nbsp;MB.
      </p>
    </div>
  );
}

export default LeakyTimeout;
