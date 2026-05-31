import RNFS from 'react-native-fs';

const RECEIPTS_DIR = `${RNFS.DocumentDirectoryPath}/receipts`;

async function ensureDir(): Promise<void> {
  const exists = await RNFS.exists(RECEIPTS_DIR);
  if (!exists) {
    await RNFS.mkdir(RECEIPTS_DIR);
  }
}

/**
 * Copies a receipt image to the app's permanent documents directory.
 * Returns the permanent file:// URI.
 */
export async function saveReceiptImage(uri: string): Promise<string> {
  await ensureDir();

  const filename = `receipt_${Date.now()}.jpg`;
  const destPath = `${RECEIPTS_DIR}/${filename}`;

  // Normalize source path
  const sourcePath = uri.startsWith('file://') ? uri.slice(7) : uri;

  await RNFS.copyFile(sourcePath, destPath);
  return `file://${destPath}`;
}

/**
 * Deletes a stored receipt image. Safe to call if path is empty/undefined.
 */
export async function deleteReceiptImage(uri?: string): Promise<void> {
  if (!uri) return;
  try {
    const path = uri.startsWith('file://') ? uri.slice(7) : uri;
    const exists = await RNFS.exists(path);
    if (exists) await RNFS.unlink(path);
  } catch {
    // ignore
  }
}
