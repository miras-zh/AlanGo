import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/ThemeProvider";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

export function PasswordInput({ style, ...props }: TextInputProps) {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[style, { paddingRight: 44 }]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        style={styles.eye}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={tokens.muted}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  wrap: {
    position: "relative",
    justifyContent: "center",
  },
  eye: {
    position: "absolute",
    right: 14,
    height: "100%",
    justifyContent: "center",
  },
});
