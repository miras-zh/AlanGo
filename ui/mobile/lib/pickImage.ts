import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { tr } from "@/lib/i18n";

export type PickedPhoto = { uri: string; name: string; type: string };

// Longest side of the re-encoded image — keeps full-res iPhone shots well
// under the backend's 5MB upload limit.
const MAX_SIDE = 2048;

// Opens the system photo picker and re-encodes the chosen image as JPEG.
// iPhone photos are often HEIC, which the backend rejects (jpeg/png/webp
// only), so every upload goes through here instead of the raw asset.
// Returns null if the user cancelled.
//
// `Compatible` asks iOS to hand over a transcoded JPEG instead of the raw
// original. With the default (`current`) some assets — iCloud-optimized
// originals, Live Photos, odd formats — fail with "cannot load
// representation of type public.jpeg" (FailedToReadImageException).
export class UnreadablePhotoError extends Error {
  constructor() {
    super(tr("photo.unreadable"));
    this.name = "UnreadablePhotoError";
  }
}

function isUnreadablePhoto(err: unknown): boolean {
  const text = `${(err as { code?: string })?.code ?? ""} ${(err as Error)?.message ?? String(err)}`;
  return /FailedToReadImage|Failed to read picked image|public\.(jpeg|heic|image)|representation/i.test(text);
}

export async function pickImageAsJpeg(namePrefix: string): Promise<PickedPhoto | null> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
  } catch (err) {
    if (isUnreadablePhoto(err)) throw new UnreadablePhotoError();
    throw err;
  }
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

// Alert title for an error from pickImageAsJpeg.
export function pickErrorTitle(err: unknown): string {
  return err instanceof UnreadablePhotoError ? tr("photo.unreadableTitle") : tr("common.error");
}
