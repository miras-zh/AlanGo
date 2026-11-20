import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface KeyboardSheetViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const IOS_KEYBOARD_EASING = Easing.bezier(0.38, 0.7, 0.125, 1);

/**
 * Drop-in replacement for KeyboardAvoidingView inside bottom-sheet <Modal>s.
 * Animates bottom padding synchronously with iOS keyboardWillShow/Hide events
 * so the sheet glides down smoothly with the keyboard without leaving a gap.
 */
export function KeyboardSheetView({ children, style }: KeyboardSheetViewProps) {
  const bottomPad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      const duration = Platform.OS === "ios" ? (e.duration > 0 ? e.duration : 250) : 180;
      Animated.timing(bottomPad, {
        toValue: height,
        duration,
        easing: IOS_KEYBOARD_EASING,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e: KeyboardEvent) => {
      const duration = Platform.OS === "ios" ? (e.duration > 0 ? e.duration : 250) : 160;
      Animated.timing(bottomPad, {
        toValue: 0,
        duration,
        easing: IOS_KEYBOARD_EASING,
        useNativeDriver: false,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [bottomPad]);

  return (
    <Animated.View style={[style, { paddingBottom: bottomPad }]}>
      {children}
    </Animated.View>
  );
}
