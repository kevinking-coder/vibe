import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
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
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
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
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        multiline={multiline}
        style={[styles.field, multiline && styles.multiline, props.style]}
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
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
      {action}
    </View>
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
});
