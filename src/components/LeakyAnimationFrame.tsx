import { useEffect, useRef, useState } from "react";

/**
 * LeakyAnimationFrame — leaks via a `requestAnimationFrame` loop that is never
 * cancelled.
 *
 * The effect returns no cleanup, and the loop reschedules itself every frame;
 * each frame's callback closes over this component, so it and its ~5 MB
 * `payload` can never be garbage-collected after unmount.
 */
function LeakyAnimationFrame() {
  const [frames, setFrames] = useState(0);

  // ~5 MB per instance, retained by the pending animation-frame callback.
  const payloadRef = useRef<Uint8Array | null>(null);
  if (payloadRef.current === null) {
    payloadRef.current = new Uint8Array(5_000_000);
  }

  useEffect(() => {
    // LEAK: rAF loop, never cancelled. Fix: track the id and
    // `return () => cancelAnimationFrame(id)` from this effect.
    const loop = () => {
      void payloadRef.current; // keep the closure retaining the component
      setFrames((f) => f + 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, []);

  return (
    <div className="leaky-card">
      <h3>🎞️ LeakyAnimationFrame</h3>
      <p>
        animation frames: <strong>{frames}</strong>
      </p>
      <p className="leaky-note">
        <code>requestAnimationFrame</code> loop that is never{" "}
        <code>cancelAnimationFrame</code>'d. Holds ~5&nbsp;MB.
      </p>
    </div>
  );
}

export default LeakyAnimationFrame;
