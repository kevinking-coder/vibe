import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, Heading, Screen, VibeChip } from "../components/ui";
import { VIBES, type VibeName } from "../config/vibes";
import { SearchScreen } from "./SearchScreen";
import { supabase } from "../services/supabase";
import { useAppStore } from "../store/appStore";
import type { FeedVideo, UserProfile } from "../types/app";

type DiscoverUser = Pick<UserProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "vibe_tags" | "is_private">;
type LiveRoom = { id: string; title: string; vibe_tag: string; viewer_count: number };
type ExplorePost = Pick<FeedVideo, "id" | "user_id" | "optimized_url" | "media_urls" | "media_type" | "caption" | "vibe_tag" | "view_count">;

export function DiscoverScreen({
  session,
  profile,
  onOpenCreator,
  onOpenPost,
}: {
  session: Session;
  profile: UserProfile;
  onOpenCreator: (username: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setActiveVibe = useAppStore((state) => state.setActiveVibeRoom);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [usersResult, followsResult, blocksResult, roomsResult, postsResult] = await Promise.all([
        supabase.from("users")
          .select("id, username, display_name, bio, avatar_url, vibe_tags, is_private")
          .neq("id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.from("vibe_followers").select("followed_id").eq("follower_id", session.user.id),
        supabase.from("blocked_users").select("blocker_id, blocked_id").or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`),
        supabase.from("live_rooms").select("id, title, vibe_tag, viewer_count").eq("status", "live").order("created_at", { ascending: false }).limit(12),
        supabase.from("videos").select("id, user_id, optimized_url, media_urls, media_type, caption, vibe_tag, view_count")
          .eq("visibility", "everyone").eq("suppressed", false).order("view_count", { ascending: false }).limit(36),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (followsResult.error) throw followsResult.error;
      if (blocksResult.error) throw blocksResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (postsResult.error) throw postsResult.error;
      const followedIds = new Set((followsResult.data ?? []).map((item) => item.followed_id));
      const blockedIds = new Set((blocksResult.data ?? []).map((item) => item.blocker_id === session.user.id ? item.blocked_id : item.blocker_id));
      setFollows(followedIds);
      setUsers(((usersResult.data ?? []) as DiscoverUser[]).filter((user) =>
        !blockedIds.has(user.id) && (!user.is_private || followedIds.has(user.id)),
      ));
      const mutedVibes = new Set(profile.hard_muted_vibes);
      setRooms(((roomsResult.data ?? []) as LiveRoom[]).filter((room) => !mutedVibes.has(room.vibe_tag)));
      setPosts(((postsResult.data ?? []) as ExplorePost[]).filter((post) =>
        !blockedIds.has(post.user_id) && !mutedVibes.has(post.vibe_tag),
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Explore could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [profile.hard_muted_vibes, session.user.id]);

  useEffect(() => { void load(); }, [load]);

  const visibleVibes = VIBES.filter((vibe) => !profile.hard_muted_vibes.includes(vibe));
  const trendingVibes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) counts.set(post.vibe_tag, (counts.get(post.vibe_tag) ?? 0) + post.view_count);
    return [...visibleVibes].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 8);
  }, [posts, profile.hard_muted_vibes]);

  async function toggleFollow(user: DiscoverUser) {
    const following = follows.has(user.id);
    try {
      if (following) {
        const { error } = await supabase.from("vibe_followers").delete()
          .eq("follower_id", session.user.id).eq("followed_id", user.id);
        if (error) throw error;
      } else {
        const sourceVibe = (user.vibe_tags[0] ?? profile.vibe_tags[0] ?? "Chill") as VibeName;
        const { error } = await supabase.from("vibe_followers").insert({
          follower_id: session.user.id,
          followed_id: user.id,
          source_vibe: sourceVibe,
        });
        if (error) throw error;
      }
      setFollows((current) => {
        const next = new Set(current);
        if (following) next.delete(user.id);
        else next.add(user.id);
        return next;
      });
      if (!following && user.is_private) {
        Alert.alert("Follow request sent", "This creator will need to approve your request.");
      }
    } catch (followError) {
      Alert.alert("Could not update follow", followError instanceof Error ? followError.message : "Please try again.");
    }
  }

  function blockUser(user: DiscoverUser) {
    Alert.alert("Block this account?", `You won’t see @${user.username} in your feed or Explore.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          void supabase.from("blocked_users").insert({ blocker_id: session.user.id, blocked_id: user.id }).then(({ error: blockError }) => {
            if (blockError) Alert.alert("Could not block account", blockError.message);
            else {
              setUsers((current) => current.filter((item) => item.id !== user.id));
              setPosts((current) => current.filter((post) => post.user_id !== user.id));
            }
          });
        },
      },
    ]);
  }

  function reportUser(user: DiscoverUser) {
    Alert.alert("Report this account", "Choose a reason for your report.", [
      ...(["harassment", "spam", "unsafe", "other"] as const).map((reason) => ({
        text: reason,
        onPress: () => {
          void supabase.from("reported_content").insert({
            reporter_id: session.user.id,
            reported_user_id: user.id,
            reason,
          }).then(({ error: reportError }) => {
            if (reportError) Alert.alert("Report failed", reportError.message);
            else Alert.alert("Thanks for letting us know", "Your report has been submitted.");
          });
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  return (
    <>
      <Screen scroll>
        <View style={styles.container}>
          <Heading title="Explore" subtitle="Find your next favorite vibe." />
          <Pressable onPress={() => setSearchOpen(true)} style={styles.search}>
            <Ionicons name="search" size={19} color={colors.muted} />
            <Text style={styles.searchText}>Search videos, vibes, creators, sounds</Text>
          </Pressable>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Explore vibes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {visibleVibes.map((vibe) => <VibeChip key={vibe} vibe={vibe} onPress={() => setActiveVibe(vibe)} compact />)}
            </ScrollView>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending vibes</Text>
            <View style={styles.chipWrap}>
              {trendingVibes.slice(0, 6).map((vibe, index) => (
                <Pressable key={vibe} onPress={() => setActiveVibe(vibe)} style={styles.trendingChip}>
                  <Text style={styles.trendingRank}>0{index + 1}</Text>
                  <VibeChip vibe={vibe} compact />
                </Pressable>
              ))}
            </View>
          </View>
          {rooms.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Live now</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
                {rooms.map((room) => (
                  <View key={room.id} style={styles.liveCard}>
                    <View style={styles.liveHeader}><Text style={styles.liveBadge}>LIVE</Text><Text style={styles.liveVibe}>{room.vibe_tag}</Text></View>
                    <Text numberOfLines={1} style={styles.liveTitle}>{room.title}</Text>
                    <Text style={styles.liveViewers}>{room.viewer_count.toLocaleString()} watching · Live viewing coming soon</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.section}>
            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Popular videos and photos</Text><Text style={styles.subtle}>Most viewed</Text></View>
            {error ? <EmptyState title="Explore unavailable" body={error} action={<Button onPress={() => void load()}>Retry</Button>} /> : loading ? (
              <EmptyState title="Finding popular posts…" body="Fetching videos and photos." />
            ) : posts.length ? (
              <View style={styles.postGrid}>
                {posts.map((post) => <ExploreTile key={post.id} post={post} onPress={() => onOpenPost(post.id)} />)}
              </View>
            ) : <EmptyState title="Nothing trending yet" body="Posts will appear here as the community grows." />}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Creators</Text>
            {users.length ? users.slice(0, 12).map((user) => (
              <View key={user.id} style={styles.userCard}>
                <Avatar uri={user.avatar_url} label={user.display_name || user.username} size={46} />
                <Pressable onPress={() => onOpenCreator(user.username)} style={styles.userDetails}>
                  <Text style={styles.userName}>{user.display_name || user.username}</Text>
                  <Text style={styles.userMeta}>@{user.username} · {user.vibe_tags.slice(0, 2).join(" · ")}</Text>
                </Pressable>
                <Button variant={follows.has(user.id) ? "secondary" : "primary"} onPress={() => void toggleFollow(user)} style={styles.followButton}>
                  {follows.has(user.id) ? "Following" : "Follow"}
                </Button>
                <Pressable onPress={() => Alert.alert(user.display_name || user.username, `@${user.username}`, [
                  { text: "Report", onPress: () => reportUser(user) },
                  { text: "Block", style: "destructive", onPress: () => blockUser(user) },
                  { text: "Close", style: "cancel" },
                ])} accessibilityLabel={`Options for ${user.username}`}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
                </Pressable>
              </View>
            )) : <Text style={styles.subtle}>New creators will appear here.</Text>}
          </View>
        </View>
      </Screen>
      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SearchScreen
          session={session}
          hardMutedVibes={profile.hard_muted_vibes}
          onClose={() => setSearchOpen(false)}
          onOpenCreator={(username) => { setSearchOpen(false); onOpenCreator(username); }}
          onOpenPost={(postId) => { setSearchOpen(false); onOpenPost(postId); }}
        />
      </Modal>
    </>
  );
}

function ExploreTile({ post, onPress }: { post: ExplorePost; onPress: () => void }) {
  const url = post.media_type === "photo" ? post.media_urls?.[0] : null;
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      {url ? <Image source={{ uri: url }} style={styles.tileImage} /> : <View style={styles.tilePlaceholder}><Ionicons name="play" size={21} color={colors.text} /></View>}
      <View style={styles.tileBottom}>
        <Ionicons name={post.media_type === "photo" ? "images-outline" : "play"} size={12} color={colors.text} />
        <Text style={styles.views}>{post.view_count.toLocaleString()}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 18, padding: 18, paddingBottom: 28 },
  search: { height: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  searchText: { color: colors.muted, fontSize: 12 },
  section: { gap: 10 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  subtle: { color: colors.muted, fontSize: 11 },
  chipRow: { gap: 7, paddingRight: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  trendingChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  trendingRank: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  liveRow: { gap: 10 },
  liveCard: { width: 235, padding: 13, gap: 8, borderRadius: 16, backgroundColor: "#21152B", borderWidth: 1, borderColor: "#4A2A60" },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveBadge: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", backgroundColor: "#E11D48", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  liveVibe: { color: colors.mint, fontSize: 10, fontWeight: "800" },
  liveTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  liveViewers: { color: colors.muted, fontSize: 10 },
  postGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tile: { width: "32.2%", aspectRatio: 0.74, borderRadius: 7, overflow: "hidden", backgroundColor: colors.panel },
  tileImage: { width: "100%", height: "100%" },
  tilePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#30213D" },
  tileBottom: { position: "absolute", bottom: 5, left: 5, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.55)" },
  views: { color: colors.text, fontSize: 9, fontWeight: "700" },
  userCard: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderRadius: 14, backgroundColor: colors.panel },
  userDetails: { flex: 1, gap: 3 },
  userName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  userMeta: { color: colors.muted, fontSize: 10 },
  followButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 11 },
});
