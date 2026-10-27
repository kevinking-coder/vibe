import type { VibeName } from "../config/vibes";

export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  vibe_tags: string[];
  hard_muted_vibes: string[];
  onboarding_complete: boolean;
};

export type FeedVideo = {
  id: string;
  user_id: string;
  optimized_url: string;
  caption: string;
  genre_tag: string;
  vibe_tag: VibeName;
  audio_attribution: string;
  duration_ms: number;
  view_count: number;
  like_count: number;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};
