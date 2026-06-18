import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

const MAX_PHOTOS = 4;
const MAX_DIMENSION = 1024; // px
const JPEG_QUALITY = 0.6;

export interface PickedPhoto {
  /** base64 string of the (resized) image. Use base64ToDataUri to display. */
  base64: string;
  /** Width in pixels (post-resize). */
  width: number;
  /** Height in pixels (post-resize). */
  height: number;
}

/** Resize a base64 image to fit inside MAX_DIMENSION using a Canvas. Web-only. */
async function resizeBase64OnWeb(base64: string, mime: string): Promise<PickedPhoto> {
  const dataUri = `data:${mime};base64,${base64}`;
  const img = new Image();
  img.src = dataUri;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image-load-failed"));
  });
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  if (ratio === 1) {
    return { base64, width: img.width, height: img.height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64, width: img.width, height: img.height };
  ctx.drawImage(img, 0, 0, width, height);
  const resized = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const b64 = resized.split(",")[1] ?? base64;
  return { base64: b64, width, height };
}

/** Show a platform-aware picker (camera or library) and return up to (maxTotal - existing) photos. */
export async function pickMeasurementPhotos(existingCount: number): Promise<PickedPhoto[]> {
  const remaining = MAX_PHOTOS - existingCount;
  if (remaining <= 0) {
    Alert.alert("Limit Reached", `You can attach up to ${MAX_PHOTOS} photos.`);
    return [];
  }

  if (Platform.OS === "web") {
    // Permission for camera (only used if user explicitly chooses it later). For now, use file input.
    return new Promise<PickedPhoto[]>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files ?? []).slice(0, remaining);
        const results: PickedPhoto[] = [];
        for (const file of files) {
          const reader = new FileReader();
          const base64: string = await new Promise((res, rej) => {
            reader.onload = () => res(String(reader.result ?? "").split(",")[1] ?? "");
            reader.onerror = () => rej(new Error("read-failed"));
            reader.readAsDataURL(file);
          });
          if (!base64) continue;
          const resized = await resizeBase64OnWeb(base64, file.type || "image/jpeg").catch(() => ({
            base64,
            width: 0,
            height: 0,
          }));
          results.push(resized);
        }
        resolve(results);
      };
      input.click();
    });
  }

  // Native: ask user for source (Camera vs Gallery)
  return new Promise<PickedPhoto[]>((resolve) => {
    Alert.alert(
      "Attach Photo",
      "Select photo source:",
      [
        {
          text: "Take Photo (Camera)",
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert(
                  "Permission Required",
                  "Allow access to your camera to take a photo."
                );
                resolve([]);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: JPEG_QUALITY,
                base64: true,
                exif: false,
              });
              if (result.canceled || !result.assets) {
                resolve([]);
                return;
              }
              const picked = result.assets.map((a) => ({
                base64: a.base64 ?? "",
                width: a.width ?? 0,
                height: a.height ?? 0,
              })).filter((p) => !!p.base64);
              resolve(picked);
            } catch (err) {
              console.error(err);
              resolve([]);
            }
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert(
                  "Permission Required",
                  "Allow access to your photos to attach images."
                );
                resolve([]);
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: remaining,
                quality: JPEG_QUALITY,
                base64: true,
                exif: false,
              });
              if (result.canceled || !result.assets) {
                resolve([]);
                return;
              }
              const picked = result.assets
                .slice(0, remaining)
                .map((a) => ({
                  base64: a.base64 ?? "",
                  width: a.width ?? 0,
                  height: a.height ?? 0,
                }))
                .filter((p) => !!p.base64);
              resolve(picked);
            } catch (err) {
              console.error(err);
              resolve([]);
            }
          }
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve([])
        }
      ],
      { cancelable: true }
    );
  });
}

/** Convert a base64 string to a data URI suitable for Image source on web/native. */
export function base64ToDataUri(base64: string, mime: string = "image/jpeg"): string {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mime};base64,${base64}`;
}
