import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, Field, Screen, VibeChip } from "../components/ui";
import { VIBES, type VibeName } from "../config/vibes";
import { uploadMedia } from "../services/media";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

export function EditProfileScreen({
  session,
  profile,
  onSave,
  onCancel,
}: {
  session: Session;
  profile: UserProfile;
  onSave: (updates: UserProfile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [website, setWebsite] = useState(profile.website ?? "");
  const [vibes, setVibes] = useState<string[]>(profile.vibe_tags);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [cover, setCover] = useState(profile.cover_url ?? null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function chooseImage(kind: "avatar" | "cover", source: "camera" | "gallery") {
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(source === "camera" ? "Allow camera access" : "Allow photo access", "Vibed needs this permission to update your profile.");
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: kind === "avatar" ? [1, 1] : [3, 1],
        quality: 0.85,
      };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      setBusy(true);
      const url = await uploadMedia(result.assets[0]);
      if (kind === "avatar") setAvatar(url);
      else setCover(url);
    } catch (error) {
      Alert.alert("Could not upload photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function chooseImageSource(kind: "avatar" | "cover") {
    Alert.alert(kind === "avatar" ? "Profile photo" : "Cover photo", "Choose where to get your photo.", [
      { text: "Camera", onPress: () => void chooseImage(kind, "camera") },
      { text: "Gallery", onPress: () => void chooseImage(kind, "gallery") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function toggleVibe(vibe: VibeName) {
    setVibes((current) => current.includes(vibe) ? current.filter((item) => item !== vibe) : [...current, vibe]);
  }

  async function save() {
    const cleanUsername = username.trim().toLowerCase();
    if (!name.trim()) {
      Alert.alert("Add a name", "Your display name is required.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      Alert.alert("Check your username", "Use 3–24 lowercase letters, numbers, or underscores.");
      return;
    }
    if (website && !/^https?:\/\//i.test(website)) {
      Alert.alert("Check your link", "Start your website link with https://.");
      return;
    }

    setBusy(true);
    try {
      setChecking(true);
      const { data: existing, error: checkError } = await supabase.from("users")
        .select("id")
        .eq("username", cleanUsername)
        .neq("id", session.user.id)
        .maybeSingle();
      setChecking(false);
      if (checkError) throw checkError;
      if (existing) {
        Alert.alert("Username taken", "Try another username.");
        return;
      }

      const updates = {
        display_name: name.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        website: website.trim(),
        avatar_url: avatar,
        cover_url: cover,
        vibe_tags: vibes,
      };
      const { error } = await supabase.from("users").update(updates).eq("id", session.user.id);
      if (error) throw error;
      onSave({ ...profile, ...updates });
    } catch (error) {
      Alert.alert("Profile not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setChecking(false);
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onCancel}><Text style={styles.headerAction}>Cancel</Text></Pressable>
          <Text style={styles.title}>Edit profile</Text>
          <Pressable onPress={() => void save()} disabled={busy || checking}><Text style={styles.headerAction}>{busy || checking ? "Saving…" : "Save"}</Text></Pressable>
        </View>
        <Pressable onPress={() => chooseImageSource("cover")} style={[styles.cover, cover && { backgroundColor: "transparent" }]}>
          {cover ? <Image source={{ uri: cover }} style={styles.coverImage} /> : null}
          <Text style={styles.coverText}>Change cover photo</Text>
        </Pressable>
        <Pressable onPress={() => chooseImageSource("avatar")} style={styles.avatar}>
          <Avatar uri={avatar} label={name || username} size={86} />
          <Text style={styles.changePhoto}>Change profile photo</Text>
        </Pressable>
        <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={24} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="Tell people about yourself" />
        <Text style={styles.counter}>{bio.length}/300</Text>
        <Field label="Link" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" placeholder="https://your-site.com" maxLength={200} />
        <View style={styles.vibes}>
          <Text style={styles.label}>Favorite vibes</Text>
          <View style={styles.chips}>
            {VIBES.map((vibe) => (
              <VibeChip key={vibe} vibe={vibe} active={vibes.includes(vibe)} onPress={() => toggleVibe(vibe)} compact />
            ))}
          </View>
        </View>
        <Button loading={busy || checking} onPress={() => void save()}>Save changes</Button>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 18, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerAction: { color: colors.mint, fontSize: 14, fontWeight: "700" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  cover: { height: 110, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#37204D" },
  coverImage: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  coverText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  avatar: { alignItems: "center", gap: 6, marginTop: -4 },
  changePhoto: { color: colors.mint, fontSize: 12, fontWeight: "700", textAlign: "center" },
  vibes: { gap: 10 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  counter: { alignSelf: "flex-end", color: colors.muted, fontSize: 11, marginTop: -10 },
});
