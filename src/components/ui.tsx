import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { GENRE_THEMES, VIBE_THEMES, type GenreName, type VibeName } from "../config/vibes";
import { useAppStore } from "../store/appStore";

export const colors = {
  background: "#0A0A0C",
  panel: "#141419",
  panelRaised: "#1C1C23",
  border: "#2A2A33",
  text: "#F7F7FA",
  muted: "#A1A1AA",
  accent: "#A855F7",
  mint: "#5BE6CF",
  danger: "#F87171",
};

export function Screen({
  children,
  scroll = false,
  style,
}: PropsWithChildren<{ scroll?: boolean } & ViewProps>) {
  const theme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  const backgroundColor = light ? "#F7F7FA" : colors.background;
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const theme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingTitle, light && styles.lightText]}>{title}</Text>
      {subtitle ? <Text style={[styles.muted, light && styles.lightMuted]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({
  children,
  loading = false,
  variant = "primary",
  style,
  disabled,
  ...props
}: PropsWithChildren<
  PressableProps & {
    loading?: boolean;
    variant?: "primary" | "secondary" | "quiet" | "danger";
  }
>) {
  const accentColor = useAppStore((state) => state.settings.accentColor);
  const theme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: accentColor },
        variant === "secondary" && [styles.buttonSecondary, light && styles.lightSecondary],
        variant === "quiet" && styles.buttonQuiet,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.text : "#FFFFFF"} />
      ) : (
        typeof children === "string" ? <Text style={styles.buttonText}>{children}</Text> : children
      )}
    </Pressable>
  );
}

export function Field({
  label,
  multiline = false,
  ...props
}: TextInputProps & { label?: string }) {
  const theme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, light && styles.lightMuted]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={light ? "#71717A" : colors.muted}
        {...props}
        multiline={multiline}
        style={[styles.field, light && styles.lightField, multiline && styles.multiline, props.style]}
      />
    </View>
  );
}

export function Avatar({
  uri,
  label,
  size = 44,
}: {
  uri?: string | null;
  label: string;
  size?: number;
}) {
  const initials = label.trim().slice(0, 1).toUpperCase() || "?";
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const theme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, light && styles.lightText]}>{title}</Text>
      <Text style={[styles.muted, light && styles.lightMuted]}>{body}</Text>
      {action}
    </View>
  );
}

export function VibeChip({
  vibe,
  active,
  onPress,
  compact = false,
}: {
  vibe: VibeName;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = VIBE_THEMES[vibe];
  const paletteTheme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = paletteTheme === "light" || (paletteTheme === "system" && systemScheme === "light");
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={active ? theme.gradient : [light ? "#FFFFFF" : "#18181D", light ? "#FFFFFF" : "#18181D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.vibeChip,
          compact && styles.vibeChipCompact,
          { borderColor: active ? theme.accent : light ? "#D4D4D8" : colors.border },
        ]}
      >
        <View style={styles.vibeChipContent}>
          <Ionicons name={theme.icon as keyof typeof Ionicons.glyphMap} size={compact ? 13 : 16} color={active ? "#FFFFFF" : light ? "#52525B" : colors.muted} />
          <Text style={{ color: active ? "#FFFFFF" : light ? "#52525B" : colors.muted, fontSize: compact ? 11 : 13, fontWeight: "700" }}>{vibe}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function GenreChip({
  genre,
  active,
  onPress,
}: {
  genre: GenreName;
  active?: boolean;
  onPress?: () => void;
}) {
  const theme = GENRE_THEMES[genre];
  const selected = Boolean(active);
  const paletteTheme = useAppStore((state) => state.settings.theme);
  const systemScheme = useColorScheme();
  const light = paletteTheme === "light" || (paletteTheme === "system" && systemScheme === "light");
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={selected ? theme.gradient : [light ? "#FFFFFF" : "#18181D", light ? "#FFFFFF" : "#18181D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.genreChip, { borderColor: selected ? theme.accent : light ? "#D4D4D8" : colors.border }]}
      >
        <Ionicons name={theme.icon as keyof typeof Ionicons.glyphMap} size={16} color={selected ? "#FFFFFF" : light ? "#52525B" : colors.muted} />
        <Text style={{ color: selected ? "#FFFFFF" : light ? "#52525B" : colors.muted, fontSize: 12, fontWeight: "700" }}>{genre}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenContent: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, gap: 18 },
  heading: { gap: 5, marginBottom: 8 },
  headingTitle: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.border },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonDanger: { backgroundColor: "#7F1D1D" },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  field: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 15,
  },
  multiline: { minHeight: 100, paddingTop: 13, textAlignVertical: "top" },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#35204B" },
  avatarInitial: { color: colors.mint, fontWeight: "800" },
  empty: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "700", textAlign: "center" },
  vibeChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, borderWidth: 1 },
  vibeChipCompact: { paddingHorizontal: 10, paddingVertical: 7 },
  vibeChipContent: { flexDirection: "row", alignItems: "center", gap: 5 },
  genreChip: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13, borderWidth: 1 },
  lightText: { color: "#18181B" },
  lightMuted: { color: "#71717A" },
  lightField: { color: "#18181B", backgroundColor: "#FFFFFF", borderColor: "#D4D4D8" },
  lightSecondary: { backgroundColor: "#E4E4E7", borderColor: "#D4D4D8" },
});
