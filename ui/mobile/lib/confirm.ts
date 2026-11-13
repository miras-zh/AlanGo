import { Alert } from "react-native";
import { tr } from "@/lib/i18n";

export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelText || tr("common.cancel"),
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: options.confirmText || tr("common.delete"),
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}
