import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ShopPushReadiness = {
  ready: boolean;
  token: string | null;
  reason: string | null;
};

export type ShopForegroundNotification = {
  title: string;
  body: string;
  subId: string | null;
  type: string | null;
  rawData: Record<string, unknown>;
};

let presentationConfigured = false;

export function configureShopNotificationPresentation() {
  if (presentationConfigured) return;
  presentationConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function ensureShopPushReadiness(): Promise<ShopPushReadiness> {
  configureShopNotificationPresentation();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('shop-orders', {
      name: 'Shop orders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync('shop-admin', {
      name: 'MyTree Admin',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 100, 200],
    });
  }

  if (!Device.isDevice) {
    return { ready: false, token: null, reason: 'Push notification ต้องทดสอบบนอุปกรณ์จริง' };
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) {
    return { ready: false, token: null, reason: 'ยังไม่ได้อนุญาตการแจ้งเตือน' };
  }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);

  if (!projectId) {
    return { ready: false, token: null, reason: 'ยังไม่ได้ตั้งค่า EAS projectId สำหรับ Shop Push' };
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return { ready: true, token, reason: null };
}

export function installShopNotificationResponseHandler(onOrder: (subId: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { subId?: unknown };
    if (typeof data?.subId === 'string' && data.subId) onOrder(data.subId);
  });
}

export function installShopForegroundNotificationHandler(
  onNotification: (notification: ShopForegroundNotification) => void,
) {
  configureShopNotificationPresentation();
  return Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    const data = (content.data ?? {}) as Record<string, unknown>;
    onNotification({
      title: content.title?.trim() || 'MyTree Shop',
      body: content.body?.trim() || 'มีการแจ้งเตือนใหม่',
      subId: typeof data.subId === 'string' && data.subId ? data.subId : null,
      type: typeof data.type === 'string' && data.type ? data.type : null,
      rawData: data,
    });
  });
}
