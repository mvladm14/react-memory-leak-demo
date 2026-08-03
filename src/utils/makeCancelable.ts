/**
 * Vendored verbatim (typed) from `@universe/frontend-utils` — its `src/promise.js`,
 * exported there as `makeCancelable`. That package lives on a private registry,
 * so it's inlined here to keep this demo self-contained.
 *
 * It doesn't abort the underlying work — it wraps the promise so that, once
 * `cancel()` has been called, the wrapped promise rejects with
 * `{ isCanceled: true }` instead of resolving. Your `.then` never runs, so it
 * can't touch an unmounted component. This only works if the underlying promise
 * eventually settles (a resolving/erroring request, not a permanently hung one).
 */
export type Cancelable<T> = {
  promise: Promise<T>;
  cancel: () => void;
};

export type Canceled = { isCanceled: true };

export default function makeCancelable<T>(promise: Promise<T>): Cancelable<T> {
  let hasCanceled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(
      (val) => (hasCanceled ? reject({ isCanceled: true }) : resolve(val)),
      (error) => (hasCanceled ? reject({ isCanceled: true }) : reject(error)),
    );
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled = true;
    },
  };
}
