import { Vibration } from 'react-native';

let activeOfferId: string | null = null;

export function startActiveJobAlert(offerId: string) {
  if (activeOfferId === offerId) return;
  stopActiveJobAlert();
  activeOfferId = offerId;
  Vibration.vibrate([0, 700, 450], true);
}

export function stopActiveJobAlert(offerId?: string) {
  if (offerId && activeOfferId !== offerId) return;
  Vibration.cancel();
  activeOfferId = null;
}

export function getActiveJobAlertId() {
  return activeOfferId;
}
