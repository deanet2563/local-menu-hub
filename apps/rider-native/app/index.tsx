import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { exchangeLineIdToken } from '@/auth/broker';
import { nativeLineLogin } from '@/auth/lineNative';
import { clearRiderSession, isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { registerPushDevice } from '@/data/pushDeviceRepository';
import { getRiderProfile, setRiderOnline, updateRiderLocation, type RiderProfile } from '@/data/riderRepository';
import { ensureForegroundLocation, isLocationFresh, type RiderLocation } from '@/services/location';
import { ensurePushReadiness } from '@/services/notifications';

type ReadinessState = 'pending' | 'checking' | 'ready' | 'blocked';

type HealthRowProps = {
  label: string;
  value: string;
  state?: ReadinessState;
};

function HealthRow({ label, value, state = 'pending' }: HealthRowProps) {
  return (
    <View style={styles.healthRow}>
      <View
        style={[
          styles.dot,
          state === 'ready' && styles.dotReady,
          state === 'blocked' && styles.dotBlocked,
          (state === 'pending' || state === 'checking') && styles.dotPending,
        ]}
      />
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
  const [pushState, setPushState] = useState<ReadinessState>('pending');
  const [pushText, setPushText] = useState('à¸£à¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š');
  const [locationState, setLocationState] = useState<ReadinessState>('pending');
  const [locationText, setLocationText] = useState('à¸£à¸­à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š');
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [session, setSession] = useState<RiderSession | null>(null);
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [accountState, setAccountState] = useState<ReadinessState>('checking');
  const [accountText, setAccountText] = useState('à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆ MyTree session...');
  const [error, setError] = useState<string | null>(null);

  function applyRiderProfile(profile: RiderProfile | null) {
    setRider(profile);

    if (!profile) {
      setAccountState('blocked');
      setAccountText('à¹„à¸¡à¹ˆà¸žà¸šà¸šà¸±à¸à¸Šà¸µ Rider à¸ªà¸³à¸«à¸£à¸±à¸šà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸™à¸µà¹‰');
    } else if (profile.is_banned) {
      setAccountState('blocked');
      setAccountText('à¸šà¸±à¸à¸Šà¸µ Rider à¸–à¸¹à¸à¸£à¸°à¸‡à¸±à¸š');
    } else if (profile.deletion_requested_at) {
      setAccountState('blocked');
      setAccountText('à¸šà¸±à¸à¸Šà¸µà¸­à¸¢à¸¹à¹ˆà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¸„à¸³à¸‚à¸­à¸¥à¸š');
    } else if (!profile.is_approved) {
      setAccountState('pending');
      setAccountText('à¸£à¸­ Admin à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´ Rider');
    } else {
      setAccountState('ready');
      setAccountText(`${profile.name} Â· ${profile.vehicle_type ?? 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸à¸žà¸²à¸«à¸™à¸°'}`);
    }
  }

  async function restoreAccount() {
    setAccountState('checking');
    setAccountText('à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆ MyTree session...');

    const saved = await loadRiderSession();
    if (!saved) {
      setSession(null);
      setRider(null);
      setAccountState('pending');
      setAccountText('à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸”à¹‰à¸§à¸¢ LINE à¹€à¸žà¸·à¹ˆà¸­à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸šà¸±à¸à¸Šà¸µ Rider');
      return;
    }

    if (!isSessionFresh(saved)) {
      await clearRiderSession();
      setSession(null);
      setRider(null);
      setAccountState('blocked');
      setAccountText('Session à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸ â€” à¸•à¹‰à¸­à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸«à¸¡à¹ˆ');
      return;
    }

    try {
      const profile = await getRiderProfile(saved);
      setSession(saved);
      applyRiderProfile(profile);
    } catch (cause) {
      setAccountState('blocked');
      setAccountText('à¸­à¹ˆà¸²à¸™à¸šà¸±à¸à¸Šà¸µ Rider à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  useEffect(() => {
    void restoreAccount();
  }, []);

  async function signInWithLine() {
    if (signingIn) return;

    setSigningIn(true);
    setError(null);
    setAccountState('checking');
    setAccountText('à¸à¸³à¸¥à¸±à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š LINE...');

    try {
      const { idToken } = await nativeLineLogin();
      const newSession = await exchangeLineIdToken(idToken);
      const profile = await getRiderProfile(newSession);

      setSession(newSession);
      applyRiderProfile(profile);

      if (profile) {
        const push = await ensurePushReadiness();
        if (push.ready && push.token) {
          await registerPushDevice(newSession, profile.id, push.token);
          setPushState('ready');
          setPushText('à¸žà¸£à¹‰à¸­à¸¡à¸£à¸±à¸š Native Push Â· à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸­à¸¸à¸›à¸à¸£à¸“à¹Œà¹à¸¥à¹‰à¸§');
        }
      }
    } catch (cause) {
      setSession(null);
      setRider(null);
      setAccountState('blocked');
      setAccountText('à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š LINE à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
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
    setPushText('à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š...');
    setLocationText('à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š...');

    const [pushResult, locationResult] = await Promise.allSettled([
      ensurePushReadiness(),
      ensureForegroundLocation(),
    ]);

    if (pushResult.status === 'fulfilled') {
      setPushState(pushResult.value.ready ? 'ready' : 'blocked');
      setPushText(
        pushResult.value.ready
          ? 'à¸žà¸£à¹‰à¸­à¸¡à¸£à¸±à¸š Native Push'
          : pushResult.value.reason ?? 'Push à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡',
      );

      if (pushResult.value.ready && pushResult.value.token && session && rider) {
        try {
          await registerPushDevice(session, rider.id, pushResult.value.token);
          setPushText('à¸žà¸£à¹‰à¸­à¸¡à¸£à¸±à¸š Native Push Â· à¸¥à¸‡à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸­à¸¸à¸›à¸à¸£à¸“à¹Œà¹à¸¥à¹‰à¸§');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    } else {
      setPushState('blocked');
      setPushText('à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š Push à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    }

    if (locationResult.status === 'fulfilled') {
      const currentLocation = locationResult.value.location;
      setLocationState(locationResult.value.ready ? 'ready' : 'blocked');
      setLocation(currentLocation);
      setLocationText(
        locationResult.value.ready
          ? 'à¹„à¸”à¹‰à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹à¸¥à¹‰à¸§'
          : locationResult.value.reason ?? 'à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸žà¸£à¹‰à¸­à¸¡',
      );

      if (locationResult.value.ready && currentLocation && session && rider) {
        try {
          await updateRiderLocation(session, rider.id, currentLocation);
          const refreshedProfile = await getRiderProfile(session);
          if (refreshedProfile) setRider(refreshedProfile);
          setLocationText('à¹„à¸”à¹‰à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹à¸¥à¹‰à¸§ Â· à¸­à¸±à¸›à¹€à¸”à¸• MyTree à¹à¸¥à¹‰à¸§');
        } catch (cause) {
          setLocationState('blocked');
          setLocationText('à¹„à¸”à¹‰ GPS à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¹ƒà¸™ MyTree à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    } else {
      setLocationState('blocked');
      setLocationText('à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ');
    }

    const failures = [pushResult, locationResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => (result.status === 'rejected' ? String(result.reason) : ''));

    if (failures.length) setError(failures.join('\n'));
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
        if (pushState !== 'ready') {
          throw new Error('à¸•à¹‰à¸­à¸‡à¹€à¸›à¸´à¸” Native Push Notification à¸à¹ˆà¸­à¸™ Online');
        }

        let freshLocation = location;
        if (!freshLocation || !isLocationFresh(freshLocation.capturedAt)) {
          const refreshed = await ensureForegroundLocation();
          if (!refreshed.ready || !refreshed.location) {
            throw new Error(refreshed.reason ?? 'à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸à¹ˆà¸­à¸™ Online');
          }
          freshLocation = refreshed.location;
          setLocation(freshLocation);
          setLocationState('ready');
          setLocationText('à¹„à¸”à¹‰à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¹à¸¥à¹‰à¸§');
        }

        await setRiderOnline(session, rider, true, freshLocation);
      }

      const profile = await getRiderProfile(session);
      setRider(profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUpdatingOnline(false);
    }
  }

  const nativeReady = pushState === 'ready' && locationState === 'ready';
  const accountReady = accountState === 'ready' && !!session && !!rider;
  const canToggleOnline = accountReady && (rider?.is_online === true || nativeReady);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FOOD DELIVERY ONLY</Text>
          <Text style={styles.title}>à¸žà¸£à¹‰à¸­à¸¡à¸£à¸±à¸šà¸‡à¸²à¸™</Text>
          <Text style={styles.subtitle}>
            Rider à¸•à¹‰à¸­à¸‡à¸¡à¸µà¸šà¸±à¸à¸Šà¸µà¸—à¸µà¹ˆà¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¹à¸¥à¹‰à¸§ à¸žà¸£à¹‰à¸­à¸¡ Native Push à¹à¸¥à¸°à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸à¹ˆà¸­à¸™à¹€à¸›à¸´à¸” Online
          </Text>
        </View>

        <View style={styles.card}>
          <HealthRow label="à¸šà¸±à¸à¸Šà¸µà¹„à¸£à¹€à¸”à¸­à¸£à¹Œ" value={accountText} state={accountState} />
          <HealthRow label="à¸à¸²à¸£à¹à¸ˆà¹‰à¸‡à¹€à¸•à¸·à¸­à¸™" value={pushText} state={pushState} />
          <HealthRow label="à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡" value={locationText} state={locationState} />
          <HealthRow
            label="à¸ªà¸–à¸²à¸™à¸°à¸£à¸±à¸šà¸‡à¸²à¸™"
            value={rider?.is_online ? 'Online â€” à¸žà¸£à¹‰à¸­à¸¡à¸£à¸±à¸šà¸‡à¸²à¸™à¸ªà¹ˆà¸‡à¸­à¸²à¸«à¸²à¸£' : 'Offline'}
            state={rider?.is_online ? 'ready' : 'pending'}
          />
        </View>

        {!session && (
          <Pressable
            style={[styles.lineButton, signingIn && styles.buttonDisabled]}
            accessibilityRole="button"
            disabled={signingIn}
            onPress={signInWithLine}
          >
            <Text style={styles.lineButtonText}>
              {signingIn ? 'à¸à¸³à¸¥à¸±à¸‡à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š LINE...' : 'à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸”à¹‰à¸§à¸¢ LINE'}
            </Text>
          </Pressable>
        )}

        {location && (
          <View style={styles.locationCard}>
            <Text style={styles.locationLabel}>à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸šà¸™à¸­à¸¸à¸›à¸à¸£à¸“à¹Œ</Text>
            <Text style={styles.locationValue}>
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </Text>
            <Text style={styles.locationMeta}>
              Accuracy {location.accuracy ? `${Math.round(location.accuracy)} m` : 'unknown'}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, checking && styles.buttonDisabled]}
          accessibilityRole="button"
          disabled={checking}
          onPress={checkReadiness}
        >
          <Text style={styles.primaryButtonText}>
            {checking ? 'à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š...' : 'à¸•à¸£à¸§à¸ˆ Push + Location'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.onlineButton,
            rider?.is_online && styles.onlineButtonActive,
            (!canToggleOnline || updatingOnline) && styles.buttonDisabled,
          ]}
          accessibilityRole="button"
          disabled={!canToggleOnline || updatingOnline}
          onPress={toggleOnline}
        >
          <Text style={styles.onlineButtonText}>
            {updatingOnline
              ? 'à¸à¸³à¸¥à¸±à¸‡à¸­à¸±à¸›à¹€à¸”à¸•...'
              : rider?.is_online
                ? 'à¸­à¸­à¸ Offline'
                : 'à¹€à¸›à¸´à¸” Online à¸£à¸±à¸šà¸‡à¸²à¸™'}
          </Text>
        </Pressable>

        <View style={styles.workRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!accountReady}
            onPress={() => router.push('/active-delivery')}
            style={[styles.workButton, !accountReady && styles.buttonDisabled]}
          >
            <Text style={styles.workButtonTitle}>à¸‡à¸²à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</Text>
            <Text style={styles.workButtonMeta}>Pickup â†’ Delivery</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!rider?.is_online || !riderFeatures.candidateFlow}
            onPress={() => router.push('/nearby-jobs')}
            style={[
              styles.workButton,
              (!rider?.is_online || !riderFeatures.candidateFlow) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.workButtonTitle}>à¸‡à¸²à¸™à¹ƒà¸à¸¥à¹‰à¸‰à¸±à¸™</Text>
            <Text style={styles.workButtonMeta}>
              {riderFeatures.candidateFlow ? 'Nearby Rider Offer' : 'à¸£à¸­ backend gate'}
            </Text>
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.note}>
          LINE SDK à¸„à¸·à¸™à¹€à¸‰à¸žà¸²à¸° OpenID Connect ID token à¹ƒà¸«à¹‰ MyTree Worker à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¹à¸¥à¸à¹€à¸›à¹‡à¸™ Supabase JWT; session à¹€à¸à¹‡à¸šà¹ƒà¸™ SecureStore à¹à¸¥à¸° Push token à¸–à¸¹à¸à¸œà¸¹à¸à¸à¸±à¸š Rider à¸«à¸¥à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹à¸¥à¹‰à¸§à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FB' },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 18 },
  header: { gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#246B50' },
  title: { fontSize: 30, fontWeight: '800', color: '#112235' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#5B6877' },
  card: {
    gap: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotReady: { backgroundColor: '#2F855A' },
  dotPending: { backgroundColor: '#D69E2E' },
  dotBlocked: { backgroundColor: '#C53030' },
  healthText: { flex: 1 },
  healthLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  healthValue: { marginTop: 2, fontSize: 13, color: '#667085' },
  locationCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#ABEFC6',
  },
  locationLabel: { fontSize: 12, fontWeight: '700', color: '#067647' },
  locationValue: { marginTop: 4, fontSize: 16, fontWeight: '700', color: '#074D31' },
  locationMeta: { marginTop: 2, fontSize: 12, color: '#3F6B57' },
  lineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#06C755',
    paddingHorizontal: 18,
  },
  lineButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#163E72',
    paddingHorizontal: 18,
  },
  onlineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#667085',
    paddingHorizontal: 18,
  },
  onlineButtonActive: { backgroundColor: '#067647' },
  workRow: { flexDirection: 'row', gap: 10 },
  workButton: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  workButtonTitle: { fontSize: 15, fontWeight: '800', color: '#1D2939' },
  workButtonMeta: { marginTop: 4, fontSize: 11, color: '#667085' },
  buttonDisabled: { opacity: 0.45 },
  primaryButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  onlineButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  error: { fontSize: 13, lineHeight: 19, color: '#B42318' },
  note: { fontSize: 13, lineHeight: 19, color: '#667085' },
});
