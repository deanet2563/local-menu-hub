import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const JOB_ALERT_SOUND = require('../../assets/sounds/mytree_rider_job_alert_v1.wav');

let activeSound: AudioPlayer | null = null;

export async function startIncomingJobAlert(): Promise<void> {
  if (activeSound) return;
  await setAudioModeAsync({ playsInSilentMode: true });
  const player = createAudioPlayer(JOB_ALERT_SOUND);
  player.loop = true;
  player.volume = 1;
  player.play();
  activeSound = player;
}

export async function stopIncomingJobAlert(): Promise<void> {
  const sound = activeSound;
  activeSound = null;
  if (!sound) return;
  sound.pause();
  sound.remove();
}
