import { InteractionManager } from "react-native";

/**
 * Delays execution of the provided navigation callback until after all
 * active interactions (animations, gestures) have completed.
 * This resolves "Cannot record touch end without a touch start" warnings 
 * on React Native Web caused by immediate unmounting during a touch gesture.
 */
export function navigateAfterInteractions(navigationCallback: () => void) {
  InteractionManager.runAfterInteractions(() => {
    navigationCallback();
  });
}
