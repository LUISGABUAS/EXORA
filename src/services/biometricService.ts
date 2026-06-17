import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export type BiometricType = 'FaceID' | 'TouchID' | 'Biometrics' | 'none';

/**
 * Returns what biometric type is available on this device, or 'none'.
 */
export async function getAvailableBiometric(): Promise<BiometricType> {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    if (!available) return 'none';
    if (biometryType === BiometryTypes.FaceID) return 'FaceID';
    if (biometryType === BiometryTypes.TouchID) return 'TouchID';
    return 'Biometrics';
  } catch {
    return 'none';
  }
}

/**
 * Prompts the user for biometric authentication.
 * Returns true if successful.
 */
export async function authenticateWithBiometrics(reason = 'Confirma tu identidad para acceder a Exora'): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({ promptMessage: reason });
    return success;
  } catch {
    return false;
  }
}

/**
 * Returns a human-readable label for the biometric type.
 */
export function getBiometricLabel(type: BiometricType): string {
  switch (type) {
    case 'FaceID': return 'Face ID';
    case 'TouchID': return 'Touch ID';
    case 'Biometrics': return 'Huella digital';
    default: return '';
  }
}

/**
 * Returns the icon name for the biometric type.
 */
export function getBiometricIcon(type: BiometricType): string {
  switch (type) {
    case 'FaceID': return 'face-recognition';
    case 'TouchID': return 'fingerprint';
    case 'Biometrics': return 'fingerprint';
    default: return 'lock-outline';
  }
}
