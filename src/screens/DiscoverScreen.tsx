import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, Field, Heading, Screen } from "../components/ui";
import type { VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

type DiscoverUser = Pick<UserProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "vibe_tags">;
type LiveRoom = { id: string; title: string; vibe_tag: string; viewer_count: number };

export function DiscoverScreen({
  session,
  profile,
}: {
  session: Session;
  profile: UserProfile;
}) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [usersResult, followsResult, blocksResult, roomsResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, display_name, bio, avatar_url, vibe_tags")
          .neq("id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.from("vibe_followers").select("followed_id").eq("follower_id", session.user.id),
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", session.user.id),
        supabase.from("live_rooms").select("id, title, vibe_tag, viewer_count").eq("status", "live").order("created_at", { ascending: false }).limit(12),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (followsResult.error) throw followsResult.error;
      if (blocksResult.error) throw blocksResult.error;
      if (roomsResult.error) throw roomsResult.error;
      const blocked = new Set((blocksResult.data ?? []).map((item) => item.blocked_id));
      setUsers(((usersResult.data ?? []) as DiscoverUser[]).filter((item) => !blocked.has(item.id)));
      setFollows(new Set((followsResult.data ?? []).map((item) => item.followed_id)));
      setRooms((roomsResult.data ?? []) as LiveRoom[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Explore could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const rawTerm = search.trim().toLowerCase();
    const usernameTerm = rawTerm.replace(/[^a-z0-9_]/g, "");
    if (!rawTerm) return users;
    return users.filter((user) =>
      user.username.toLowerCase().includes(usernameTerm) ||
      user.display_name.toLowerCase().includes(rawTerm),
    );
  }, [search, users]);

  async function toggleFollow(user: DiscoverUser) {
    const following = follows.has(user.id);
    try {
      if (following) {
        const { error: deleteError } = await supabase
          .from("vibe_followers")
          .delete()
          .eq("follower_id", session.user.id)
          .eq("followed_id", user.id);
        if (deleteError) throw deleteError;
      } else {
        const sourceVibe = (user.vibe_tags[0] ?? profile.vibe_tags[0] ?? "Chill") as VibeName;
        const { error: followError } = await supabase
          .from("vibe_followers")
          .insert({ follower_id: session.user.id, followed_id: user.id, source_vibe: sourceVibe });
        if (followError) throw followError;
      }
      setFollows((current) => {
        const next = new Set(current);
        if (following) next.delete(user.id);
        else next.add(user.id);
        return next;
      });
    } catch (followError) {
      Alert.alert("Could not update follow", followError instanceof Error ? followError.message : "Please try again.");
    }
  }

  function blockUser(user: DiscoverUser) {
    Alert.alert("Block this account?", `You won’t see ${user.username} in your feed or explore list.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => void (async () => {
          try {
            const { error } = await supabase.from("blocked_users").insert({
            blocker_id: session.user.id,
            blocked_id: user.id,
            });
            if (error) throw error;
            setUsers((current) => current.filter((item) => item.id !== user.id));
          } catch (error) {
            Alert.alert("Could not block account", error instanceof Error ? error.message : "Please try again.");
          }
        })(),
      },
    ]);
  }

  function reportUser(user: DiscoverUser) {
    Alert.alert("Report this account", "Choose a reason for your report.", [
      ...(["harassment", "spam", "unsafe", "other"] as const).map((reason) => ({
        text: reason,
        onPress: () => {
          void (async () => {
            const { error } = await supabase.from("reported_content").insert({
              reporter_id: session.user.id,
              reported_user_id: user.id,
              reason,
            });
            if (error) Alert.alert("Report failed", error.message);
            else Alert.alert("Thanks", "Your report has been submitted.");
          })();
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function showUserOptions(user: DiscoverUser) {
    Alert.alert(user.display_name || user.username, `@${user.username}`, [
      { text: "Report account", onPress: () => reportUser(user) },
      { text: "Block account", style: "destructive", onPress: () => blockUser(user) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Heading title="Explore" subtitle="Find creators and live vibes." />
        <Field value={search} onChangeText={setSearch} placeholder="Search usernames" autoCapitalize="none" />

        {rooms.length > 0 ? (
          <View style={styles.roomSection}>
            <Text style={styles.sectionTitle}>Happening now</Text>
            <FlatList
              horizontal
              data={rooms}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roomList}
              renderItem={({ item }) => (
                <View style={styles.roomCard}>
                  <Text style={styles.liveTag}>LIVE · {item.vibe_tag}</Text>
                  <Text numberOfLines={1} style={styles.roomTitle}>{item.title}</Text>
                  <Text style={styles.roomViewers}>{item.viewer_count} watching · Live viewing coming soon</Text>
                </View>
              )}
            />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Creators for you</Text>
        {error ? (
          <EmptyState title="Explore unavailable" body={error} action={<Button onPress={() => void load()}>Try again</Button>} />
        ) : loading ? (
          <EmptyState title="Finding your people…" body="Loading creators from Vibed." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No creators found" body={search ? "Try another username." : "When people join Vibed, you’ll find them here."} />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.userList}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <Avatar uri={item.avatar_url} label={item.display_name || item.username} size={48} />
                <View style={styles.userDetails}>
                  <Text style={styles.displayName}>{item.display_name || item.username}</Text>
                  <Text style={styles.handle}>@{item.username}</Text>
                  <Text numberOfLines={2} style={styles.bio}>{item.bio || item.vibe_tags.join(" · ") || "Finding their vibe."}</Text>
                </View>
                <View style={styles.userActions}>
                  <Button
                    variant={follows.has(item.id) ? "secondary" : "primary"}
                    onPress={() => void toggleFollow(item)}
                    style={styles.followButton}
                  >
                    {follows.has(item.id) ? "Following" : "Follow"}
                  </Button>
                  <Pressable onPress={() => showUserOptions(item)} accessibilityLabel={`Options for ${item.username}`}>
                    <Text style={styles.more}>•••</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 14 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  roomSection: { gap: 10 },
  roomList: { gap: 10 },
  roomCard: { width: 235, padding: 14, gap: 7, borderRadius: 16, backgroundColor: "#21152B", borderWidth: 1, borderColor: "#4A2A60" },
  liveTag: { color: colors.mint, fontSize: 11, fontWeight: "800" },
  roomTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  roomViewers: { color: colors.muted, fontSize: 11 },
  userList: { gap: 10, paddingBottom: 16 },
  userCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  userDetails: { flex: 1, gap: 2 },
  displayName: { color: colors.text, fontWeight: "700", fontSize: 14 },
  handle: { color: colors.muted, fontSize: 12 },
  bio: { color: "#D4D4D8", fontSize: 12, marginTop: 3 },
  userActions: { alignItems: "center", gap: 3 },
  followButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 11 },
  more: { color: colors.muted, fontSize: 17, paddingHorizontal: 9, paddingVertical: 3 },
});
