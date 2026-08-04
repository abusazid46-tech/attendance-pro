import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export function useAppForegroundEffect(callback: () => void | Promise<void>) {
  const callbackRef = useRef(callback);
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasPaused = previousState.current === "background" || previousState.current === "inactive";
      previousState.current = nextState;

      if (wasPaused && nextState === "active") {
        Promise.resolve(callbackRef.current()).catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, []);
}
