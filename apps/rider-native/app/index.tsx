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
import {
  getActiveAssignedDelivery,
  listRecentCompletedDeliveries,
  type AssignedDelivery,
} from '@/data/assignedDeliveryRepository';
import { registerPushDevice } from '@/data/pushDeviceRepository';
import { getRiderProfile, setRiderOnline, updateRiderLocation, type RiderProfile } from '@/data/riderRepository';
import { summarizeTodayRiderWork, type RiderDashboardSummary } from '@/domain/riderDashboardState';
import { ensureForegroundLocation, isLocationFresh, type RiderLocation } from '@/services/location';
import { ensurePushReadiness } from '@/services/notifications';

type ReadinessState = 'pending' | 'checking' | 'ready' | 'blocked';

type DiagnosticRowProps = { label: string; value: string; state?: ReadinessState };

const EMPTY_SUMMARY: RiderDashboardSummary = { earnings: 0, completedJobs: 0, distanceKm: 0 };

function DiagnosticRow({ label, value, state = 'pending' }: DiagnosticRowProps) {
  return (
    <View style={styles.diagnosticRow}>
      <View style={[styles.dot, state === 'ready' && styles.dotReady, state === 'blocked' && styles.dotBlocked, (state === 'pending' || state === 'checking') && styles.dotPending]} />
      <View style={styles.diagnosticText}>
        <Text style={styles.diagnosticLabel}>{label}</Text>
        <Text style={styles.diagnosticValue}>{value}</Text>
      </View>
    </View>
  );
}

function routeForStatus(job: AssignedDelivery | null) {
  if (!job) return 'ยังไม่มีงานปัจจุบัน';
  if (job.delivery_status === 'rider_called') return 'กำลังไปรับของที่ร้าน';
  if (job.delivery_status === 'picked_up') return 'กำลังนำส่งลูกค้า';
  return 'กำลังอัปเดตสถานะงาน';
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
  const [activeJob, setActiveJob] = useState<AssignedDelivery | null>(null);
  const [summary, setSummary] = useState<RiderDashboardSummary>(EMPTY_SUMMARY);
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
      setAccountText(`${profile.name} · ${profile.vehicle_type ?? 'ยังไม่ระบุพาหนะ'}`);
    }
  }

  async function loadDashboard(activeSession: RiderSession) {
    const [activeResult, completedResult] = await Promise.allSettled([
      getActiveAssignedDelivery(activeSession),
      listRecentCompletedDeliveries(activeSession),
    ]);
    if (activeResult.status === 'fulfilled') setActiveJob(activeResult.value);
    if (completedResult.status === 'fulfilled') setSummary(summarizeTodayRiderWork(completedResult.value));
  }

  async function syncOnlineDeviceState(activeSession: RiderSession, profile: RiderProfile) {
    if (!profile.is_online) return;
    setPushState('checking');
    setLocationState('checking');
    setPushText('กำลังซิงก์ Push...');
    setLocationText('กำลังอัปเดตตำแหน่ง...');

    const [pushResult, locationResult] = await Promise.allSettled([
      ensurePushReadiness(),
      ensureForegroundLocation(),
    ]);

    if (pushResult.status === 'fulfilled' && pushResult.value.ready && pushResult.value.token) {
      if (riderFeatures.pushDeviceRegistry) {
        try {
          await registerPushDevice(activeSession, profile.id, pushResult.value.token);
          setPushState('ready');
          setPushText('พร้อมรับ Push');
        } catch (cause) {
          setPushState('blocked');
          setPushText('Push พร้อม แต่ลงทะเบียนอุปกรณ์ไม่สำเร็จ');
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } else {
        setPushState('ready');
        setPushText('พร้อมรับ Push');
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
        setLocationText('ตำแหน่งล่าสุดพร้อม');
      } catch (cause) {
        setLocationState('blocked');
        setLocationText('ได้ตำแหน่งแล้ว แต่ซิงก์ระบบไม่สำเร็จ');
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
      setActiveJob(null);
      setAccountState('pending');
      setAccountText('เข้าสู่ระบบด้วย LINE เพื่อเชื่อมบัญชี Rider');
      return;
    }

    let activeSession = saved;
    if (!isSessionFresh(activeSession)) {
      if (activeSession.refreshToken && isRefreshSessionFresh(activeSession)) {
        try {
          setAccountText('กำลังต่ออายุ session...');
          activeSession = await refreshRiderSession(activeSession.refreshToken);
        } catch (cause) {
          await clearRiderSession();
          setSession(null);
          setRider(null);
          setAccountState('blocked');
          setAccountText('Session ต่ออายุไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่');
          setError(cause instanceof Error ? cause.message : String(cause));
          return;
        }
      } else {
        await clearRiderSession();
        setSession(null);
        setRider(null);
        setAccountState('blocked');
        setAccountText('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        return;
      }
    }

    try {
      const profile = await getRiderProfile(activeSession);
      setSession(activeSession);
      applyProfile(profile);
      await loadDashboard(activeSession);
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
      if (nextState === 'active') {
        void syncOnlineDeviceState(session, rider);
        void loadDashboard(session);
      }
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
      await loadDashboard(newSession);
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
      setPushText(pushResult.value.ready ? 'พร้อมรับ Push' : pushResult.value.reason ?? 'Push ยังไม่พร้อม');
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
        if (pushState !== 'ready') throw new Error('ต้องเปิด Native Push ก่อน Online');
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
      const profile = await getRiderProfile(session);
      applyProfile(profile);
      await loadDashboard(session);
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
      setActiveJob(null);
      setSummary(EMPTY_SUMMARY);
      setAccountState('pending');
      setAccountText('ออกจากระบบแล้ว กรุณาเข้าสู่ระบบ Rider');
      setLoggingOut(false);
    }
  }

  const nativeReady = pushState === 'ready' && locationState === 'ready';
  const accountReady = accountState === 'ready' && !!session && !!rider;
  const canToggleOnline = accountReady && (rider?.is_online === true || nativeReady);
  const isOnline = rider?.is_online === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.eyebrow}>MyTree Rider</Text>
            <Text style={styles.title}>{isOnline ? 'พร้อมรับงาน' : 'พักรับงาน'}</Text>
            <Text style={styles.subtitle}>{accountReady ? accountText : 'เข้าสู่ระบบ Rider เพื่อเริ่มรับงานส่งอาหารและพัสดุในชุมชน'}</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isOnline, disabled: !canToggleOnline || updatingOnline }}
            disabled={!canToggleOnline || updatingOnline}
            onPress={toggleOnline}
            style={[styles.onlineSwitch, isOnline && styles.onlineSwitchActive, (!canToggleOnline || updatingOnline) && styles.buttonDisabled]}
          >
            <View style={[styles.switchKnob, isOnline && styles.switchKnobActive]} />
            <Text style={[styles.switchText, isOnline && styles.switchTextActive]}>{updatingOnline ? 'กำลังซิงก์' : isOnline ? 'Online' : 'Offline'}</Text>
          </Pressable>
        </View>

        {!session && (
          <Pressable accessibilityRole="button" disabled={signingIn} onPress={signInWithLine} style={[styles.lineButton, signingIn && styles.buttonDisabled]}>
            <Text style={styles.lineButtonText}>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย LINE'}</Text>
          </Pressable>
        )}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>รายได้วันนี้</Text>
            <Text style={styles.metricValue}>฿{summary.earnings.toFixed(0)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>งานสำเร็จ</Text>
            <Text style={styles.metricValue}>{summary.completedJobs}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>ระยะทาง</Text>
            <Text style={styles.metricValue}>{summary.distanceKm.toFixed(1)} กม.</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" disabled={!accountReady || !activeJob} onPress={() => router.push('/active-delivery')} style={[styles.activeCard, !activeJob && styles.activeCardEmpty]}>
          <Text style={styles.sectionLabel}>งานปัจจุบัน</Text>
          <Text style={styles.activeTitle}>{routeForStatus(activeJob)}</Text>
          {activeJob ? (
            <Text style={styles.activeMeta} numberOfLines={2}>{activeJob.shops?.name ?? activeJob.shop_id} → {activeJob.delivery_address ?? 'จุดส่งลูกค้า'}</Text>
          ) : (
            <Text style={styles.activeMeta}>เมื่อรับงานสำเร็จ งานจะขึ้นที่นี่ทันที</Text>
          )}
        </Pressable>

        <View style={styles.primaryActions}>
          <Pressable accessibilityRole="button" disabled={!isOnline || !riderFeatures.deliveryV3Accept} onPress={() => router.push('/nearby-jobs')} style={[styles.incomingButton, (!isOnline || !riderFeatures.deliveryV3Accept) && styles.buttonDisabled]}>
            <Text style={styles.incomingButtonTitle}>งานเข้า</Text>
            <Text style={styles.incomingButtonText}>เปิดดูและรับงานใหม่</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!accountReady} onPress={() => router.push('/active-delivery')} style={[styles.currentButton, !accountReady && styles.buttonDisabled]}>
            <Text style={styles.currentButtonTitle}>งานปัจจุบัน</Text>
            <Text style={styles.currentButtonText}>รับสินค้า → ส่งสำเร็จ</Text>
          </Pressable>
        </View>

        <View style={styles.navGrid}>
          {[
            ['ประวัติ', '/history'],
            ['รายได้', '/earnings'],
            ['แชท', '/chat'],
            ['โปรไฟล์', '/profile'],
            ['ตั้งค่า', '/settings'],
            ['ช่วยเหลือ', '/help'],
          ].map(([label, href]) => (
            <Pressable key={href} accessibilityRole="button" disabled={!accountReady} onPress={() => router.push(href as never)} style={[styles.navTile, !accountReady && styles.buttonDisabled]}>
              <Text style={styles.navTileText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.diagnosticsCard}>
          <View style={styles.diagnosticsHeader}>
            <Text style={styles.sectionLabel}>Settings / Diagnostics</Text>
            <Pressable accessibilityRole="button" disabled={checking} onPress={checkReadiness}>
              <Text style={styles.refreshText}>{checking ? 'กำลังตรวจ...' : 'ตรวจอีกครั้ง'}</Text>
            </Pressable>
          </View>
          <DiagnosticRow label="บัญชี" value={accountText} state={accountState} />
          <DiagnosticRow label="Push" value={pushText} state={pushState} />
          <DiagnosticRow label="ตำแหน่ง" value={locationText} state={locationState} />
          {location && <Text style={styles.locationText}>ตำแหน่งล่าสุด {location.lat.toFixed(5)}, {location.lng.toFixed(5)} · accuracy {location.accuracy ? `${Math.round(location.accuracy)} m` : 'unknown'}</Text>}
        </View>

        {!!session && (
          <Pressable accessibilityRole="button" disabled={loggingOut} onPress={logout} style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}>
            <Text style={styles.logoutButtonText}>{loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F2' },
  scrollView: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32, gap: 16 },
  hero: { gap: 16, padding: 18, borderRadius: 8, backgroundColor: '#122319' },
  eyebrow: { fontSize: 12, fontWeight: '800', color: '#8EE6B0' },
  title: { marginTop: 4, fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 5, fontSize: 14, lineHeight: 20, color: '#D6E8DD' },
  onlineSwitch: { minHeight: 62, borderRadius: 8, backgroundColor: '#F2F4F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  onlineSwitchActive: { backgroundColor: '#16A34A' },
  switchKnob: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#98A2B3' },
  switchKnobActive: { backgroundColor: '#FFFFFF' },
  switchText: { fontSize: 18, fontWeight: '900', color: '#344054' },
  switchTextActive: { color: '#FFFFFF' },
  lineButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 8, backgroundColor: '#06C755', paddingHorizontal: 18 },
  lineButtonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, minHeight: 88, justifyContent: 'center', padding: 12, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  metricLabel: { fontSize: 11, fontWeight: '800', color: '#667085' },
  metricValue: { marginTop: 6, fontSize: 21, fontWeight: '900', color: '#122319' },
  activeCard: { gap: 6, padding: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#70D69B' },
  activeCardEmpty: { borderColor: '#DDE5D7' },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#667085' },
  activeTitle: { fontSize: 20, fontWeight: '900', color: '#1D2939' },
  activeMeta: { fontSize: 13, lineHeight: 19, color: '#667085' },
  primaryActions: { flexDirection: 'row', gap: 10 },
  incomingButton: { flex: 1, minHeight: 82, justifyContent: 'center', padding: 14, borderRadius: 8, backgroundColor: '#246B50' },
  currentButton: { flex: 1, minHeight: 82, justifyContent: 'center', padding: 14, borderRadius: 8, backgroundColor: '#163E72' },
  incomingButtonTitle: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  currentButtonTitle: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  incomingButtonText: { marginTop: 4, fontSize: 12, color: '#DDF5E7' },
  currentButtonText: { marginTop: 4, fontSize: 12, color: '#DCE9FF' },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  navTile: { width: '31.8%', minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  navTileText: { fontSize: 14, fontWeight: '900', color: '#344054' },
  diagnosticsCard: { gap: 12, padding: 14, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5D7' },
  diagnosticsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  refreshText: { fontSize: 13, fontWeight: '900', color: '#246B50' },
  diagnosticRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotReady: { backgroundColor: '#2F855A' },
  dotPending: { backgroundColor: '#D69E2E' },
  dotBlocked: { backgroundColor: '#C53030' },
  diagnosticText: { flex: 1 },
  diagnosticLabel: { fontSize: 13, fontWeight: '800', color: '#344054' },
  diagnosticValue: { marginTop: 2, fontSize: 12, color: '#667085' },
  locationText: { fontSize: 12, lineHeight: 18, color: '#667085' },
  logoutButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  logoutButtonText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  buttonDisabled: { opacity: 0.45 },
  error: { fontSize: 13, lineHeight: 19, color: '#B42318' },
});
