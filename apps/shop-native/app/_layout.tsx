import { Pressable, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
              <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
                <Text style={{ color: '#0F8A5F', fontWeight: '800' }}>ตั้งค่าร้าน</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="settings" options={{ title: 'ตั้งค่าร้าน / Onboarding' }} />
        <Stack.Screen name="signup" options={{ title: 'สมัครร้านค้า' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'รายละเอียดออเดอร์' }} />
      </Stack>
    </>
  );
}
