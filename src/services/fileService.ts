import { Platform } from 'react-native';

export interface FilePickerResult {
  uri: string;
  name: string;
  type?: string;
}

export interface ImagePickerResult {
  uri: string;
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
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
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
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
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
    quality: 0.8,
    maxWidth: 400,
    maxHeight: 400,
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
    quality: 0.8,
    maxWidth: 400,
    maxHeight: 400,
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
