import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, Field, Screen } from "../components/ui";
import { VIBE_THEMES, type VibeName } from "../config/vibes";
import { uploadAvatar } from "../services/media";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

type VideoSummary = { id: string; caption: string; vibe_tag: string; like_count: number; view_count: number };
type BlockedProfile = Pick<UserProfile, "id" | "username" | "display_name" | "avatar_url">;
const vibes = Object.keys(VIBE_THEMES) as VibeName[];

export function ProfileScreen({
  session,
  profile,
  onProfileUpdated,
}: {
  session: Session;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [vibeTags, setVibeTags] = useState(profile.vibe_tags);
  const [hardMuted, setHardMuted] = useState(profile.hard_muted_vibes);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const [videosResult, followersResult, followingResult, blocksResult] = await Promise.all([
        supabase.from("videos").select("id, caption, vibe_tag, like_count, view_count").eq("user_id", session.user.id).eq("suppressed", false).order("created_at", { ascending: false }),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("followed_id", session.user.id),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("follower_id", session.user.id),
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", session.user.id),
      ]);
      if (videosResult.error) throw videosResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;
      if (blocksResult.error) throw blocksResult.error;

      const blockedIds = (blocksResult.data ?? []).map((item) => item.blocked_id);
      let blockedProfiles: BlockedProfile[] = [];
      if (blockedIds.length) {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url")
          .in("id", blockedIds);
        if (error) throw error;
        blockedProfiles = (data ?? []) as BlockedProfile[];
      }

      setVideos((videosResult.data ?? []) as VideoSummary[]);
      setFollowerCount(followersResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);
      setBlocked(blockedProfiles);
    } catch (error) {
      Alert.alert("Could not load profile details", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    setDisplayName(profile.display_name);
    setBio(profile.bio);
    setVibeTags(profile.vibe_tags);
    setHardMuted(profile.hard_muted_vibes);
  }, [profile]);

  function toggleList(list: string[], setList: (values: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function saveProfile() {
    if (!displayName.trim()) {
      Alert.alert("Add a display name", "Your display name can’t be empty.");
      return;
    }
    setBusy(true);
    try {
      const updates = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        vibe_tags: vibeTags,
        hard_muted_vibes: hardMuted,
      };
      const { error } = await supabase.from("users").update(updates).eq("id", session.user.id);
      if (error) throw error;
      onProfileUpdated({ ...profile, ...updates });
      setEditing(false);
    } catch (error) {
      Alert.alert("Profile not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function changeAvatar() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Allow photo access", "Vibed needs photo library access to update your profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;

      setBusy(true);
      const avatarUrl = await uploadAvatar(result.assets[0], session.user.id);
      const { error } = await supabase.from("users").update({ avatar_url: avatarUrl }).eq("id", session.user.id);
      if (error) throw error;
      onProfileUpdated({ ...profile, avatar_url: avatarUrl });
    } catch (error) {
      Alert.alert("Could not update your photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function unblock(user: BlockedProfile) {
    Alert.alert("Unblock this account?", `${user.username} may appear in your feed again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () => {
          void supabase.from("blocked_users").delete()
            .eq("blocker_id", session.user.id)
            .eq("blocked_id", user.id)
            .then(({ error }) => {
              if (error) Alert.alert("Could not unblock account", error.message);
              else setBlocked((current) => current.filter((item) => item.id !== user.id));
            });
        },
      },
    ]);
  }

  function signOut() {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void supabase.auth.signOut().then(({ error }) => {
            if (error) Alert.alert("Sign-out failed", error.message);
          });
        },
      },
    ]);
  }

  const totalLikes = videos.reduce((sum, video) => sum + video.like_count, 0);
  const totalViews = videos.reduce((sum, video) => sum + video.view_count, 0);

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your profile</Text>
          <Button variant="secondary" onPress={() => setEditing((value) => !value)} style={styles.editButton}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </View>
        <View style={styles.profileCard}>
          <Pressable onPress={() => void changeAvatar()} disabled={busy} style={styles.avatarWrap}>
            <Avatar uri={profile.avatar_url} label={profile.display_name || profile.username} size={82} />
            <View style={styles.camera}><Text style={styles.cameraText}>＋</Text></View>
          </Pressable>
          <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <Text style={styles.bio}>{profile.bio || "Add a little about yourself."}</Text>
          <View style={styles.stats}>
            <Stat value={videos.length} label="videos" />
            <Stat value={followerCount} label="followers" />
            <Stat value={followingCount} label="following" />
            <Stat value={totalLikes} label="likes" />
          </View>
          <Text style={styles.views}>{totalViews} total views</Text>
        </View>

        {editing ? (
          <View style={styles.editor}>
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={60} />
            <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="Tell people what you’re about…" />
            <View>
              <Text style={styles.sectionTitle}>My vibes</Text>
              <Text style={styles.help}>Choose the vibes you want in your feed.</Text>
              <View style={styles.tags}>
                {vibes.map((vibe) => (
                  <Tag key={`vibe-${vibe}`} label={vibe} active={vibeTags.includes(vibe)} accent={VIBE_THEMES[vibe].accent} onPress={() => toggleList(vibeTags, setVibeTags, vibe)} />
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Hard mute</Text>
              <Text style={styles.help}>These vibes will be filtered from your feed.</Text>
              <View style={styles.tags}>
                {vibes.map((vibe) => (
                  <Tag key={`mute-${vibe}`} label={vibe} active={hardMuted.includes(vibe)} accent={colors.danger} onPress={() => toggleList(hardMuted, setHardMuted, vibe)} />
                ))}
              </View>
            </View>
            <Button loading={busy} onPress={() => void saveProfile()}>Save changes</Button>
          </View>
        ) : null}

        <View style={styles.postsHeader}>
          <Text style={styles.sectionTitle}>Your videos</Text>
          {loading ? <Text style={styles.help}>Loading…</Text> : null}
        </View>
        {!loading && videos.length === 0 ? (
          <EmptyState title="Your first post starts here" body="Create a short video and it’ll show up on your profile and in its vibe feed." />
        ) : (
          videos.map((video) => (
            <View key={video.id} style={styles.videoRow}>
              <View style={styles.videoMark}><Text style={styles.play}>▶</Text></View>
              <View style={styles.videoDetails}>
                <Text numberOfLines={2} style={styles.videoCaption}>{video.caption || "Untitled video"}</Text>
                <Text style={styles.videoMeta}>{video.vibe_tag} · {video.view_count} views · {video.like_count} likes</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.settings}>
          <Button variant="secondary" onPress={() => setShowBlocked((value) => !value)}>
            {showBlocked ? "Hide blocked accounts" : `Blocked accounts (${blocked.length})`}
          </Button>
          {showBlocked ? blocked.map((user) => (
            <View key={user.id} style={styles.blockedRow}>
              <Avatar uri={user.avatar_url} label={user.display_name || user.username} size={36} />
              <Text style={styles.blockedName}>{user.display_name || user.username}</Text>
              <Pressable onPress={() => unblock(user)}><Text style={styles.unblock}>Unblock</Text></Pressable>
            </View>
          )) : null}
          <Button variant="danger" onPress={signOut}>Sign out</Button>
        </View>
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tag({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tag, active && { borderColor: accent, backgroundColor: `${accent}20` }]}
    >
      <Text style={[styles.tagText, active && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  editButton: { minHeight: 40, paddingHorizontal: 15 },
  profileCard: { alignItems: "center", padding: 20, borderRadius: 20, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  avatarWrap: { position: "relative", marginBottom: 10 },
  camera: { position: "absolute", right: 0, bottom: 0, width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  cameraText: { color: colors.text, fontWeight: "800", fontSize: 17, lineHeight: 20 },
  displayName: { color: colors.text, fontSize: 19, fontWeight: "800" },
  username: { color: colors.muted, fontSize: 13, marginTop: 3 },
  bio: { color: "#D4D4D8", fontSize: 13, textAlign: "center", marginTop: 12, lineHeight: 19 },
  stats: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 19 },
  stat: { alignItems: "center", gap: 3 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11 },
  views: { color: colors.muted, fontSize: 12, marginTop: 10 },
  editor: { gap: 14, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  help: { color: colors.muted, fontSize: 12, marginTop: 3 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: { paddingVertical: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.panelRaised },
  tagText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  postsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  videoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderRadius: 14, backgroundColor: colors.panel },
  videoMark: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#342044" },
  play: { color: colors.mint, fontSize: 17 },
  videoDetails: { flex: 1, gap: 6 },
  videoCaption: { color: colors.text, fontSize: 13, fontWeight: "600" },
  videoMeta: { color: colors.muted, fontSize: 11 },
  settings: { gap: 10, paddingTop: 4, paddingBottom: 20 },
  blockedRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.panel },
  blockedName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
  unblock: { color: colors.mint, fontWeight: "700", padding: 6 },
});
