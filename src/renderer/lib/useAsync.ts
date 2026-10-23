import { useEffect, useState } from "react";
import { rateLimit } from "./apiGate";
import { errorMessage } from "./format";
import { useStore } from "./store";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

const tooManyRequests = (error: unknown) => (error as { status?: unknown } | null)?.status === 429;

/**
 * Runs `load` whenever `deps` change; a result that arrives after a newer request is dropped.
 * A page that failed because Spotify asked Vitrine to wait loads again by itself once the wait is over.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resumed = useStore(rateLimit, (s) => s.resumed);
  useEffect(() => {
    if (waiting) setAttempt((n) => n + 1);
  }, [resumed]);
  useEffect(() => {
    let current = true;
    setState((previous) => ({ data: previous.data, error: undefined, loading: true }));
    load().then(
      (data) => {
        if (!current) return;
        setWaiting(false);
        setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (!current) return;
        setWaiting(tooManyRequests(error));
        setState({ data: undefined, error: errorMessage(error), loading: false });
      },
    );
    return () => {
      current = false;
    };
  }, [...deps, attempt]);
  return state;
}
