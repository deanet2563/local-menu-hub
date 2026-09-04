import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  configureShopNotificationPresentation,
  installShopForegroundNotificationHandler,
  type ShopForegroundNotification,
} from '../src/services/notifications';

export default function RootLayout() {
  const [foregroundNotice, setForegroundNotice] = useState<ShopForegroundNotification | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    configureShopNotificationPresentation();
    const subscription = installShopForegroundNotificationHandler((notice) => {
      setForegroundNotice(notice);
      Vibration.vibrate([0, 220, 120, 220]);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!foregroundNotice) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [foregroundNotice, pulse]);

  const isAdmin = foregroundNotice?.type === 'admin' || foregroundNotice?.type === 'admin_notice';
  const borderColor = pulse.interpolate({ inputRange: [0, 1], outputRange: ['#F3C86B', '#EA5B4B'] });

  function openNotice() {
    const subId = foregroundNotice?.subId;
    setForegroundNotice(null);
    if (subId) router.push(`/orders/${subId}`);
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#F7FAF7' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'MyTree Shop',
            headerRight: () => (
              <Pressable onPress={() => router.push('/manage')} hitSlop={10}>
                <Text style={{ color: '#0F8A5F', fontWeight: '800' }}>จัดการร้าน</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="manage" options={{ title: 'จัดการร้าน' }} />
        <Stack.Screen name="settings" options={{ title: 'ตั้งค่าร้าน / Onboarding' }} />
        <Stack.Screen name="shop-assets" options={{ title: 'รูปและ QR ร้าน' }} />
        <Stack.Screen name="categories" options={{ title: 'จัดการหมวดหมู่' }} />
        <Stack.Screen name="customize" options={{ title: 'Customize Options' }} />
        <Stack.Screen name="menu" options={{ title: 'จัดการเมนู' }} />
        <Stack.Screen name="menu-edit/[id]" options={{ title: 'แก้ไขเมนู' }} />
        <Stack.Screen name="delivery" options={{ title: 'ตั้งค่าการส่ง' }} />
        <Stack.Screen name="chat/[subId]" options={{ title: 'แชทกับลูกค้า' }} />
        <Stack.Screen name="reviews" options={{ title: 'รีวิวร้าน' }} />
        <Stack.Screen name="premium" options={{ title: 'Premium & Badge' }} />
        <Stack.Screen name="signup" options={{ title: 'สมัครร้านค้า' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'รายละเอียดออเดอร์' }} />
      </Stack>

      <Modal visible={Boolean(foregroundNotice)} transparent animationType="fade" onRequestClose={() => setForegroundNotice(null)}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertCard, { borderColor }]}>
            <View style={[styles.alertIcon, isAdmin && styles.adminIcon]}><Text style={styles.alertEmoji}>{isAdmin ? '📣' : '🔔'}</Text></View>
            <Text style={styles.alertEyebrow}>{isAdmin ? 'MYTREE ADMIN' : 'NEW NOTIFICATION'}</Text>
            <Text style={styles.alertTitle}>{foregroundNotice?.title}</Text>
            <Text style={styles.alertBody}>{foregroundNotice?.body}</Text>
            {foregroundNotice?.subId ? (
              <Pressable onPress={openNotice} style={styles.openButton}><Text style={styles.openButtonText}>เปิดออเดอร์นี้</Text></Pressable>
            ) : null}
            <Pressable onPress={() => setForegroundNotice(null)} style={styles.closeButton}><Text style={styles.closeButtonText}>{foregroundNotice?.subId ? 'ปิดแจ้งเตือน' : 'รับทราบ'}</Text></Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10, 24, 18, 0.58)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  alertCard: { width: '100%', maxWidth: 420, borderRadius: 26, borderWidth: 4, backgroundColor: '#FFFFFF', padding: 22, alignItems: 'center' },
  alertIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#FFF3D7', alignItems: 'center', justifyContent: 'center' },
  adminIcon: { backgroundColor: '#E8F3FA' },
  alertEmoji: { fontSize: 30 }, alertEyebrow: { marginTop: 14, color: '#0F8A5F', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  alertTitle: { marginTop: 6, color: '#12261E', fontSize: 23, lineHeight: 29, fontWeight: '900', textAlign: 'center' }, alertBody: { marginTop: 8, color: '#65756D', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  openButton: { marginTop: 18, width: '100%', minHeight: 52, borderRadius: 16, backgroundColor: '#0F8A5F', alignItems: 'center', justifyContent: 'center' }, openButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  closeButton: { marginTop: 9, width: '100%', minHeight: 44, borderRadius: 14, backgroundColor: '#EDF2EF', alignItems: 'center', justifyContent: 'center' }, closeButtonText: { color: '#52645C', fontWeight: '800' },
});
