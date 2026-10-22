import { useEffect, useState } from "react";
import { errorMessage } from "./format";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

/** Runs `load` whenever `deps` change; a result that arrives after a newer request is dropped. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  useEffect(() => {
    let current = true;
    setState((previous) => ({ data: previous.data, error: undefined, loading: true }));
    load().then(
      (data) => current && setState({ data, error: undefined, loading: false }),
      (error: unknown) => current && setState({ data: undefined, error: errorMessage(error), loading: false }),
    );
    return () => {
      current = false;
    };
  }, deps);
  return state;
}
