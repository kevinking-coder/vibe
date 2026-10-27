import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "./supabase";

async function uploadAsset(
  bucket: "videos" | "avatars",
  asset: ImagePickerAsset,
  userId: string,
): Promise<string> {
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error(`Could not read selected media (${response.status}).`);
  }

  const file = await response.arrayBuffer();
  const extension =
    asset.fileName?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    (asset.mimeType?.split("/").pop() ?? (bucket === "videos" ? "mp4" : "jpg"));
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: asset.mimeType ?? (bucket === "videos" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function uploadVideo(asset: ImagePickerAsset, userId: string) {
  return uploadAsset("videos", asset, userId);
}

export function uploadAvatar(asset: ImagePickerAsset, userId: string) {
  return uploadAsset("avatars", asset, userId);
}
