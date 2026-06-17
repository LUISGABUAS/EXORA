import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Sube una foto de perfil al bucket "avatars" de Supabase Storage.
 * Recibe el base64 directo del image picker (sin necesidad de RNFS).
 * Retorna la URL pública de la imagen.
 */
export async function uploadAvatarToSupabase(
  base64: string,
  userId: string,
): Promise<string> {
  // Decodificar base64 → Uint8Array sin Buffer ni atob
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;
  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean[i]] ?? 0;
    const b = lookup[clean[i + 1]] ?? 0;
    const c2 = lookup[clean[i + 2]] ?? 0;
    const d = lookup[clean[i + 3]] ?? 0;
    bytes[bi++] = (a << 2) | (b >> 4);
    if (clean[i + 2]) bytes[bi++] = ((b & 0xf) << 4) | (c2 >> 2);
    if (clean[i + 3]) bytes[bi++] = ((c2 & 0x3) << 6) | d;
  }
  const arrayBuffer = bytes.slice(0, bi);

  const storagePath = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(storagePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export interface FilePickerResult {
  uri: string;
  name: string;
  type?: string;
}

export interface ImagePickerResult {
  uri: string;
  base64?: string;
  fileName: string;
  width?: number;
  height?: number;
}

/**
 * Abre el selector de documentos para elegir un archivo XML
 */
export async function pickXMLFile(): Promise<FilePickerResult | null> {
  try {
    const DocumentPicker = require('react-native-document-picker').default;
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
    });

    if (result && result.length > 0) {
      const file = result[0];
      const name = file.name || 'document.xml';

      // Validar extension XML
      if (!name.toLowerCase().endsWith('.xml')) {
        throw new Error('El archivo seleccionado no es un XML valido.');
      }

      return {
        uri:
          Platform.OS === 'android'
            ? file.uri
            : file.uri.replace('file://', ''),
        name,
        type: file.type || undefined,
      };
    }
    return null;
  } catch (error: any) {
    const msg: string = error?.message ?? '';
    const isCancelled =
      error?.code === 'E_DOCUMENT_PICKER_CANCELLED' ||
      msg.includes('cancel') ||
      msg.includes('Cancel') ||
      msg.includes('3072') ||
      msg.includes('dismissed');
    if (isCancelled) return null;
    throw error;
  }
}

/**
 * Abre el selector de documentos para elegir un archivo PDF
 */
export async function pickPdfFile(): Promise<FilePickerResult | null> {
  try {
    const DocumentPicker = require('react-native-document-picker').default;
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.pdf],
    });

    if (result && result.length > 0) {
      const file = result[0];
      const name = file.name || 'document.pdf';

      if (!name.toLowerCase().endsWith('.pdf')) {
        throw new Error('El archivo seleccionado no es un PDF válido.');
      }

      return {
        uri:
          Platform.OS === 'android'
            ? file.uri
            : file.uri.replace('file://', ''),
        name,
        type: file.type || undefined,
      };
    }
    return null;
  } catch (error: any) {
    if (error?.code === 'E_DOCUMENT_PICKER_CANCELLED') {
      return null;
    }
    throw error;
  }
}

/**
 * Abre la galeria para seleccionar una foto de perfil (400x400, 80% quality).
 */
export async function pickProfilePhoto(): Promise<ImagePickerResult | null> {
  const ImagePicker = require('react-native-image-picker');

  const result = await ImagePicker.launchImageLibrary({
    mediaType: 'photo' as const,
    selectionLimit: 1,
    quality: 0.85,
    maxWidth: 800,
    maxHeight: 800,
    includeBase64: true,
  });

  if (result.didCancel || result.errorCode) {
    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Error al seleccionar imagen.');
    }
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    base64: asset.base64 ?? undefined,
    fileName: asset.fileName || 'avatar.jpg',
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Abre la camara para tomar una foto de perfil (400x400, 80% quality).
 */
export async function takeProfilePhoto(): Promise<ImagePickerResult | null> {
  const ImagePicker = require('react-native-image-picker');

  const result = await ImagePicker.launchCamera({
    mediaType: 'photo' as const,
    quality: 0.85,
    maxWidth: 800,
    maxHeight: 800,
    includeBase64: true,
  });

  if (result.didCancel || result.errorCode) {
    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Error al tomar foto.');
    }
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    base64: asset.base64 ?? undefined,
    fileName: asset.fileName || 'avatar.jpg',
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Abre la galeria de imagenes para seleccionar una foto.
 * Redimensiona a max 1600px de ancho y comprime al 70% para mejor rendimiento OCR.
 */
export async function pickImageFromGallery(): Promise<ImagePickerResult | null> {
  const ImagePicker = require('react-native-image-picker');

  const result = await ImagePicker.launchImageLibrary({
    mediaType: 'photo' as const,
    selectionLimit: 1,
    quality: 0.7,
    maxWidth: 1600,
    maxHeight: 2400,
  });

  if (result.didCancel || result.errorCode) {
    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Error al seleccionar imagen.');
    }
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    fileName: asset.fileName || 'photo.jpg',
    width: asset.width,
    height: asset.height,
  };
}
