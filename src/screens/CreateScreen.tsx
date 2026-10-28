import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { Button, colors, EmptyState, Field, GenreChip, Screen, VibeChip } from "../components/ui";
import { GENRES, VIBES, type GenreName, type VibeName } from "../config/vibes";
import { optimizeMediaUrl, uploadMedia, withVideoTrim } from "../services/media";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

type MediaKind = "video" | "photo";
type Privacy = "everyone" | "followers" | "only_me";
const steps = ["Choose media", "Edit", "Tag", "Post"] as const;

export function CreateScreen({ session, profile }: { session: Session; profile: UserProfile }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<MediaKind>("video");
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [genre, setGenre] = useState<GenreName | null>(null);
  const [vibe, setVibe] = useState<VibeName | null>(null);
  const [caption, setCaption] = useState("");
  const [overlay, setOverlay] = useState("");
  const [coverAsset, setCoverAsset] = useState<Pick<ImagePicker.ImagePickerAsset, "uri" | "fileName" | "mimeType"> | null>(null);
  const [coverTime, setCoverTime] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const [audio, setAudio] = useState(`Original Audio by @${profile.username}`);
  const [privacy, setPrivacy] = useState<Privacy>("everyone");
  const [allowComments, setAllowComments] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canPost = assets.length > 0 && Boolean(genre) && Boolean(vibe) && !busy;

  const durationLabel = useMemo(() => {
    if (kind !== "video" || !assets[0]) return "";
    return `${Math.round((assets[0].duration ?? 0) / 1000)} sec`;
  }, [assets, kind]);

  async function pickFromLibrary() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Allow photo access", "Vibed needs library access to choose media for your post.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "video" ? ["videos"] : ["images"],
        allowsMultipleSelection: kind === "photo",
        selectionLimit: kind === "photo" ? 10 : 1,
        quality: 0.9,
        videoMaxDuration: 180,
      });
      if (!result.canceled) {
        setAssets(result.assets);
        setCoverAsset(null);
        setCoverTime(null);
        if (kind === "video") {
          setTrimStart("0");
          setTrimEnd(String(Math.max(1, Math.floor((result.assets[0]?.duration ?? 0) / 1000))));
        }
        setError(null);
      }
    } catch (pickerError) {
      Alert.alert("Could not open your gallery", pickerError instanceof Error ? pickerError.message : "Please try again.");
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Allow camera access", "Vibed needs camera access to capture media for your post.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: kind === "video" ? ["videos"] : ["images"],
        quality: 0.9,
        videoMaxDuration: 180,
      });
      if (!result.canceled) {
        setAssets(result.assets);
        setCoverAsset(null);
        setCoverTime(null);
        if (kind === "video") {
          setTrimStart("0");
          setTrimEnd(String(Math.max(1, Math.floor((result.assets[0]?.duration ?? 0) / 1000))));
        }
        setError(null);
      }
    } catch (pickerError) {
      Alert.alert("Could not open the camera", pickerError instanceof Error ? pickerError.message : "Please try again.");
    }
  }

  function chooseKind(nextKind: MediaKind) {
    setKind(nextKind);
    setAssets([]);
    setCoverAsset(null);
    setCoverTime(null);
  }

  async function publish() {
    if (!canPost || !genre || !vibe) return;
    if (kind === "photo" && assets.length > 10) {
      Alert.alert("Too many photos", "A post can include up to 10 photos.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const urls: string[] = [];
      const uploadCount = assets.length + (kind === "video" && coverAsset ? 1 : 0);
      for (let index = 0; index < assets.length; index += 1) {
        const uploadedUrl = await uploadMedia(assets[index], (part) => {
          setProgress((index + part) / uploadCount);
        });
        urls.push(kind === "video" ? withVideoTrim(uploadedUrl, Number(trimStart), Number(trimEnd)) : optimizeMediaUrl(uploadedUrl));
      }
      const coverUrl = kind === "photo"
        ? urls[0]
        : coverAsset
          ? optimizeMediaUrl(await uploadMedia(coverAsset, (part) => setProgress((assets.length + part) / uploadCount)))
          : null;
      const { error: insertError } = await supabase.from("videos").insert({
        user_id: session.user.id,
        optimized_url: kind === "video" ? urls[0] : null,
        media_urls: urls,
        media_type: kind,
        cover_url: coverUrl,
        text_overlay: overlay.trim(),
        caption: caption.trim(),
        genre_tag: genre,
        vibe_tag: vibe,
        audio_attribution: audio.trim() || `Original Audio by @${profile.username}`,
        duration_ms: kind === "video" ? Math.max(0, Math.round((Number(trimEnd) - Number(trimStart)) * 1000)) : 0,
        visibility: privacy,
        allow_comments: allowComments,
        allow_sharing: allowSharing,
      });
      if (insertError) throw insertError;
      Alert.alert("Posted to Vibed", "Your post is in the Vibe Room.", [
        { text: "Done", onPress: resetForm },
      ]);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "The post could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setStep(0);
    setAssets([]);
    setGenre(null);
    setVibe(null);
    setCaption("");
    setOverlay("");
    setCoverAsset(null);
    setCoverTime(null);
    setTrimStart("0");
    setTrimEnd("");
    setProgress(0);
    setAudio(`Original Audio by @${profile.username}`);
    setPrivacy("everyone");
    setAllowComments(true);
    setAllowSharing(true);
  }

  async function chooseCoverFrame(time: number) {
    const video = assets[0];
    if (!video || !Number.isFinite(time) || time < 0) return;
    try {
      const frame = await VideoThumbnails.getThumbnailAsync(video.uri, { time: Math.round(time * 1000) });
      setCoverAsset({ uri: frame.uri, fileName: "vibed-cover.jpg", mimeType: "image/jpeg" });
      setCoverTime(time);
    } catch (thumbnailError) {
      Alert.alert("Could not create cover frame", thumbnailError instanceof Error ? thumbnailError.message : "Try another frame.");
    }
  }

  function next() {
    if (step === 0 && assets.length === 0) {
      setError("Choose a video or at least one photo to continue.");
      return;
    }
    if (step === 2 && (!genre || !vibe)) {
      setError("Choose both a genre and a vibe before continuing.");
      return;
    }
    if (step === 1 && kind === "video") {
      const start = Number(trimStart);
      const end = Number(trimEnd);
      const duration = (assets[0]?.duration ?? 0) / 1000;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || (duration > 0 && end > duration)) {
        setError("Enter a valid trim range within the selected video duration.");
        return;
      }
    }
    setError(null);
    setStep((current) => Math.min(3, current + 1));
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={styles.title}>Create a post</Text>
          <Text style={styles.subtitle}>Every post belongs to a vibe.</Text>
        </View>
        <View style={styles.progress}>
          {steps.map((label, index) => (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressDot, index <= step && styles.progressActive]}>
                {index < step ? <Ionicons name="checkmark" size={13} color={colors.background} /> : <Text style={[styles.progressNumber, index === step && styles.progressNumberActive]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        {step === 0 ? (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>What are you sharing?</Text>
            <View style={styles.kindRow}>
              <KindChoice icon="videocam-outline" label="Video" selected={kind === "video"} onPress={() => chooseKind("video")} />
              <KindChoice icon="image-outline" label="Photo" selected={kind === "photo"} onPress={() => chooseKind("photo")} />
            </View>
            <View style={styles.pickerRow}>
              <Button variant="secondary" onPress={() => void pickFromLibrary()} style={styles.pickerButton}>
                <Ionicons name="images-outline" size={18} color={colors.text} /><Text style={styles.buttonLabel}>Choose from gallery</Text>
              </Button>
              <Button variant="secondary" onPress={() => void takePhoto()} style={styles.pickerButton}>
                <Ionicons name="camera-outline" size={18} color={colors.text} /><Text style={styles.buttonLabel}>Use camera</Text>
              </Button>
            </View>
            {assets.length ? <Text style={styles.selectionText}>{assets.length} {kind === "photo" ? "photo(s)" : "video selected"}{durationLabel ? ` · ${durationLabel}` : ""}</Text> : <EmptyState title="Choose media to begin" body={kind === "photo" ? "Select up to 10 images for a swipeable carousel." : "Choose one video up to 3 minutes long."} />}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Preview and edit</Text>
            <View style={styles.preview}>
              {kind === "photo" && assets[0] ? <Image source={{ uri: assets[0].uri }} style={styles.previewImage} /> : coverAsset ? <Image source={{ uri: coverAsset.uri }} style={styles.previewImage} /> : (
                <View style={styles.videoPreview}><Ionicons name="play-circle-outline" size={56} color={colors.text} /><Text style={styles.previewFile}>{assets[0]?.fileName ?? "Video preview"}</Text></View>
              )}
              {overlay.trim() ? <Text style={styles.overlayPreview}>{overlay}</Text> : null}
            </View>
            {kind === "photo" && assets.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                {assets.map((asset, index) => <Image key={asset.assetId ?? asset.uri} source={{ uri: asset.uri }} style={styles.photoThumb} accessibilityLabel={`Photo ${index + 1}`} />)}
              </ScrollView>
            ) : null}
            <Field label="Optional text overlay" value={overlay} onChangeText={setOverlay} placeholder="Add a little context…" maxLength={100} />
            {kind === "video" ? (
              <>
                <View style={styles.trimRow}>
                  <Field label="Start (seconds)" value={trimStart} onChangeText={setTrimStart} keyboardType="decimal-pad" />
                  <Field label="End (seconds)" value={trimEnd} onChangeText={setTrimEnd} keyboardType="decimal-pad" />
                </View>
                <Text style={styles.note}>The selected range is rendered by Cloudinary when viewers play your post.</Text>
                <Text style={styles.label}>Choose a cover frame</Text>
                <View style={styles.coverChoices}>
                  {[Number(trimStart), (Number(trimStart) + Number(trimEnd)) / 2, Math.max(Number(trimStart), Number(trimEnd) - 0.5)].map((time, index) => (
                    <Button key={`${time}-${index}`} variant="secondary" onPress={() => void chooseCoverFrame(time)}>
                      <Text style={styles.buttonLabel}>{coverTime === time ? "Selected" : `Frame ${index + 1}`}</Text>
                    </Button>
                  ))}
                </View>
              </>
            ) : <Text style={styles.note}>Photos will appear as a swipeable carousel in your Vibe Room.</Text>}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Tag your post</Text>
            <Text style={styles.helper}>Choose a genre first, then the vibe that fits best.</Text>
            <Text style={styles.label}>Genre</Text>
            <View style={styles.genreGrid}>
              {GENRES.map((item) => <GenreChip key={item} genre={item} active={genre === item} onPress={() => setGenre(item)} />)}
            </View>
            <Text style={styles.label}>Vibe</Text>
            <View style={styles.vibeGrid}>
              {VIBES.map((item) => <VibeChip key={item} vibe={item} active={vibe === item} onPress={() => setVibe(item)} compact />)}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Add your details</Text>
            <Text style={styles.selectedTags}>{genre} · {vibe}</Text>
            <Field label="Caption" value={caption} onChangeText={setCaption} multiline maxLength={500} placeholder="Add hashtags or mention someone…" />
            <Text style={styles.counter}>{caption.length}/500</Text>
            <Field label="Audio attribution" value={audio} onChangeText={setAudio} maxLength={120} />
            <Text style={styles.label}>Who can see this post?</Text>
            <View style={styles.privacyRow}>
              {(["everyone", "followers", "only_me"] as const).map((item) => (
                <Pressable key={item} onPress={() => setPrivacy(item)} style={[styles.privacyOption, privacy === item && styles.privacySelected]}>
                  <Text style={[styles.privacyText, privacy === item && styles.privacyTextSelected]}>{item === "only_me" ? "Only me" : item === "followers" ? "Followers" : "Everyone"}</Text>
                </Pressable>
              ))}
            </View>
            <ToggleRow label="Allow comments" value={allowComments} onChange={setAllowComments} />
            <ToggleRow label="Allow sharing" value={allowSharing} onChange={setAllowSharing} />
            {busy ? (
              <View style={styles.uploadProgress}>
                <View style={styles.track}><View style={[styles.bar, { width: `${Math.round(progress * 100)}%` }]} /></View>
                <Text style={styles.helper}>Uploading {Math.round(progress * 100)}%</Text>
              </View>
            ) : null}
            <Button loading={busy} disabled={!canPost} onPress={() => void publish()}>
              <Text style={styles.postButtonText}>Post to Vibed</Text>
            </Button>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.navigation}>
          {step > 0 ? <Button variant="quiet" onPress={() => { setError(null); setStep((current) => current - 1); }}>Back</Button> : <View />}
          {step < 3 ? <Button onPress={next}>Continue</Button> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function KindChoice({ icon, label, selected, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.kindChoice, selected && styles.kindSelected]}>
      <Ionicons name={icon} size={22} color={selected ? colors.mint : colors.muted} />
      <Text style={[styles.kindText, selected && styles.kindTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} /></View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18, gap: 18, paddingBottom: 28 },
  heading: { gap: 4 },
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13 },
  progress: { flexDirection: "row", justifyContent: "space-between", gap: 5, paddingVertical: 8 },
  progressItem: { flex: 1, alignItems: "center", gap: 6 },
  progressDot: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  progressActive: { backgroundColor: colors.mint, borderColor: colors.mint },
  progressNumber: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  progressNumberActive: { color: colors.background },
  progressLabel: { color: colors.muted, fontSize: 9, textAlign: "center" },
  progressLabelActive: { color: colors.text, fontWeight: "700" },
  stepContent: { gap: 14 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  kindRow: { flexDirection: "row", gap: 10 },
  kindChoice: { flex: 1, minHeight: 76, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  kindSelected: { borderColor: colors.mint, backgroundColor: "#122622" },
  kindText: { color: colors.muted, fontWeight: "700" },
  kindTextSelected: { color: colors.text },
  pickerRow: { gap: 9 },
  pickerButton: { flexDirection: "row", gap: 9 },
  buttonLabel: { color: colors.text, fontWeight: "700" },
  selectionText: { color: colors.mint, fontSize: 13, fontWeight: "700" },
  preview: { height: 300, borderRadius: 16, overflow: "hidden", backgroundColor: "#1E1728", justifyContent: "center", alignItems: "center" },
  previewImage: { width: "100%", height: "100%" },
  videoPreview: { alignItems: "center", gap: 10 },
  previewFile: { color: colors.text, fontSize: 12, maxWidth: "90%" },
  overlayPreview: { position: "absolute", bottom: 24, left: 18, right: 18, color: colors.text, fontSize: 19, fontWeight: "800", textAlign: "center", textShadowColor: "#000000", textShadowRadius: 5 },
  photoStrip: { gap: 8 },
  trimRow: { flexDirection: "row", gap: 10 },
  coverChoices: { flexDirection: "row", gap: 7 },
  photoThumb: { width: 64, height: 64, borderRadius: 10 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  helper: { color: colors.muted, fontSize: 12 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: -7 },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  vibeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  selectedTags: { color: colors.mint, fontSize: 12, fontWeight: "800" },
  counter: { alignSelf: "flex-end", color: colors.muted, fontSize: 10, marginTop: -12 },
  privacyRow: { flexDirection: "row", gap: 7 },
  privacyOption: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  privacySelected: { borderColor: colors.accent, backgroundColor: "#291938" },
  privacyText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  privacyTextSelected: { color: colors.text },
  toggleRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.border },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: "600" },
  uploadProgress: { gap: 6 },
  track: { height: 7, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  bar: { height: "100%", backgroundColor: colors.mint },
  postButtonText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  error: { color: "#FDA4AF", fontSize: 12 },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto" },
});
