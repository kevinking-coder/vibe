import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@supabase/supabase-js";

import { Button, colors, Field, Screen } from "../components/ui";
import { VIBE_THEMES, type VibeName } from "../config/vibes";
import { uploadVideo } from "../services/media";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

const vibes = Object.keys(VIBE_THEMES) as VibeName[];

export function CreateScreen({
  session,
  profile,
}: {
  session: Session;
  profile: UserProfile;
}) {
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [genre, setGenre] = useState("");
  const [audio, setAudio] = useState("Original audio");
  const [vibe, setVibe] = useState<VibeName>((profile.vibe_tags[0] as VibeName) || "Chill");
  const [busy, setBusy] = useState(false);

  async function chooseVideo() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Allow video access", "Vibed needs photo library access so you can choose a video to post.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
        videoMaxDuration: 180,
      });
      if (!result.canceled) setAsset(result.assets[0]);
    } catch (error) {
      Alert.alert("Could not open your library", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function publish() {
    if (!asset) {
      Alert.alert("Choose a video", "Select a video from your library before posting.");
      return;
    }
    if (!genre.trim()) {
      Alert.alert("Add a genre", "Add a short genre or topic tag for your video.");
      return;
    }

    setBusy(true);
    try {
      const optimizedUrl = await uploadVideo(asset, session.user.id);
      const { error } = await supabase.from("videos").insert({
        user_id: session.user.id,
        optimized_url: optimizedUrl,
        caption: caption.trim(),
        genre_tag: genre.trim().toLowerCase(),
        vibe_tag: vibe,
        audio_attribution: audio.trim() || "Original audio",
        duration_ms: Math.max(0, Math.round(asset.duration ?? 0)),
      });
      if (error) throw error;
      Alert.alert("You’re live", "Your video was added to the feed.", [
        { text: "Nice", onPress: () => { setAsset(null); setCaption(""); setGenre(""); setAudio("Original audio"); } },
      ]);
    } catch (error) {
      Alert.alert("Post failed", error instanceof Error ? error.message : "Could not upload your video.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View>
          <Text style={styles.title}>Create</Text>
          <Text style={styles.subtitle}>Share a moment that matches your mood.</Text>
        </View>
        <Button variant="secondary" onPress={() => void chooseVideo()} style={styles.pickButton}>
          <Text style={styles.pickText}>{asset ? "Choose a different video" : "＋  Choose a video"}</Text>
        </Button>
        {asset ? (
          <View style={styles.preview}>
            <View style={styles.previewGraphic}><Text style={styles.previewPlay}>▶</Text></View>
            <View style={styles.previewOverlay}>
              <Text style={styles.previewName} numberOfLines={1}>{asset.fileName || "Video selected"}</Text>
              <Text style={styles.previewDetail}>{Math.round((asset.duration ?? 0) / 1000)} sec · Ready to upload</Text>
            </View>
          </View>
        ) : null}
        <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="What’s the moment?" multiline maxLength={500} />
        <Field label="Genre / topic" value={genre} onChangeText={setGenre} placeholder="music, comedy, daily life…" maxLength={40} />
        <Field label="Audio credit" value={audio} onChangeText={setAudio} placeholder="Original audio" maxLength={120} />
        <View style={styles.vibeSection}>
          <Text style={styles.label}>Choose a vibe</Text>
          <View style={styles.vibes}>
            {vibes.map((item) => {
              const active = item === vibe;
              return (
                <Button
                  key={item}
                  variant="secondary"
                  onPress={() => setVibe(item)}
                  style={[styles.vibe, active && { borderColor: VIBE_THEMES[item].accent }]}
                >
                  <Text style={[styles.vibeText, active && { color: VIBE_THEMES[item].accent }]}>{item}</Text>
                </Button>
              );
            })}
          </View>
        </View>
        <Button loading={busy} onPress={() => void publish()}>
          Publish video
        </Button>
        <Text style={styles.note}>Keep uploads under 3 minutes. Only post videos you have the right to share.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  pickButton: { minHeight: 55, borderStyle: "dashed", borderColor: "#64428A" },
  pickText: { color: colors.text, fontWeight: "700" },
  preview: { height: 210, overflow: "hidden", borderRadius: 16, backgroundColor: colors.panel },
  previewGraphic: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#21152B" },
  previewPlay: { color: colors.mint, fontSize: 44 },
  previewOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 14, gap: 4, backgroundColor: "rgba(0,0,0,0.12)" },
  previewName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  previewDetail: { color: "#E4E4E7", fontSize: 12 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  vibeSection: { gap: 3 },
  vibes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibe: { minHeight: 39, paddingHorizontal: 12, borderRadius: 14 },
  vibeText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
