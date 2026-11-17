import { Linking } from "react-native";

/** Phone digits in international form: "8 701 ..." → "7701...". */
export function phoneDigits(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

export function callPhone(phone: string): Promise<void> {
  return Linking.openURL(`tel:+${phoneDigits(phone)}`);
}

export async function openWhatsApp(phone: string, text?: string): Promise<void> {
  const digits = phoneDigits(phone);
  const q = text ? `&text=${encodeURIComponent(text)}` : "";
  const appUrl = `whatsapp://send?phone=${digits}${q}`;
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch {
    // Fall back to universal link below.
  }
  const webQuery = text ? `?text=${encodeURIComponent(text)}` : "";
  await Linking.openURL(`https://wa.me/${digits}${webQuery}`);
}
