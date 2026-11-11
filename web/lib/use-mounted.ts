import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false during SSR and hydration, true afterwards. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
