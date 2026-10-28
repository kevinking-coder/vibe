import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { colors, Screen, VibeChip } from "../components/ui";
import { SETTINGS_SECTIONS, type SettingsRow, type UserSettings } from "../config/settings";
import { VIBES, type VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";
import { useAppStore } from "../store/appStore";
import type { UserProfile } from "../types/app";

export function SettingsScreen({
  session,
  profile,
  onProfileUpdated,
  onEditProfile,
  onClose,
  onSignOut,
}: {
  session: Session;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  onEditProfile: () => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<"hardMute" | "favoriteVibes" | "blocked" | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Pick<UserProfile, "id" | "username" | "display_name" | "avatar_url">[]>([]);
  const [hardMuted, setHardMuted] = useState(profile.hard_muted_vibes);
  const [favoriteVibes, setFavoriteVibes] = useState(profile.vibe_tags);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS
      .map((section) => ({ ...section, rows: section.rows.filter((row) => row.label.toLowerCase().includes(term) || section.title.toLowerCase().includes(term)) }))
      .filter((section) => section.rows.length);
  }, [search]);

  function readValue(key: string): unknown {
    if (key.startsWith("notifications.")) {
      return settings.notifications[key.split(".")[1] as keyof UserSettings["notifications"]];
    }
    if (key === "is_private") return profile.is_private ?? false;
    return settings[key as keyof UserSettings];
  }

  async function persistSettings(next: UserSettings) {
    const { error } = await supabase.from("user_settings").upsert({
      user_id: session.user.id,
      settings: next,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setSettings(next);
  }

  async function toggle(row: SettingsRow) {
    const key = row.key;
    const current = Boolean(readValue(key));
    setSavingKey(key);
    try {
      if (key === "is_private") {
        const { error } = await supabase.from("users").update({ is_private: !current }).eq("id", session.user.id);
        if (error) throw error;
        onProfileUpdated({ ...profile, is_private: !current });
      } else {
        let next: UserSettings;
        if (key.startsWith("notifications.")) {
          const notification = key.split(".")[1] as keyof UserSettings["notifications"];
          next = { ...settings, notifications: { ...settings.notifications, [notification]: !current } };
        } else {
          next = { ...settings, [key]: !current };
        }
        await persistSettings(next);
      }
    } catch (error) {
      Alert.alert("Setting not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  async function selectChoice(row: SettingsRow) {
    const choices = row.choices ?? (row.key === "defaultVibe" ? [...VIBES] : []);
    if (!choices.length) return;
    Alert.alert(row.label, "Choose an option", [
      ...choices.map((choice) => ({
        text: row.key === "accentColor" ? "●  " + choice : choice,
        onPress: () => {
          void (async () => {
            const next = { ...settings, [row.key]: choice } as UserSettings;
            try {
              await persistSettings(next);
            } catch (error) {
              Alert.alert("Setting not saved", error instanceof Error ? error.message : "Please try again.");
            }
          })();
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function toggleVibe(vibe: VibeName, kind: "hardMute" | "favoriteVibes") {
    const current = kind === "hardMute" ? hardMuted : favoriteVibes;
    const next = current.includes(vibe) ? current.filter((item) => item !== vibe) : [...current, vibe];
    setSavingKey(kind);
    try {
      const column = kind === "hardMute" ? "hard_muted_vibes" : "vibe_tags";
      const { error } = await supabase.from("users").update({ [column]: next }).eq("id", session.user.id);
      if (error) throw error;
      if (kind === "hardMute") {
        setHardMuted(next);
        onProfileUpdated({ ...profile, hard_muted_vibes: next });
      } else {
        setFavoriteVibes(next);
        onProfileUpdated({ ...profile, vibe_tags: next });
      }
    } catch (error) {
      Alert.alert("Could not save vibes", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  function openRow(row: SettingsRow) {
    if (row.key === "editProfile") {
      onEditProfile();
      return;
    }
    if (row.key === "hardMute" || row.key === "favoriteVibes") {
      setExpanded((current) => current === row.key ? null : row.key as "hardMute" | "favoriteVibes");
      return;
    }
    if (row.key === "blocked") {
      void (async () => {
        try {
          const { data: blocks, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", session.user.id);
          if (error) throw error;
          const ids = (blocks ?? []).map((item) => item.blocked_id);
          if (!ids.length) {
            setBlockedUsers([]);
          } else {
            const { data, error: usersError } = await supabase.from("users")
              .select("id, username, display_name, avatar_url")
              .in("id", ids);
            if (usersError) throw usersError;
            setBlockedUsers((data ?? []) as typeof blockedUsers);
          }
          setExpanded((current) => current === "blocked" ? null : "blocked");
        } catch (error) {
          Alert.alert("Could not load blocked accounts", error instanceof Error ? error.message : "Please try again.");
        }
      })();
      return;
    }
    Alert.alert(row.label, row.description ?? "This option will be available when the account service is configured.");
  }

  function renderRow(row: SettingsRow) {
    const value = readValue(row.key);
    if (row.type === "toggle") {
      return (
        <View key={row.key} style={styles.row}>
          <View style={styles.rowText}><Text style={styles.rowTitle}>{row.label}</Text>{row.description ? <Text style={styles.rowDescription}>{row.description}</Text> : null}</View>
          <Switch value={Boolean(value)} disabled={savingKey === row.key} onValueChange={() => void toggle(row)} trackColor={{ true: colors.accent, false: colors.border }} />
        </View>
      );
    }
    const expandedVibes = row.key === expanded;
    return (
      <View key={row.key}>
        <Pressable style={styles.row} onPress={() => row.type === "choice" ? void selectChoice(row) : openRow(row)}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{row.label}</Text>
            <Text style={styles.rowDescription}>
              {row.description ?? (row.key === "accentColor" ? String(value ?? settings.accentColor) : row.key === "defaultVibe" ? String(settings.defaultVibe) : row.key === "theme" ? String(settings.theme) : "")}
            </Text>
          </View>
          {row.key === "accentColor" ? <View style={[styles.colorSwatch, { backgroundColor: String(value ?? settings.accentColor) }]} /> : null}
          <Ionicons name={expandedVibes ? "chevron-down" : "chevron-forward"} size={17} color={colors.muted} />
        </Pressable>
        {expandedVibes && row.key === "blocked" ? (
          <View style={styles.blockedList}>
            {blockedUsers.length ? blockedUsers.map((user) => (
              <View key={user.id} style={styles.blockedRow}>
                <Text style={styles.rowTitle}>{user.display_name || user.username} · @{user.username}</Text>
                <Pressable onPress={() => {
                  void supabase.from("blocked_users").delete()
                    .eq("blocker_id", session.user.id)
                    .eq("blocked_id", user.id)
                    .then(({ error }) => {
                      if (error) Alert.alert("Could not unblock account", error.message);
                      else setBlockedUsers((current) => current.filter((entry) => entry.id !== user.id));
                    });
                }}><Text style={styles.unblock}>Unblock</Text></Pressable>
              </View>
            )) : <Text style={styles.rowDescription}>You have not blocked anyone.</Text>}
          </View>
        ) : null}
        {expandedVibes && (row.key === "hardMute" || row.key === "favoriteVibes") ? (
          <View style={styles.vibes}>
            {VIBES.map((vibe) => {
              const active = row.key === "hardMute" ? hardMuted.includes(vibe) : favoriteVibes.includes(vibe);
              return <VibeChip key={vibe} vibe={vibe} active={active} onPress={() => void toggleVibe(vibe, row.key as "hardMute" | "favoriteVibes")} compact />;
            })}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
          <Text style={styles.title}>Settings and activity</Text>
          <View style={styles.headerSpacer} />
        </View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search settings" placeholderTextColor={colors.muted} style={styles.search} />
        <ScrollView contentContainerStyle={styles.sections}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.rows.map(renderRow)}
            </View>
          ))}
          <Pressable style={styles.logout} onPress={onSignOut}><Text style={styles.logoutText}>Log out</Text></Pressable>
          <Text style={styles.version}>Vibed · 1.0.0</Text>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 17 },
  header: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 26 },
  search: { height: 46, borderRadius: 14, paddingHorizontal: 14, backgroundColor: colors.panel, color: colors.text, marginVertical: 8 },
  sections: { gap: 12, paddingBottom: 28 },
  section: { padding: 13, borderRadius: 16, backgroundColor: colors.panel },
  sectionTitle: { color: colors.mint, fontSize: 12, fontWeight: "800", letterSpacing: 0.7, marginBottom: 4, textTransform: "uppercase" },
  row: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  rowDescription: { color: colors.muted, fontSize: 10 },
  colorSwatch: { width: 20, height: 20, borderRadius: 10 },
  vibes: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 10 },
  logout: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#3F1D2E" },
  logoutText: { color: "#FDA4AF", fontWeight: "800" },
  version: { color: colors.muted, fontSize: 11, textAlign: "center" },
  blockedList: { gap: 7, paddingVertical: 9 },
  blockedRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  unblock: { color: colors.mint, fontSize: 12, fontWeight: "700" },
});
