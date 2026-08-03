import { Component } from "react";

type State = {
  frames: number;
};

/**
 * LeakyAnimationFrame — leaks via a `requestAnimationFrame` loop that is never
 * cancelled.
 *
 * The loop reschedules itself every frame; each frame's callback closes over
 * `this`, so the instance and its ~5 MB `payload` can never be
 * garbage-collected after unmount.
 */
class LeakyAnimationFrame extends Component<object, State> {
  state: State = { frames: 0 };

  // ~5 MB per instance, retained by the pending animation-frame callback.
  private payload = new Uint8Array(5_000_000);

  private rafId?: number;

  componentDidMount() {
    // LEAK: rAF loop, never cancelAnimationFrame'd.
    const loop = () => {
      void this.payload[0]; // keep the closure retaining the instance
      this.setState((s) => ({ frames: s.frames + 1 }));
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // THE BUG: no `componentWillUnmount`. This is the exact fix — rename it to
  // `componentWillUnmount` — but it is deliberately never called.
  teardown() {
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
  }

  render() {
    return (
      <div className="leaky-card">
        <h3>🎞️ LeakyAnimationFrame</h3>
        <p>
          animation frames: <strong>{this.state.frames}</strong>
        </p>
        <p className="leaky-note">
          <code>requestAnimationFrame</code> loop that is never{" "}
          <code>cancelAnimationFrame</code>'d. Holds ~5&nbsp;MB.
        </p>
      </div>
    );
  }
}

export default LeakyAnimationFrame;
