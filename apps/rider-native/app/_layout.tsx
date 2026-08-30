import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'MyTree Rider' }} />
        <Stack.Screen name="active-delivery" options={{ title: 'งานปัจจุบัน' }} />
        <Stack.Screen name="nearby-jobs" options={{ title: 'งานใกล้ฉัน' }} />
        <Stack.Screen name="cancel-delivery" options={{ title: 'ปล่อยงาน' }} />
        <Stack.Screen name="proof-delivery" options={{ title: 'ยืนยันการส่ง' }} />
      </Stack>
    </>
  );
}
