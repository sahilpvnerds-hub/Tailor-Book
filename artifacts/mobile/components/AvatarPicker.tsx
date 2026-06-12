import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

const MAX_BASE64_LENGTH = 2_500_000; // ~2 MB safety threshold

/**
 * Cross-platform avatar picker.
 * - On native, uses expo-image-picker and returns a base64 data URI.
 * - On web, falls back to a hidden <input type="file"> + FileReader.
 *
 * Returns null if the user cancels or the file is too large.
 */
export async function pickAvatarImage(): Promise<string | null> {
  if (Platform.OS === "web") {
    return pickAvatarWeb();
  }
  return pickAvatarNative();
}

async function pickAvatarNative(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photos to set a profile picture.",
      );
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    const asset = result.assets[0];
    if (asset.base64) {
      const mime = asset.mimeType ?? "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;
      if (dataUri.length > MAX_BASE64_LENGTH) {
        Alert.alert("Photo too large", "Please choose a smaller image.");
        return null;
      }
      return dataUri;
    }
    return asset.uri ?? null;
  } catch (e: any) {
    Alert.alert("Could not pick image", e?.message ?? "Unknown error");
    return null;
  }
}

function pickAvatarWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "0";
      document.body.appendChild(input);

      let resolved = false;
      const cleanup = () => {
        try {
          document.body.removeChild(input);
        } catch {}
      };

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolved = true;
          cleanup();
          resolve(null);
          return;
        }
        if (file.size > MAX_BASE64_LENGTH) {
          resolved = true;
          cleanup();
          Alert.alert("Photo too large", "Please choose a smaller image.");
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolved = true;
          cleanup();
          resolve(typeof reader.result === "string" ? reader.result : null);
        };
        reader.onerror = () => {
          resolved = true;
          cleanup();
          Alert.alert("Could not read file", "Please try a different image.");
          resolve(null);
        };
        reader.readAsDataURL(file);
      };

      // Safety timeout: some browsers don't fire change if the dialog is dismissed without selection.
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 60_000);

      input.click();
    } catch (e: any) {
      Alert.alert("Could not pick image", e?.message ?? "Unknown error");
      resolve(null);
    }
  });
}
