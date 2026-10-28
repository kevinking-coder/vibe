import type { ImagePickerAsset } from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export async function uploadMedia(
  asset: Pick<ImagePickerAsset, "uri" | "mimeType">,
  onProgress?: (progress: number) => void,
): Promise<string> {
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary uploads are not configured. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in the EAS build environment.",
    );
  }

  const task = FileSystem.createUploadTask(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    asset.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: asset.mimeType ?? undefined,
      parameters: { upload_preset: uploadPreset },
    },
    (progress) => {
      if (progress.totalBytesExpectedToSend > 0) {
        onProgress?.(progress.totalBytesSent / progress.totalBytesExpectedToSend);
      }
    },
  );
  const response = await task.uploadAsync();
  if (!response) throw new Error("Cloudinary upload was cancelled.");

  let payload: { secure_url?: string; error?: { message?: string } };
  try {
    payload = JSON.parse(response.body) as typeof payload;
  } catch {
    throw new Error("Cloudinary returned an unreadable upload response.");
  }
  if (response.status < 200 || response.status >= 300 || !payload.secure_url) {
    throw new Error(payload.error?.message ?? `Cloudinary upload failed (${response.status}).`);
  }

  return payload.secure_url;
}

export const uploadVideo = uploadMedia;
export const uploadAvatar = uploadMedia;

export function withVideoTrim(url: string, startSeconds: number, endSeconds: number): string {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds <= startSeconds) {
    throw new Error("Choose a valid video trim range.");
  }
  const marker = "/video/upload/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) throw new Error("Cloudinary did not return a video URL that can be trimmed.");
  const insertionPoint = markerIndex + marker.length;
  return `${url.slice(0, insertionPoint)}so_${startSeconds},eo_${endSeconds},f_auto,q_auto/${url.slice(insertionPoint)}`;
}

export function optimizeMediaUrl(url: string): string {
  const marker = "/image/upload/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return url;
  const insertionPoint = markerIndex + marker.length;
  return `${url.slice(0, insertionPoint)}f_auto,q_auto,w_1080,c_limit/${url.slice(insertionPoint)}`;
}
