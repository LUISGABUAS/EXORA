import { NativeModules, Platform } from 'react-native';

export function minimizeApp() {
  if (Platform.OS === 'ios') {
    NativeModules.AppMinimizer?.minimize();
  } else if (Platform.OS === 'android') {
    NativeModules.AppMinimizer?.minimize();
  }
}
