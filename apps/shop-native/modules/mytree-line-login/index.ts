import { requireNativeModule } from 'expo';

export type MyTreeLineLoginResult = { idToken: string };

export default requireNativeModule<{
  login(): Promise<MyTreeLineLoginResult>;
  logout(): Promise<void>;
}>('MyTreeLineLogin');
