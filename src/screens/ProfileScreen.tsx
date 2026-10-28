import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, Screen, VibeChip } from "../components/ui";
import { VIBES, type VibeName } from "../config/vibes";
import { EditProfileScreen } from "./EditProfileScreen";
import { SettingsScreen } from "./SettingsScreen";
import { supabase } from "../services/supabase";
import type { FeedVideo, UserProfile } from "../types/app";

type ProfileTab = "Videos" | "Photos" | "Liked" | "Saved";
const profileTabs: { key: ProfileTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "Videos", icon: "play-circle-outline" },
  { key: "Photos", icon: "images-outline" },
  { key: "Liked", icon: "heart-outline" },
  { key: "Saved", icon: "bookmark-outline" },
];

type ProfileScreenProps = {
  session: Session;
  profile: UserProfile;
  creatorUsername?: string;
  onProfileUpdated: (profile: UserProfile) => void;
  onMessageCreator: (contactId: string) => void;
  onClosePublicProfile: () => void;
};

export function ProfileScreen(props: ProfileScreenProps) {
  if (props.creatorUsername && props.creatorUsername !== props.profile.username) {
    return (
      <CreatorProfileScreen
        session={props.session}
        username={props.creatorUsername}
        onMessage={props.onMessageCreator}
        onClose={props.onClosePublicProfile}
      />
    );
  }
  return <OwnProfileScreen {...props} />;
}

function OwnProfileScreen({
  session,
  profile,
  onProfileUpdated,
  creatorUsername: _creatorUsername,
  onMessageCreator: _onMessageCreator,
  onClosePublicProfile: _onClosePublicProfile,
}: {
  session: Session;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  creatorUsername?: string;
  onMessageCreator: (contactId: string) => void;
  onClosePublicProfile: () => void;
}) {
  const [posts, setPosts] = useState<FeedVideo[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<ProfileTab>("Videos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [postsResult, followersResult, followingResult, likesResult, savesResult] = await Promise.all([
        supabase.from("videos")
          .select("id, user_id, optimized_url, media_urls, media_type, visibility, allow_comments, allow_sharing, caption, genre_tag, vibe_tag, audio_attribution, duration_ms, view_count, like_count, created_at, cover_url")
          .eq("user_id", session.user.id)
          .eq("suppressed", false)
          .order("created_at", { ascending: false }),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("followed_id", session.user.id),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("follower_id", session.user.id),
        supabase.from("engagements").select("video_id").eq("user_id", session.user.id).eq("event_type", "like"),
        supabase.from("saved_posts").select("video_id").eq("user_id", session.user.id),
      ]);
      if (postsResult.error) throw postsResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;
      if (likesResult.error) throw likesResult.error;
      if (savesResult.error) throw savesResult.error;

      const nextPosts = (postsResult.data ?? []) as FeedVideo[];
      const ids = nextPosts.map((post) => post.id);
      setPosts(nextPosts);
      setFollowers(followersResult.count ?? 0);
      setFollowing(followingResult.count ?? 0);
      setLikedIds((likesResult.data ?? []).map((item) => item.video_id));
      setSavedIds((savesResult.data ?? []).map((item) => item.video_id));
      if (ids.length) {
        const { data: creators, error: creatorsError } = await supabase.from("users")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(nextPosts.map((post) => post.user_id))]);
        if (creatorsError) throw creatorsError;
        const byId = new Map((creators ?? []).map((creator) => [creator.id, creator]));
        setPosts(nextPosts.map((post) => ({
          ...post,
          username: byId.get(post.user_id)?.username ?? profile.username,
          display_name: byId.get(post.user_id)?.display_name ?? profile.display_name,
          avatar_url: byId.get(post.user_id)?.avatar_url ?? profile.avatar_url,
        })));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [profile.avatar_url, profile.display_name, profile.username, session.user.id]);

  useEffect(() => { void load(); }, [load]);

  const visiblePosts = useMemo(() => {
    if (tab === "Photos") return posts.filter((post) => post.media_type === "photo");
    if (tab === "Videos") return posts.filter((post) => post.media_type !== "photo");
    if (tab === "Liked") return posts.filter((post) => likedIds.includes(post.id));
    return posts.filter((post) => savedIds.includes(post.id));
  }, [likedIds, posts, savedIds, tab]);

  const totalLikes = posts.reduce((total, post) => total + post.like_count, 0);
  const postCount = posts.length;

  async function shareProfile() {
    const link = `vibed://creator/${profile.username}`;
    try {
      await Share.share({ title: `${profile.display_name} on Vibed`, message: `Check out @${profile.username} on Vibed: ${link}`, url: link });
    } catch (shareError) {
      Alert.alert("Could not share profile", shareError instanceof Error ? shareError.message : "Please try again.");
    }
  }

  function signOut() {
    Alert.alert("Log out?", "You can log back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void supabase.auth.signOut().then(({ error: signOutError }) => {
            if (signOutError) Alert.alert("Log out failed", signOutError.message);
          });
        },
      },
    ]);
  }

  return (
    <>
      <Screen scroll>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Profile</Text>
            <Pressable onPress={() => setSettingsVisible(true)} style={styles.iconButton} accessibilityLabel="Open settings">
              <Ionicons name="menu-outline" size={25} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.cover}>
            {profile.cover_url ? <Image source={{ uri: profile.cover_url }} style={styles.coverPhoto} /> : null}
            <View style={styles.coverGradient} />
            <Avatar uri={profile.avatar_url} label={profile.display_name || profile.username} size={88} />
          </View>
          <View style={styles.identity}>
            <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : <Text style={styles.bioHint}>Add a bio to tell people about yourself.</Text>}
            {profile.website ? <Text style={styles.website}>{profile.website}</Text> : null}
            <View style={styles.stats}>
              <Stat value={following} label="Following" />
              <Stat value={followers} label="Followers" />
              <Stat value={totalLikes} label="Likes" />
            </View>
            <View style={styles.profileButtons}>
              <Button variant="secondary" style={styles.profileButton} onPress={() => setEditing(true)}>Edit profile</Button>
              <Button variant="secondary" style={styles.shareButton} onPress={() => void shareProfile()}>
                <Ionicons name="share-outline" size={18} color={colors.text} />
              </Button>
            </View>
          </View>
          {profile.vibe_tags.length ? (
            <View style={styles.knownVibes}>
              <Text style={styles.sectionTitle}>Known for</Text>
              <View style={styles.chips}>
                {profile.vibe_tags.filter((vibe): vibe is typeof VIBES[number] => VIBES.includes(vibe as typeof VIBES[number])).map((vibe) => (
                  <VibeChip key={vibe} vibe={vibe} compact />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.tabs}>
            {profileTabs.map((item) => (
              <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.activeTab]}>
                <Ionicons name={item.icon} size={20} color={tab === item.key ? colors.mint : colors.muted} />
                <Text style={[styles.tabText, tab === item.key && styles.activeTabText]}>{item.key}</Text>
              </Pressable>
            ))}
          </View>
          {loading ? (
            <EmptyState title="Loading your posts…" body="Fetching videos and photos." />
          ) : error ? (
            <EmptyState title="Profile unavailable" body={error} action={<Button onPress={() => void load()}>Retry</Button>} />
          ) : visiblePosts.length ? (
            <View style={styles.grid}>
              {visiblePosts.map((post) => <PostTile key={post.id} post={post} />)}
            </View>
          ) : (
            <EmptyState
              title={tab === "Saved" ? "No saved posts yet" : tab === "Liked" ? "No liked posts yet" : `No ${tab.toLowerCase()} yet`}
              body={tab === "Saved" || tab === "Liked" ? "Posts you save or like will appear here. Only you can see these tabs." : "Share a moment with your Vibe Room to get started."}
            />
          )}
          <Text style={styles.postCount}>{postCount} posts · {posts.reduce((count, post) => count + post.view_count, 0).toLocaleString()} views</Text>
        </View>
      </Screen>
      <Modal visible={settingsVisible} animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <SettingsScreen
          session={session}
          profile={profile}
          onProfileUpdated={onProfileUpdated}
          onEditProfile={() => { setSettingsVisible(false); setEditing(true); }}
          onClose={() => setSettingsVisible(false)}
          onSignOut={signOut}
        />
      </Modal>
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <EditProfileScreen
          session={session}
          profile={profile}
          onCancel={() => setEditing(false)}
          onSave={(updates) => {
            onProfileUpdated(updates);
            setEditing(false);
          }}
        />
      </Modal>
    </>
  );
}

function CreatorProfileScreen({
  session,
  username,
  onMessage,
  onClose,
}: {
  session: Session;
  username: string;
  onMessage: (contactId: string) => void;
  onClose: () => void;
}) {
  const [creator, setCreator] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedVideo[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [liked, setLiked] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tab, setTab] = useState<"Videos" | "Photos">("Videos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: user, error: userError } = await supabase.from("users")
        .select("id, username, display_name, bio, avatar_url, cover_url, website, is_private, vibe_tags, hard_muted_vibes, onboarding_complete")
        .eq("username", username)
        .single();
      if (userError) throw userError;
      const typedUser = user as UserProfile;
      setCreator(typedUser);
      const [followResult, followersResult, followingResult, postsResult] = await Promise.all([
        supabase.from("vibe_followers").select("id").eq("follower_id", session.user.id).eq("followed_id", typedUser.id).maybeSingle(),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("followed_id", typedUser.id),
        supabase.from("vibe_followers").select("id", { count: "exact", head: true }).eq("follower_id", typedUser.id),
        supabase.from("videos")
          .select("id, user_id, optimized_url, media_urls, media_type, visibility, allow_comments, allow_sharing, cover_url, text_overlay, caption, genre_tag, vibe_tag, audio_attribution, duration_ms, view_count, like_count, created_at")
          .eq("user_id", typedUser.id)
          .eq("suppressed", false)
          .order("created_at", { ascending: false }),
      ]);
      if (followResult.error) throw followResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;
      if (postsResult.error) throw postsResult.error;
      setIsFollowing(Boolean(followResult.data));
      setFollowers(followersResult.count ?? 0);
      setFollowing(followingResult.count ?? 0);
      const nextPosts = (postsResult.data ?? []) as FeedVideo[];
      setPosts(nextPosts);
      setLiked(nextPosts.reduce((count, post) => count + post.like_count, 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Creator profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session.user.id, username]);

  useEffect(() => { void load(); }, [load]);

  async function toggleFollow() {
    if (!creator) return;
    try {
      const result = isFollowing
        ? await supabase.from("vibe_followers").delete().eq("follower_id", session.user.id).eq("followed_id", creator.id)
        : await supabase.from("vibe_followers").insert({
            follower_id: session.user.id,
            followed_id: creator.id,
            source_vibe: (creator.vibe_tags[0] ?? "Chill") as VibeName,
          });
      if (result.error) throw result.error;
      setIsFollowing(!isFollowing);
      setFollowers((count) => Math.max(0, count + (isFollowing ? -1 : 1)));
    } catch (followError) {
      Alert.alert("Could not update follow", followError instanceof Error ? followError.message : "Please try again.");
    }
  }

  function showOptions() {
    if (!creator) return;
    Alert.alert(creator.display_name || creator.username, `@${creator.username}`, [
      {
        text: "Report",
        onPress: () => {
          void supabase.from("reported_content").insert({
            reporter_id: session.user.id,
            reported_user_id: creator.id,
            reason: "other",
          }).then(({ error: reportError }) => {
            if (reportError) Alert.alert("Report failed", reportError.message);
            else Alert.alert("Thanks for letting us know", "Your report has been submitted.");
          });
        },
      },
      {
        text: "Block user",
        style: "destructive",
        onPress: () => {
          void supabase.from("blocked_users").insert({ blocker_id: session.user.id, blocked_id: creator.id })
            .then(({ error: blockError }) => {
              if (blockError) Alert.alert("Could not block account", blockError.message);
              else onClose();
            });
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const visiblePosts = posts.filter((post) => tab === "Photos" ? post.media_type === "photo" : post.media_type !== "photo");

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
          <Text style={styles.topTitle}>Creator</Text>
          <Pressable onPress={showOptions} style={styles.iconButton}><Ionicons name="ellipsis-horizontal" size={23} color={colors.text} /></Pressable>
        </View>
        {loading ? <EmptyState title="Loading creator…" body="Fetching profile and posts." /> : error || !creator ? (
          <EmptyState title="Profile unavailable" body={error ?? "This profile could not be found."} action={<Button onPress={() => void load()}>Retry</Button>} />
        ) : (
          <>
            <View style={styles.cover}>
              {creator.cover_url ? <Image source={{ uri: creator.cover_url }} style={styles.coverPhoto} /> : null}
              <View style={styles.coverGradient} />
              <Avatar uri={creator.avatar_url} label={creator.display_name || creator.username} size={88} />
            </View>
            <View style={styles.identity}>
              <Text style={styles.displayName}>{creator.display_name || creator.username}</Text>
              <Text style={styles.username}>@{creator.username}</Text>
              {creator.bio ? <Text style={styles.bio}>{creator.bio}</Text> : null}
              {creator.website ? <Pressable onPress={() => void Linking.openURL(creator.website ?? "")}><Text style={styles.website}>{creator.website}</Text></Pressable> : null}
              <View style={styles.stats}>
                <Stat value={following} label="Following" />
                <Stat value={followers} label="Followers" />
                <Stat value={liked} label="Likes" />
              </View>
              <View style={styles.profileButtons}>
                <Button variant={isFollowing ? "secondary" : "primary"} style={styles.profileButton} onPress={() => void toggleFollow()}>{isFollowing ? "Following" : "Follow"}</Button>
                <Button variant="secondary" style={styles.profileButton} onPress={() => onMessage(creator.id)}>Message</Button>
              </View>
            </View>
            {creator.vibe_tags.length ? <View style={styles.knownVibes}><Text style={styles.sectionTitle}>Known for</Text><View style={styles.chips}>{creator.vibe_tags.filter((vibe): vibe is typeof VIBES[number] => VIBES.includes(vibe as typeof VIBES[number])).map((vibe) => <VibeChip key={vibe} vibe={vibe} compact />)}</View></View> : null}
            <View style={styles.tabs}>
              {(["Videos", "Photos"] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Ionicons name={item === "Videos" ? "play-circle-outline" : "images-outline"} size={20} color={tab === item ? colors.mint : colors.muted} /><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text></Pressable>)}
            </View>
            {creator.is_private && !isFollowing ? <EmptyState title="This account is private" body="Follow this creator to see their posts." /> : visiblePosts.length ? <View style={styles.grid}>{visiblePosts.map((post) => <PostTile key={post.id} post={post} />)}</View> : <EmptyState title={`No ${tab.toLowerCase()} yet`} body="This creator has not shared any posts here." />}
          </>
        )}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value.toLocaleString()}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function PostTile({ post }: { post: FeedVideo }) {
  const source = post.media_type === "photo" ? post.media_urls?.[0] : post.cover_url;
  return (
    <View style={styles.tile}>
      {source ? <Image source={{ uri: source }} style={styles.tileImage} /> : <View style={styles.videoPlaceholder}><Ionicons name="play" size={22} color={colors.text} /></View>}
      <View style={styles.tileOverlay}>
        <Ionicons name={post.media_type === "photo" ? "images-outline" : "play"} size={14} color={colors.text} />
        <Text style={styles.tileViews}>{post.view_count.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  topBar: { height: 38, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  cover: { height: 128, borderRadius: 18, backgroundColor: "#36204D", justifyContent: "flex-end", padding: 14 },
  coverPhoto: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, borderRadius: 18 },
  coverGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 18, backgroundColor: "rgba(10,10,12,0.13)" },
  identity: { alignItems: "center", gap: 5, marginTop: -4 },
  displayName: { color: colors.text, fontSize: 21, fontWeight: "800" },
  username: { color: colors.muted, fontSize: 13 },
  bio: { maxWidth: "90%", color: colors.text, textAlign: "center", fontSize: 13, lineHeight: 19, marginTop: 4 },
  bioHint: { color: colors.muted, fontSize: 13, marginTop: 4 },
  website: { color: colors.mint, fontSize: 12, marginTop: 2 },
  stats: { flexDirection: "row", justifyContent: "space-evenly", width: "100%", marginTop: 8 },
  stat: { alignItems: "center", gap: 2, minWidth: 75 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11 },
  profileButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  profileButton: { minHeight: 40, minWidth: 150 },
  shareButton: { width: 44, minHeight: 40, paddingHorizontal: 0 },
  knownVibes: { gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tabs: { flexDirection: "row", justifyContent: "space-around", borderBottomWidth: 1, borderColor: colors.border, marginTop: 4 },
  tab: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 11 },
  activeTab: { borderBottomWidth: 2, borderColor: colors.mint },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  activeTabText: { color: colors.mint },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  tile: { width: "32.8%", aspectRatio: 0.76, backgroundColor: colors.panel, borderRadius: 5, overflow: "hidden" },
  tileImage: { width: "100%", height: "100%" },
  videoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#30213D" },
  tileOverlay: { position: "absolute", bottom: 6, left: 6, flexDirection: "row", gap: 4, alignItems: "center", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)" },
  tileViews: { color: colors.text, fontSize: 10, fontWeight: "700" },
  postCount: { color: colors.muted, fontSize: 11, textAlign: "center" },
});
