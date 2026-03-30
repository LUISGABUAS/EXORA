import { Camera } from 'react-native-vision-camera';

export async function requestCameraPermission(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}

export async function requestPhotoLibraryPermission(): Promise<boolean> {
  // Handled via react-native-permissions at the image picker level
  return true;
}
