import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import { apiBackend } from "./api-backend";

const keyFor = (ownerKey: string) => `attendance.profilePhoto.${ownerKey}`;

export type PickedProfilePhoto = {
  uri: string;
  imageData?: string;
};

export async function pickProfilePhoto(): Promise<PickedProfilePhoto | undefined> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission required", "Allow photo access to upload the faculty photo.");
      return undefined;
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.45,
    base64: true
  });

  if (result.canceled || !result.assets[0]?.uri) return undefined;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? "image/jpeg";
  const imageData = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : undefined;

  return {
    uri: imageData ?? asset.uri,
    imageData
  };
}

export async function saveProfilePhoto(ownerKey: string | undefined, uri: string) {
  if (!ownerKey) return;
  await AsyncStorage.setItem(keyFor(ownerKey), uri);
}

export async function loadProfilePhoto(ownerKey: string | undefined) {
  if (!ownerKey) return undefined;
  return AsyncStorage.getItem(keyFor(ownerKey));
}

export async function uploadAndStoreProfilePhoto(ownerKeys: Array<string | undefined>, photo: PickedProfilePhoto) {
  let finalUri = photo.uri;
  if (photo.imageData) {
    const response = await apiBackend.uploadAvatar(photo.imageData);
    finalUri = response.avatarUrl ?? finalUri;
  }

  await Promise.all(ownerKeys.filter(Boolean).map((key) => saveProfilePhoto(key, finalUri)));
  return finalUri;
}
