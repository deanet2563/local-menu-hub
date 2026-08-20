import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export async function registerShopPushDevice(shopId: string, expoPushToken: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Push device registration requires iOS or Android');
  }

  const { error } = await supabase
    .from('shop_push_devices')
    .upsert(
      {
        shop_id: shopId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        enabled: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' },
    );

  if (error) throw error;
}
