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
        <Stack.Screen name="nearby-jobs" options={{ title: 'งานเข้า' }} />
        <Stack.Screen name="active-delivery" options={{ title: 'งานปัจจุบัน' }} />
        <Stack.Screen name="history" options={{ title: 'ประวัติ' }} />
        <Stack.Screen name="earnings" options={{ title: 'รายได้' }} />
        <Stack.Screen name="chat" options={{ title: 'แชท' }} />
        <Stack.Screen name="profile" options={{ title: 'โปรไฟล์' }} />
        <Stack.Screen name="settings" options={{ title: 'ตั้งค่า' }} />
        <Stack.Screen name="help" options={{ title: 'ช่วยเหลือ' }} />
        <Stack.Screen name="job-detail/[subId]" options={{ title: 'รายละเอียดงาน' }} />
        <Stack.Screen name="cancel-delivery" options={{ title: 'ปล่อยงาน' }} />
        <Stack.Screen name="proof-delivery" options={{ title: 'ยืนยันการส่ง' }} />
      </Stack>
    </>
  );
}
