import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exchangeLineIdToken, refreshRiderSession, revokeRiderSession } from '@/auth/broker';
import { nativeLineLogin } from '@/auth/lineNative';
import {
  clearRiderSession,
  isRefreshSessionFresh,
  isSessionFresh,
  loadRiderSession,
  type RiderSession,
} from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { registerPushDevice } from '@/data/pushDeviceRepository';
import { getRiderProfile, setRiderOnline, updateRiderLocation, type RiderProfile } from '@/data/riderRepository';
import { ensureForegroundLocation, isLocationFresh, type RiderLocation } from '@/services/location';
import { ensurePushReadiness } from '@/services/notifications';

type ReadinessState = 'pending' | 'checking' | 'ready' | 'blocked';

type HealthRowProps = { label: string; value: string; state?: ReadinessState };

function HealthRow({ label, value, state = 'pending' }: HealthRowProps) {
  return (
    <View style={styles.healthRow}>
      <View style={[styles.dot, state === 'ready' && styles.dotReady, state === 'blocked' && styles.dotBlocked, (state === 'pending' || state === 'checking') && styles.dotPending]} />
      <View style={styles.healthText}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function RiderHomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [updatingOnline, setUpdatingOnline] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushState, setPushState] = useState<ReadinessState>('pending');
  const [pushText, setPushText] = useState('รอตรวจสอบ');
  const [locationState, setLocationState] = useState<ReadinessState>('pending');
  const [locationText, setLocationText] = useState('รอตรวจสอบ');
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [session, setSession] = useState<RiderSession | null>(null);
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [accountState, setAccountState] = useState<ReadinessState>('checking');
  const [accountText, setAccountText] = useState('กำลังตรวจ MyTree session...');
  const [error, setError] = useState<string | null>(null);

  function applyProfile(profile: RiderProfile | null) {
    setRider(profile);
    if (!profile) {
      setAccountState('blocked');
      setAccountText('ไม่พบบัญชี Rider สำหรับผู้ใช้นี้');
    } else if (profile.is_banned) {
      setAccountState('blocked');
      setAccountText('บัญชี Rider ถูกระงับ');
    } else if (profile.deletion_requested_at) {
      setAccountState('blocked');
      setAccountText('บัญชีอยู่ระหว่างคำขอลบ');
    } else if (!profile.is_approved) {
      setAccountState('pending');
      setAccountText('รอ Admin อนุมัติ Rider');
    } else {
      setAccountState('ready');
      setAccountText(`${profile.name} · ${profile.vehicle_type ?? 'ไม่ระบุพาหนะ'}`);
    }
  }

  async function syncOnlineDeviceState(activeSession: RiderSession, profile: RiderProfile) {
    if (!profile.is_online) return;

    setPushState('checking');
    setLocationState('checking');
    setPushText('กำลังซิงก์ Push อัตโนมัติ...');
    setLocationText('กำลังอัปเดตตำแหน่งอัตโนมัติ...');

    const [pushResult, locationResult] = await Promise.allSettled([
      ensurePushReadiness(),
      ensureForegroundLocation(),
    ]);

    if (pushResult.status === 'fulfilled' && pushResult.value.ready && pushResult.value.token) {
      if (riderFeatures.pushDeviceRegistry) {
        try {
          await registerPushDevice(activeSession, profile.id, pushResult.value.token);
          setPushState('ready');
          setPushText('พร้อมรับ Native Push · ลงทะเบียนอุปกรณ์แล้ว');
        } catch (cause) {
          setPushState('blocked');
          setPushText('Push พร้อม แต่ลงทะเบียนอุปกรณ์ไม่สำเร็จ');
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } else {
        setPushState('ready');
        setPushText('พร้อมรับ Native Push');
      }
    } else if (pushResult.status === 'fulfilled') {
      setPushState('blocked');
      setPushText(pushResult.value.reason ?? 'Push ยังไม่พร้อม');
    } else {
      setPushState('blocked');
      setPushText('ตรวจสอบ Push ไม่สำเร็จ');
    }

    if (locationResult.status === 'fulfilled' && locationResult.value.ready && locationResult.value.location) {
      const freshLocation = locationResult.value.location;
      setLocation(freshLocation);
      try {
        await updateRiderLocation(activeSession, profile.id, freshLocation);
        setLocationState('ready');
        setLocationText('อัปเดตตำแหน่งกับระบบแล้ว');
      } catch (cause) {
        setLocationState('blocked');
        setLocationText('ได้ตำแหน่งแล้ว แต่ซิงก์กับระบบไม่สำเร็จ');
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } else if (locationResult.status === 'fulfilled') {
      setLocationState('blocked');
      setLocation(null);
      setLocationText(locationResult.value.reason ?? 'ตำแหน่งยังไม่พร้อม');
    } else {
      setLocationState('blocked');
      setLocationText('ตรวจสอบตำแหน่งไม่สำเร็จ');
    }
  }

  async function restoreAccount() {
    setAccountState('checking');
    setAccountText('กำลังตรวจ MyTree session...');
    setError(null);

    const saved = await loadRiderSession();
    if (!saved) {
      setSession(null);
      setRider(null);
      setAccountState('pending');
      setAccountText('เข้าสู่ระบบด้วย LINE เพื่อเชื่อมบัญชี Rider');
      return;
    }

    let activeSession = saved;
    if (!isSessionFresh(activeSession)) {
      if (activeSession.refreshToken && isRefreshSessionFresh(activeSession)) {
        try {
          setAccountText('กำลังต่ออายุ MyTree session...');
          activeSession = await refreshRiderSession(activeSession.refreshToken);
        } catch (cause) {
          await clearRiderSession();
          setSession(null);
          setRider(null);
          setAccountState('blocked');
          setAccountText('Session ต่ออายุไม่สำเร็จ — กรุณาเข้าสู่ระบบใหม่');
          setError(cause instanceof Error ? cause.message : String(cause));
          return;
        }
      } else {
        await clearRiderSession();
        setSession(null);
        setRider(null);
        setAccountState('blocked');
        setAccountText('Session หมดอายุ — กรุณาเข้าสู่ระบบใหม่');
        return;
      }
    }

    try {
      const profile = await getRiderProfile(activeSession);
      setSession(activeSession);
      applyProfile(profile);
      if (profile?.is_online) await syncOnlineDeviceState(activeSession, profile);
    } catch (cause) {
      setAccountState('blocked');
      setAccountText('อ่านบัญชี Rider ไม่สำเร็จ');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  useEffect(() => { void restoreAccount(); }, []);

  useEffect(() => {
    if (!session || !rider?.is_online) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncOnlineDeviceState(session, rider);
    });
    return () => subscription.remove();
  }, [session, rider?.id, rider?.is_online]);

  async function signInWithLine() {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    setAccountState('checking');
    setAccountText('กำลังเข้าสู่ระบบ LINE...');

    try {
      const { idToken } = await nativeLineLogin();
      const newSession = await exchangeLineIdToken(idToken);
      const profile = await getRiderProfile(newSession);
      setSession(newSession);
      applyProfile(profile);
      if (profile?.is_online) await syncOnlineDeviceState(newSession, profile);
    } catch (cause) {
      setSession(null);
      setRider(null);
      setAccountState('blocked');
      setAccountText('เข้าสู่ระบบ LINE ไม่สำเร็จ');
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSigningIn(false);
    }
  }

  async function checkReadiness() {
    if (checking) return;
    setChecking(true);
    setError(null);
    setPushState('checking');
    setLocationState('checking');
    setPushText('กำลังตรวจสอบ...');
    setLocationText('กำลังตรวจสอบ...');

    const [pushResult, locationResult] = await Promise.allSettled([ensurePushReadiness(), ensureForegroundLocation()]);
    if (pushResult.status === 'fulfilled') {
      setPushState(pushResult.value.ready ? 'ready' : 'blocked');
      setPushText(pushResult.value.ready ? 'พร้อมรับ Native Push' : pushResult.value.reason ?? 'Push ยังไม่พร้อม');
    } else {
      setPushState('blocked');
      setPushText('ตรวจสอบ Push ไม่สำเร็จ');
    }

    if (locationResult.status === 'fulfilled') {
      setLocationState(locationResult.value.ready ? 'ready' : 'blocked');
      setLocation(locationResult.value.location);
      setLocationText(locationResult.value.ready ? 'ได้ตำแหน่งปัจจุบันแล้ว' : locationResult.value.reason ?? 'ตำแหน่งยังไม่พร้อม');
    } else {
      setLocationState('blocked');
      setLocationText('ตรวจสอบตำแหน่งไม่สำเร็จ');
    }
    setChecking(false);
  }

  async function toggleOnline() {
    if (!session || !rider || updatingOnline) return;
    setUpdatingOnline(true);
    setError(null);
    try {
      if (rider.is_online) {
        await setRiderOnline(session, rider, false);
      } else {
        if (pushState !== 'ready') throw new Error('ต้องเปิด Native Push Notification ก่อน Online');
        let freshLocation = location;
        if (!freshLocation || !isLocationFresh(freshLocation.capturedAt)) {
          const refreshed = await ensureForegroundLocation();
          if (!refreshed.ready || !refreshed.location) throw new Error(refreshed.reason ?? 'ต้องมีตำแหน่งล่าสุดก่อน Online');
          freshLocation = refreshed.location;
          setLocation(freshLocation);
          setLocationState('ready');
          setLocationText('ได้ตำแหน่งปัจจุบันแล้ว');
        }
        await setRiderOnline(session, rider, true, freshLocation);
      }
      applyProfile(await getRiderProfile(session));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUpdatingOnline(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError(null);
    try {
      const current = session ?? (await loadRiderSession());
      if (current?.refreshToken) await revokeRiderSession(current.refreshToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      await clearRiderSession();
      setSession(null);
      setRider(null);
      setAccountState('pending');
      setAccountText('ออกจากระบบแล้ว — กรุณาเข้าสู่ระบบ Rider');
      setLoggingOut(false);
    }
  }

  const nativeReady = pushState === 'ready' && locationState === 'ready';
  const accountReady = accountState === 'ready' && !!session && !!rider;
  const canToggleOnline = accountReady && (rider?.is_online === true || nativeReady);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FOOD DELIVERY ONLY</Text>
          <Text style={styles.title}>พร้อมรับงาน</Text>
          <Text style={styles.subtitle}>เมื่อ Rider Online แอปจะซิงก์ Native Push และตำแหน่งล่าสุดอัตโนมัติเมื่อเปิดหรือกลับเข้าแอป</Text>
        </View>

        <View style={styles.card}>
          <HealthRow label="บัญชีไรเดอร์" value={accountText} state={accountState} />
          <HealthRow label="การแจ้งเตือน" value={pushText} state={pushState} />
          <HealthRow label="ตำแหน่ง" value={locationText} state={locationState} />
          <HealthRow label="สถานะรับงาน" value={rider?.is_online ? 'Online — พร้อมรับงานส่งอาหาร' : 'Offline'} state={rider?.is_online ? 'ready' : 'pending'} />
        </View>

        {!session && (
          <Pressable accessibilityRole="button" disabled={signingIn} onPress={signInWithLine} style={[styles.lineButton, signingIn && styles.buttonDisabled]}>
            <Text style={styles.lineButtonText}>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย LINE'}</Text>
          </Pressable>
        )}

        {location && (
          <View style={styles.locationCard}>
            <Text style={styles.locationLabel}>ตำแหน่งล่าสุดบนอุปกรณ์</Text>
            <Text style={styles.locationValue}>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</Text>
            <Text style={styles.locationMeta}>Accuracy {location.accuracy ? `${Math.round(location.accuracy)} m` : 'unknown'}</Text>
          </View>
        )}

        <Pressable style={[styles.primaryButton, checking && styles.buttonDisabled]} accessibilityRole="button" disabled={checking} onPress={checkReadiness}>
          <Text style={styles.primaryButtonText}>{checking ? 'กำลังตรวจสอบ...' : 'ตรวจ Push + Location'}</Text>
        </Pressable>

        <Pressable style={[styles.onlineButton, rider?.is_online && styles.onlineButtonActive, (!canToggleOnline || updatingOnline) && styles.buttonDisabled]} accessibilityRole="button" disabled={!canToggleOnline || updatingOnline} onPress={toggleOnline}>
          <Text style={styles.onlineButtonText}>{updatingOnline ? 'กำลังอัปเดต...' : rider?.is_online ? 'ออก Offline' : 'เปิด Online รับงาน'}</Text>
        </Pressable>

        <View style={styles.workRow}>
          <Pressable accessibilityRole="button" disabled={!accountReady} onPress={() => router.push('/active-delivery')} style={[styles.workButton, !accountReady && styles.buttonDisabled]}>
            <Text style={styles.workButtonTitle}>งานปัจจุบัน</Text>
            <Text style={styles.workButtonMeta}>Pickup → Delivery</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!rider?.is_online || !riderFeatures.deliveryV3Accept} onPress={() => router.push('/nearby-jobs')} style={[styles.workButton, (!rider?.is_online || !riderFeatures.deliveryV3Accept) && styles.buttonDisabled]}>
            <Text style={styles.workButtonTitle}>งานใกล้ฉัน</Text>
            <Text style={styles.workButtonMeta}>{riderFeatures.deliveryV3Accept ? 'Delivery V3 · First Accept' : 'รอเปิด Delivery V3'}</Text>
          </Pressable>
        </View>

        {!!session && (
          <Pressable accessibilityRole="button" disabled={loggingOut} onPress={logout} style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}>
            <Text style={styles.logoutButtonText}>{loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.note}>Phase 2 ใช้ Native LINE Login และ persistent revocable `rider_native` session; Delivery V3 ใช้ Rider First Accept → Atomic Auto Lock → Shop Notified โดย backend เป็น source of truth</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  scrollView: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 18 },
  header: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#246B50' },
  title: { fontSize: 30, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#5B6877' },
  card: { gap: 16, padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotReady: { backgroundColor: '#2F855A' },
  dotPending: { backgroundColor: '#D69E2E' },
  dotBlocked: { backgroundColor: '#C53030' },
  healthText: { flex: 1 },
  healthLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  healthValue: { marginTop: 2, fontSize: 13, color: '#667085' },
  lineButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 16, backgroundColor: '#06C755', paddingHorizontal: 18 },
  lineButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  locationCard: { padding: 14, borderRadius: 14, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#ABEFC6' },
  locationLabel: { fontSize: 12, fontWeight: '700', color: '#067647' },
  locationValue: { marginTop: 4, fontSize: 16, fontWeight: '700', color: '#074D31' },
  locationMeta: { marginTop: 2, fontSize: 12, color: '#3F6B57' },
  primaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 16, backgroundColor: '#163E72', paddingHorizontal: 18 },
  onlineButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 16, backgroundColor: '#667085', paddingHorizontal: 18 },
  onlineButtonActive: { backgroundColor: '#067647' },
  workRow: { flexDirection: 'row', gap: 10 },
  workButton: { flex: 1, minHeight: 72, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD' },
  workButtonTitle: { fontSize: 15, fontWeight: '800', color: '#1D2939' },
  workButtonMeta: { marginTop: 4, fontSize: 11, color: '#667085' },
  logoutButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  logoutButtonText: { fontSize: 14, fontWeight: '700', color: '#344054' },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  onlineButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  error: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  note: { fontSize: 13, lineHeight: 19, color: '#667085' },
});