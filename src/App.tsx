import { Component } from "react";
import LeakyInterval from "./components/LeakyInterval";
import LeakyTimeout from "./components/LeakyTimeout";
import LeakyAnimationFrame from "./components/LeakyAnimationFrame";
import LeakyListeners from "./components/LeakyListeners";
import LeakyPromise from "./components/LeakyPromise";
import "./App.css";

type State = {
  showInterval: boolean;
  showTimeout: boolean;
  showRaf: boolean;
  showListeners: boolean;
  showPromise: boolean;
  cycles: number;
};

/**
 * App — the controller. It has no leaks of its own; it just mounts and
 * unmounts the leaky children so you can watch the heap grow.
 *
 * Every child starts UNMOUNTED. The whole point: unmounting a component
 * *should* let it (and everything it held) be garbage-collected. Because the
 * children never clean up their timers/listeners/observers/subscriptions, they
 * can't be — so every mount→unmount cycle leaks another ~5 MB instance.
 */
class App extends Component<object, State> {
  state: State = {
    showInterval: false,
    showTimeout: false,
    showRaf: false,
    showListeners: false,
    showPromise: false,
    cycles: 0,
  };

  private toggle = (key: keyof Omit<State, "cycles">) => () =>
    this.setState((s) => ({ [key]: !s[key] }) as Pick<State, typeof key>);

  /**
   * Rapidly mount and unmount every child several times to pile up leaks
   * fast. Each unmount leaves an orphaned instance behind.
   */
  private stress = () => {
    const CYCLES = 10;
    let i = 0;
    const allOn = {
      showInterval: true,
      showTimeout: true,
      showRaf: true,
      showListeners: true,
      showPromise: true,
    };
    const allOff = {
      showInterval: false,
      showTimeout: false,
      showRaf: false,
      showListeners: false,
      showPromise: false,
    };
    const step = () => {
      this.setState(allOff);
      setTimeout(() => {
        this.setState((s) => ({ ...allOn, cycles: s.cycles + 1 }));
        i += 1;
        if (i < CYCLES) setTimeout(step, 60);
      }, 60);
    };
    step();
  };

  render() {
    const {
      showInterval,
      showTimeout,
      showRaf,
      showListeners,
      showPromise,
      cycles,
    } = this.state;
    const anyMounted =
      showInterval || showTimeout || showRaf || showListeners || showPromise;

    return (
      <div className="app">
        <h1>React Memory-Leak Demo</h1>
        <p className="intro">
          Five class components that each leak on purpose. Everything starts
          unmounted — mount and unmount them (or hit the stress button) while
          watching the JS heap in DevTools. The heap keeps climbing because
          nothing is ever cleaned up.
        </p>

        <div className="controls">
          <button onClick={this.toggle("showInterval")}>
            {showInterval ? "Unmount" : "Mount"} LeakyInterval
          </button>
          <button onClick={this.toggle("showTimeout")}>
            {showTimeout ? "Unmount" : "Mount"} LeakyTimeout
          </button>
          <button onClick={this.toggle("showRaf")}>
            {showRaf ? "Unmount" : "Mount"} LeakyAnimationFrame
          </button>
          <button onClick={this.toggle("showListeners")}>
            {showListeners ? "Unmount" : "Mount"} LeakyListeners
          </button>
          <button onClick={this.toggle("showPromise")}>
            {showPromise ? "Unmount" : "Mount"} LeakyPromise
          </button>
          <button className="stress" onClick={this.stress}>
            Mount + unmount all 10×
          </button>
          <span className="cycles">stress cycles: {cycles}</span>
        </div>

        <div className="stage">
          {showInterval && <LeakyInterval />}
          {showTimeout && <LeakyTimeout />}
          {showRaf && <LeakyAnimationFrame />}
          {showListeners && <LeakyListeners />}
          {showPromise && <LeakyPromise />}
          {!anyMounted && (
            <p className="empty">
              Nothing mounted yet. Mount a component, then unmount it — its
              timers / listeners / observers / subscriptions / in-flight
              requests stay alive in memory anyway.
            </p>
          )}
        </div>

        <p className="hint">
          Tip: open DevTools → Memory, take a heap snapshot, click “Mount +
          unmount all 10×” a few times, then take another. Search for the
          component names and <code>Uint8Array</code> — the old instances are
          still retained.
        </p>
      </div>
    );
  }
}

export default App;
