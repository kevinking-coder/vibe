export const VIBES = [
  "Chill",
  "Hype",
  "Dramatic",
  "Wholesome",
  "Funny",
  "Cozy",
  "Romantic",
  "Motivational",
  "Inspirational",
  "Nostalgic",
  "Mysterious",
  "Creepy",
  "Horror",
  "Tragic",
  "Sad",
  "Angry",
  "Energetic",
  "Peaceful",
  "Aesthetic",
  "Satisfying",
  "Chaotic",
  "Savage",
  "Emotional",
  "Educational",
  "Spiritual",
  "Confident",
  "Lonely",
  "Party",
  "Late Night",
  "Adventurous",
] as const;

export type VibeName = (typeof VIBES)[number];

export type VibeTheme = {
  label: VibeName;
  gradient: readonly [string, string];
  accent: string;
  icon: string;
};

const palette = [
  ["#32106B", "#A855F7", "#C084FC"],
  ["#7C2D12", "#FB6A21", "#FDBA74"],
  ["#172554", "#3B82F6", "#60A5FA"],
  ["#064E3B", "#34D399", "#6EE7B7"],
  ["#713F12", "#FACC15", "#FDE047"],
  ["#134E4A", "#2DD4BF", "#99F6E4"],
  ["#831843", "#EC4899", "#F9A8D4"],
  ["#7F1D1D", "#EF4444", "#FCA5A5"],
  ["#312E81", "#818CF8", "#C7D2FE"],
  ["#7C2D12", "#D97706", "#FCD34D"],
  ["#1E1B4B", "#6366F1", "#A5B4FC"],
  ["#3F1D2E", "#BE185D", "#FDA4AF"],
  ["#450A0A", "#B91C1C", "#F87171"],
  ["#3F1D2E", "#9D174D", "#F9A8D4"],
  ["#1E1B4B", "#6366F1", "#A5B4FC"],
  ["#431407", "#EA580C", "#FDBA74"],
  ["#14532D", "#22C55E", "#86EFAC"],
  ["#164E63", "#06B6D4", "#67E8F9"],
  ["#581C87", "#C084FC", "#E9D5FF"],
  ["#134E4A", "#14B8A6", "#99F6E4"],
  ["#4C1D95", "#7C3AED", "#C4B5FD"],
  ["#881337", "#F43F5E", "#FDA4AF"],
  ["#701A75", "#D946EF", "#F0ABFC"],
  ["#1E3A8A", "#2563EB", "#93C5FD"],
  ["#365314", "#84CC16", "#BEF264"],
  ["#7C2D12", "#F97316", "#FDBA74"],
  ["#312E81", "#4F46E5", "#A5B4FC"],
  ["#7F1D1D", "#DC2626", "#FCA5A5"],
  ["#18181B", "#52525B", "#D4D4D8"],
  ["#064E3B", "#10B981", "#6EE7B7"],
] as const;

const icons = [
  "moon-outline", "flash-outline", "film-outline", "heart-outline", "happy-outline", "cafe-outline", "flower-outline",
  "fitness-outline", "sunny-outline", "time-outline", "eye-outline", "cloud-outline", "skull-outline",
  "rainy-outline", "sad-outline", "flame-outline", "flash-outline", "leaf-outline", "color-palette-outline",
  "sparkles-outline", "shuffle-outline", "thumbs-down-outline", "water-outline", "school-outline",
  "planet-outline", "trophy-outline", "moon-outline", "musical-notes-outline", "moon-outline",
  "compass-outline",
] as const;

export const VIBE_THEMES = Object.fromEntries(
  VIBES.map((label, index) => {
    const [start, end, accent] = palette[index];
    return [label, { label, gradient: [start, end] as const, accent, icon: icons[index] }];
  }),
) as Record<VibeName, VibeTheme>;

export const GENRES = [
  "Comedy",
  "Storytime",
  "Music",
  "Dance",
  "Gaming",
  "Sports",
  "Fitness",
  "Food",
  "Cooking",
  "Travel",
  "Fashion",
  "Beauty",
  "Art",
  "DIY",
  "Tech",
  "Education",
  "News",
  "Pets",
  "Cars",
  "Nature",
  "Business",
  "Faith",
  "Relationships",
  "Skits",
  "Challenges",
  "Behind the Scenes",
  "Poetry",
  "Photography",
] as const;

export type GenreName = (typeof GENRES)[number];
export const DEFAULT_VIBE: VibeName = "Chill";

export type GenreTheme = {
  gradient: readonly [string, string];
  accent: string;
  icon: string;
};

const genreIcons = [
  "happy-outline", "chatbubbles-outline", "musical-notes-outline", "body-outline",
  "game-controller-outline", "football-outline", "fitness-outline", "restaurant-outline",
  "flame-outline", "airplane-outline", "shirt-outline", "color-palette-outline",
  "brush-outline", "hammer-outline", "laptop-outline", "school-outline",
  "newspaper-outline", "paw-outline", "car-sport-outline", "leaf-outline",
  "briefcase-outline", "sparkles-outline", "people-outline", "film-outline",
  "trophy-outline", "videocam-outline", "book-outline", "camera-outline",
] as const;

export const GENRE_THEMES = Object.fromEntries(
  GENRES.map((genre, index) => {
    const [start, end, accent] = palette[index % palette.length];
    return [genre, { gradient: [start, end] as const, accent, icon: genreIcons[index] }];
  }),
) as Record<GenreName, GenreTheme>;
