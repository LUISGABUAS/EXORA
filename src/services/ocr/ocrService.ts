import { Camera } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function requestCameraPermission(): Promise<boolean> {
  const status = await Camera.requestCameraPermission();
  return status === 'granted';
}

export async function recognizeReceiptText(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri);
  return result.text;
}
