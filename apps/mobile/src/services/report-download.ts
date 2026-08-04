import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

export type ReportFilePayload = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export async function saveAndShareReport(file: ReportFilePayload) {
  if (Platform.OS === "web") {
    await Share.share({ title: file.fileName, message: `${file.fileName}\n${file.contentBase64}` });
    return { uri: file.fileName };
  }

  const safeName = file.fileName.replace(/[^A-Za-z0-9._-]+/g, "-");
  const uri = `${FileSystem.documentDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(uri, file.contentBase64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: file.mimeType,
      dialogTitle: `Save or share ${safeName}`
    });
  } else {
    await Share.share({ title: safeName, message: uri });
  }

  return { uri };
}
