import { Component } from "react";

type State = {
  ticks: number;
};

/**
 * LeakyInterval — leaks via a `setInterval` that is never cleared.
 *
 * The interval callback closes over `this`, so as long as the timer lives (it
 * lives forever) the whole instance — and its ~5 MB `payload` — stays
 * reachable and can never be garbage-collected after unmount.
 */
class LeakyInterval extends Component<object, State> {
  state: State = { ticks: 0 };

  // ~5 MB per instance so each leaked instance is easy to spot in a snapshot.
  private payload = new Uint8Array(5_000_000);

  // Grows forever because the interval is never cleared.
  private leaked: number[] = [];

  private intervalId?: ReturnType<typeof setInterval>;

  componentDidMount() {
    // LEAK: never clearInterval'd.
    this.intervalId = setInterval(() => {
      this.leaked.push(this.payload.length + this.leaked.length);
      this.setState((s) => ({ ticks: s.ticks + 1 }));
    }, 500);
  }

  // THE BUG: no `componentWillUnmount`. This is the exact fix — rename it to
  // `componentWillUnmount` — but it is deliberately never called.
  teardown() {
    clearInterval(this.intervalId);
  }

  render() {
    return (
      <div className="leaky-card">
        <h3>⏱️ LeakyInterval</h3>
        <p>
          interval ticks: <strong>{this.state.ticks}</strong>
        </p>
        <p className="leaky-note">
          <code>setInterval</code> that is never <code>clearInterval</code>'d.
          Holds ~5&nbsp;MB.
        </p>
      </div>
    );
  }
}

export default LeakyInterval;
