import { Stack } from 'expo-router';
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
        <Stack.Screen name="index" options={{ title: 'MyTree Shop' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'รายละเอียดออเดอร์' }} />
      </Stack>
    </>
  );
}
