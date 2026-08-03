import { Component } from "react";

type State = {
  ticks: number;
};

/**
 * LeakyTimeout — leaks via a recursive `setTimeout` that reschedules itself
 * forever and is never cleared.
 *
 * Each scheduled callback closes over `this` and queues the next one, so the
 * chain (and the ~5 MB `payload` it captures) keeps the instance alive well
 * after unmount.
 */
class LeakyTimeout extends Component<object, State> {
  state: State = { ticks: 0 };

  // ~5 MB per instance, retained by the pending timeout callback.
  private payload = new Uint8Array(5_000_000);

  private timeoutId?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    // LEAK: recursive setTimeout, never clearTimeout'd.
    const schedule = () => {
      this.timeoutId = setTimeout(() => {
        void this.payload[0]; // keep the closure retaining the instance
        this.setState((s) => ({ ticks: s.ticks + 1 }));
        schedule();
      }, 1000);
    };
    schedule();
  }

  // THE BUG: no `componentWillUnmount`. This is the exact fix — rename it to
  // `componentWillUnmount` — but it is deliberately never called.
  teardown() {
    clearTimeout(this.timeoutId);
  }

  render() {
    return (
      <div className="leaky-card">
        <h3>⏳ LeakyTimeout</h3>
        <p>
          timeout ticks: <strong>{this.state.ticks}</strong>
        </p>
        <p className="leaky-note">
          Recursive <code>setTimeout</code> that reschedules itself and is never{" "}
          <code>clearTimeout</code>'d. Holds ~5&nbsp;MB.
        </p>
      </div>
    );
  }
}

export default LeakyTimeout;
