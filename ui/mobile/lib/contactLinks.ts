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

export function openWhatsApp(phone: string, text?: string): Promise<void> {
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return Linking.openURL(`https://wa.me/${phoneDigits(phone)}${q}`);
}
