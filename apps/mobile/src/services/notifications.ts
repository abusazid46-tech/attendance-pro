import * as Notifications from "expo-notifications";

export const registerForPushNotifications = async () => {
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  return Notifications.getExpoPushTokenAsync();
};
