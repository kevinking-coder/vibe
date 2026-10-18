export type VibeName = "Chill" | "Hype" | "Dramatic" | "Wholesome" | "Funny";

export type VibeTheme = {
  label: VibeName;
  gradient: readonly [string, string];
  accent: string;
};

export const VIBE_THEMES: Record<VibeName, VibeTheme> = {
  Chill: {
    label: "Chill",
    gradient: ["#32106B", "#A855F7"],
    accent: "#A855F7",
  },
  Hype: {
    label: "Hype",
    gradient: ["#7C2D12", "#FB6A21"],
    accent: "#FB6A21",
  },
  Dramatic: {
    label: "Dramatic",
    gradient: ["#172554", "#3B82F6"],
    accent: "#60A5FA",
  },
  Wholesome: {
    label: "Wholesome",
    gradient: ["#064E3B", "#34D399"],
    accent: "#34D399",
  },
  Funny: {
    label: "Funny",
    gradient: ["#713F12", "#FACC15"],
    accent: "#FACC15",
  },
};

export const DEFAULT_VIBE: VibeName = "Chill";
