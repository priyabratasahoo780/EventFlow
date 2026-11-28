import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import api from './api';

const MEDIA_DIR_NAME = 'eventflow_media';
const LOCAL_MEDIA_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${MEDIA_DIR_NAME}/`
  : '';

function getSafeExtension(uri: string, kind: 'image' | 'video'): string {
  const clean = uri.split('?')[0].split('#')[0];
  const match = /\.([a-zA-Z0-9]+)$/.exec(clean);
  if (match && match[1].length <= 5) {
    return match[1].toLowerCase();
  }
  return kind === 'video' ? 'mp4' : 'jpg';
}

export function isLocalMediaUri(uri?: string | null): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  );
}

//  Copies a user-picked photo or video from temporary picker cache into persistent
//  app-sandboxed device storage (documentDirectory) so private media lives strictly on
//  the user's device and never uploads to the backend server.
export async function saveMediaToDevice(
  sourceUri: string,
  prefix: 'profile' | 'task_img' | 'task_vid'
): Promise<string> {
  if (!sourceUri) return sourceUri;

  // Web browsers have no native documentDirectory; keep local blob/object URI
  if (Platform.OS === 'web' || !LOCAL_MEDIA_DIR) {
    return sourceUri;
  }

  // Already persisted inside our device media folder
  if (sourceUri.startsWith(LOCAL_MEDIA_DIR)) {
    return sourceUri;
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_MEDIA_DIR, { intermediates: true });
    }

    const kind = prefix === 'task_vid' ? 'video' : 'image';
    const ext = getSafeExtension(sourceUri, kind);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const destUri = `${LOCAL_MEDIA_DIR}${prefix}_${uniqueSuffix}.${ext}`;

    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (err) {
    console.warn('[LocalMedia] Failed to persist media to device storage:', err);
    return sourceUri;
  }
}

//  Uploads a local image or video to the backend Cloudinary endpoint.
//  Used ONLY when sharing tasks with connected friends or publishing Admin Festival Cards.
export async function uploadMediaToCloud(
  sourceUri: string,
  kind: 'image' | 'video'
): Promise<string> {
  if (!sourceUri) return sourceUri;
  if (!isLocalMediaUri(sourceUri)) {
    return sourceUri;
  }

  const ext = getSafeExtension(sourceUri, kind);
  const filename = `${kind}_${Date.now()}.${ext}`;
  const mime =
    kind === 'video'
      ? ext === 'mov'
        ? 'video/quicktime'
        : ext === 'webm'
          ? 'video/webm'
          : 'video/mp4'
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

  const formData = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(sourceUri);
    const blob = await response.blob();
    formData.append(kind, blob, filename);
  } else {
    formData.append(kind, { uri: sourceUri, name: filename, type: mime } as any);
  }

  const endpoint = kind === 'video' ? '/upload/video' : '/upload/image';
  const res = await api.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 minutes for high-res photos & videos on mobile networks
  });

  if (res.data?.url) {
    return res.data.url;
  }

  throw new Error('Cloud upload returned an invalid response.');
}

//  Deletes a previously persisted on-device media file inside eventflow_media/.
//  Ignores remote URLs or files outside our sandboxed media folder.
export async function deleteLocalMediaIfOwned(uri?: string | null): Promise<void> {
  if (!uri || !LOCAL_MEDIA_DIR || Platform.OS === 'web') return;
  if (!uri.startsWith(LOCAL_MEDIA_DIR)) return;

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (err) {
    console.warn('[LocalMedia] Cleanup warning:', err);
  }
}
