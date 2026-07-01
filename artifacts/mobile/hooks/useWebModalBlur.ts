import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * A utility hook for React Native Web to prevent "aria-hidden" accessibility violations.
 * When a native <Modal> opens on the web, React Native Web adds `aria-hidden="true"`
 * to the root container. If an element inside that container retained focus (e.g., a button
 * or input), the browser throws an accessibility error.
 * 
 * This hook automatically blurs the active DOM element whenever the modal becomes visible.
 */
export function useWebModalBlur(visible: boolean) {
  useEffect(() => {
    if (visible && Platform.OS === "web" && typeof document !== "undefined") {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === "function") {
        active.blur();
      }
    }
  }, [visible]);
}
