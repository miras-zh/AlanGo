import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; name: string; type: string };

// Longest side of the re-encoded image — keeps full-res iPhone shots well
// under the backend's 5MB upload limit.
const MAX_SIDE = 2048;

// Opens the system photo picker and re-encodes the chosen image as JPEG.
// iPhone photos are often HEIC, which the backend rejects (jpeg/png/webp
// only), so every upload goes through here instead of the raw asset.
// Returns null if the user cancelled.
export async function pickImageAsJpeg(namePrefix: string): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const actions =
    Math.max(asset.width, asset.height) > MAX_SIDE
      ? [{ resize: asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
      : [];
  try {
    const jpeg = await manipulateAsync(asset.uri, actions, { compress: 0.85, format: SaveFormat.JPEG });
    return { uri: jpeg.uri, name: `${namePrefix}-${Date.now()}.jpg`, type: "image/jpeg" };
  } catch {
    // Re-encoding failed (unreadable/odd file): hand over the original asset;
    // the upload then either succeeds or shows the backend's format error.
    return {
      uri: asset.uri,
      name: asset.fileName ?? `${namePrefix}-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    };
  }
}
