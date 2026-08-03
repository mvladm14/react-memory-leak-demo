import { useState } from "react";
import LeakyInterval from "./components/LeakyInterval";
import LeakyTimeout from "./components/LeakyTimeout";
import LeakyAnimationFrame from "./components/LeakyAnimationFrame";
import LeakyListeners from "./components/LeakyListeners";
import LeakyPromise from "./components/LeakyPromise";
import "./App.css";

type Show = {
  showInterval: boolean;
  showTimeout: boolean;
  showRaf: boolean;
  showListeners: boolean;
  showPromise: boolean;
};

const ALL_OFF: Show = {
  showInterval: false,
  showTimeout: false,
  showRaf: false,
  showListeners: false,
  showPromise: false,
};

const ALL_ON: Show = {
  showInterval: true,
  showTimeout: true,
  showRaf: true,
  showListeners: true,
  showPromise: true,
};

/**
 * App — the controller. It has no leaks of its own; it just mounts and
 * unmounts the leaky children so you can watch the heap grow.
 *
 * Every child starts UNMOUNTED. The whole point: unmounting a component
 * *should* let it (and everything it held) be garbage-collected. Because the
 * children's effects never return a cleanup, they can't be — so every
 * mount→unmount cycle leaks another ~5 MB instance.
 */
function App() {
  const [show, setShow] = useState<Show>(ALL_OFF);
  const [cycles, setCycles] = useState(0);

  const toggle = (key: keyof Show) => () =>
    setShow((s) => ({ ...s, [key]: !s[key] }));

  /**
   * Rapidly mount and unmount every child several times to pile up leaks
   * fast. Each unmount leaves an orphaned instance behind.
   */
  const stress = () => {
    const CYCLES = 10;
    let i = 0;
    const step = () => {
      setShow(ALL_OFF);
      setTimeout(() => {
        setShow(ALL_ON);
        setCycles((c) => c + 1);
        i += 1;
        if (i < CYCLES) setTimeout(step, 60);
      }, 60);
    };
    step();
  };

  const anyMounted = Object.values(show).some(Boolean);

  return (
    <div className="app">
      <h1>React Memory-Leak Demo</h1>
      <p className="intro">
        Five functional components that each leak on purpose. Everything starts
        unmounted — mount and unmount them (or hit the stress button) while
        watching the JS heap in DevTools. The heap keeps climbing because
        nothing is ever cleaned up.
      </p>

      <div className="controls">
        <button onClick={toggle("showInterval")}>
          {show.showInterval ? "Unmount" : "Mount"} LeakyInterval
        </button>
        <button onClick={toggle("showTimeout")}>
          {show.showTimeout ? "Unmount" : "Mount"} LeakyTimeout
        </button>
        <button onClick={toggle("showRaf")}>
          {show.showRaf ? "Unmount" : "Mount"} LeakyAnimationFrame
        </button>
        <button onClick={toggle("showListeners")}>
          {show.showListeners ? "Unmount" : "Mount"} LeakyListeners
        </button>
        <button onClick={toggle("showPromise")}>
          {show.showPromise ? "Unmount" : "Mount"} LeakyPromise
        </button>
        <button className="stress" onClick={stress}>
          Mount + unmount all 10×
        </button>
        <span className="cycles">stress cycles: {cycles}</span>
      </div>

      <div className="stage">
        {show.showInterval && <LeakyInterval />}
        {show.showTimeout && <LeakyTimeout />}
        {show.showRaf && <LeakyAnimationFrame />}
        {show.showListeners && <LeakyListeners />}
        {show.showPromise && <LeakyPromise />}
        {!anyMounted && (
          <p className="empty">
            Nothing mounted yet. Mount a component, then unmount it — its timers
            / listeners / observers / subscriptions / in-flight requests stay
            alive in memory anyway.
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

export default App;
