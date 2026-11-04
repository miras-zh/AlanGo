import { Alert } from "react-native";

export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelText || "Отмена",
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: options.confirmText || "Удалить",
        style: "destructive",
        onPress: () => resolve(true),
      },
    ]);
  });
}
