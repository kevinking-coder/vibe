export type ThemeMode = "dark" | "light" | "system";

export type UserSettings = {
  theme: ThemeMode;
  accentColor: string;
  textSize: "small" | "standard" | "large";
  messagePermission: "everyone" | "following" | "nobody";
  commentPermission: "everyone" | "following" | "nobody";
  likedVideosPrivate: boolean;
  allowDuets: boolean;
  notifications: {
    likes: boolean;
    comments: boolean;
    followers: boolean;
    messages: boolean;
    live: boolean;
    vibes: boolean;
  };
  autoplay: boolean;
  dataSaver: boolean;
  captions: boolean;
  defaultVibe: string;
  language: string;
  notInterestedPostIds: string[];
  savedLogin: boolean;
  screenTimeReminder: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "dark",
  accentColor: "#A855F7",
  textSize: "standard",
  messagePermission: "everyone",
  commentPermission: "everyone",
  likedVideosPrivate: true,
  allowDuets: true,
  notifications: {
    likes: true,
    comments: true,
    followers: true,
    messages: true,
    live: true,
    vibes: true,
  },
  autoplay: true,
  dataSaver: false,
  captions: false,
  defaultVibe: "Chill",
  language: "en",
  notInterestedPostIds: [],
  savedLogin: false,
  screenTimeReminder: false,
};

export type SettingsRow = {
  key: string;
  label: string;
  description?: string;
  type: "screen" | "toggle" | "choice";
  choices?: readonly string[];
};

export type SettingsSection = {
  title: string;
  rows: readonly SettingsRow[];
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    title: "Account",
    rows: [
      { key: "editProfile", label: "Edit profile", type: "screen" },
      { key: "phoneEmail", label: "Phone and email", type: "screen" },
      { key: "password", label: "Change password", type: "screen" },
      { key: "linkedAccounts", label: "Linked accounts", description: "Google and Apple ready", type: "screen" },
      { key: "deleteAccount", label: "Deactivate or delete account", type: "screen" },
    ],
  },
  {
    title: "Privacy",
    rows: [
      { key: "is_private", label: "Private account", type: "toggle" },
      { key: "messagePermission", label: "Who can message me", type: "choice", choices: ["everyone", "following", "nobody"] },
      { key: "commentPermission", label: "Who can comment", type: "choice", choices: ["everyone", "following", "nobody"] },
      { key: "likedVideosPrivate", label: "Keep liked videos private", type: "toggle" },
      { key: "allowDuets", label: "Allow sharing and duets", type: "toggle" },
      { key: "blocked", label: "Blocked accounts", type: "screen" },
    ],
  },
  {
    title: "Appearance and themes",
    rows: [
      { key: "theme", label: "Theme", type: "choice", choices: ["dark", "light", "system"] },
      { key: "accentColor", label: "Accent color", type: "choice", choices: ["#A855F7", "#5BE6CF", "#FB7185", "#60A5FA"] },
      { key: "textSize", label: "Text size", type: "choice", choices: ["small", "standard", "large"] },
    ],
  },
  {
    title: "Vibes",
    rows: [
      { key: "favoriteVibes", label: "Favorite vibes", type: "screen" },
      { key: "hardMute", label: "Hard Mute shield", type: "screen" },
    ],
  },
  {
    title: "Notifications",
    rows: [
      { key: "notifications.likes", label: "Likes", type: "toggle" },
      { key: "notifications.comments", label: "Comments", type: "toggle" },
      { key: "notifications.followers", label: "New followers", type: "toggle" },
      { key: "notifications.messages", label: "Direct messages", type: "toggle" },
      { key: "notifications.live", label: "Live streams", type: "toggle" },
      { key: "notifications.vibes", label: "Vibes I follow", type: "toggle" },
    ],
  },
  {
    title: "Content and display",
    rows: [
      { key: "autoplay", label: "Autoplay videos", type: "toggle" },
      { key: "dataSaver", label: "Data saver", type: "toggle" },
      { key: "captions", label: "Captions", type: "toggle" },
      { key: "defaultVibe", label: "Default feed vibe", type: "choice" },
    ],
  },
  {
    title: "Security",
    rows: [
      { key: "loginActivity", label: "Login activity", type: "screen" },
      { key: "twoFactor", label: "Two-factor authentication", description: "Ready when enabled for your account", type: "screen" },
      { key: "savedLogin", label: "Saved login info", type: "toggle" },
    ],
  },
  {
    title: "Saved and activity",
    rows: [
      { key: "saved", label: "Saved posts", type: "screen" },
      { key: "liked", label: "Liked posts", type: "screen" },
      { key: "watchHistory", label: "Watch history", type: "screen" },
      { key: "screenTimeReminder", label: "Daily screen time reminder", type: "toggle" },
    ],
  },
  { title: "Language and region", rows: [{ key: "language", label: "Language", type: "choice", choices: ["en", "es", "fr", "de"] }] },
  {
    title: "Support and about",
    rows: [
      { key: "help", label: "Help center", type: "screen" },
      { key: "reportProblem", label: "Report a problem", type: "screen" },
      { key: "guidelines", label: "Community guidelines", type: "screen" },
      { key: "terms", label: "Terms and privacy", type: "screen" },
      { key: "version", label: "App version", type: "screen" },
    ],
  },
];
