import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, VibeChip } from "../components/ui";
import { VIBES } from "../config/vibes";
import { supabase } from "../services/supabase";
import { useAppStore } from "../store/appStore";
import type { FeedVideo, UserProfile } from "../types/app";

const RECENTS_KEY = "vibed.search.recent.v1";
const SEARCH_TABS = ["Top", "Videos", "Photos", "Creators", "Vibes", "Live", "Sounds"] as const;
type SearchTab = typeof SEARCH_TABS[number];
type SearchCreator = Pick<UserProfile, "id" | "username" | "display_name" | "avatar_url" | "vibe_tags">;
type SearchLive = { id: string; title: string; vibe_tag: string; viewer_count: number };
type SearchablePost = Pick<FeedVideo, "id" | "user_id" | "caption" | "optimized_url" | "media_urls" | "media_type" | "vibe_tag" | "genre_tag" | "audio_attribution" | "view_count">;

const trending = ["summer vibes", "easy recipes", "dance challenge", "cozy room", "travel diaries"];
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export function SearchScreen({
  session,
  onClose,
  onOpenCreator,
  onOpenPost,
  hardMutedVibes,
}: {
  session: Session;
  onClose: () => void;
  onOpenCreator: (username: string) => void;
  onOpenPost: (postId: string) => void;
  hardMutedVibes: string[];
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("Top");
  const [recents, setRecents] = useState<string[]>([]);
  const [posts, setPosts] = useState<SearchablePost[]>([]);
  const [creators, setCreators] = useState<SearchCreator[]>([]);
  const [rooms, setRooms] = useState<SearchLive[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setActiveVibe = useAppStore((state) => state.setActiveVibeRoom);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(RECENTS_KEY).then((value) => {
      if (active && value) setRecents(JSON.parse(value) as string[]);
    }).catch((storageError: unknown) => {
      Alert.alert("Search history unavailable", storageError instanceof Error ? storageError.message : "Could not load recent searches.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setPosts([]);
      setCreators([]);
      setRooms([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const pattern = `%${escapeLike(term)}%`;
          const [captionResult, genreResult, vibeResult, audioResult, usernameResult, displayResult, roomTitleResult, roomVibeResult, blocksResult] = await Promise.all([
            supabase.from("videos").select("id, user_id, caption, optimized_url, media_urls, media_type, vibe_tag, genre_tag, audio_attribution, view_count").ilike("caption", pattern).eq("suppressed", false).limit(30),
            supabase.from("videos").select("id, user_id, caption, optimized_url, media_urls, media_type, vibe_tag, genre_tag, audio_attribution, view_count").ilike("genre_tag", pattern).eq("suppressed", false).limit(20),
            supabase.from("videos").select("id, user_id, caption, optimized_url, media_urls, media_type, vibe_tag, genre_tag, audio_attribution, view_count").ilike("vibe_tag", pattern).eq("suppressed", false).limit(20),
            supabase.from("videos").select("id, user_id, caption, optimized_url, media_urls, media_type, vibe_tag, genre_tag, audio_attribution, view_count").ilike("audio_attribution", pattern).eq("suppressed", false).limit(20),
            supabase.from("users").select("id, username, display_name, avatar_url, vibe_tags").ilike("username", pattern).neq("id", session.user.id).limit(20),
            supabase.from("users").select("id, username, display_name, avatar_url, vibe_tags").ilike("display_name", pattern).neq("id", session.user.id).limit(20),
            supabase.from("live_rooms").select("id, title, vibe_tag, viewer_count").eq("status", "live").ilike("title", pattern).limit(20),
            supabase.from("live_rooms").select("id, title, vibe_tag, viewer_count").eq("status", "live").ilike("vibe_tag", pattern).limit(20),
            supabase.from("blocked_users").select("blocker_id, blocked_id").or(`blocker_id.eq.${session.user.id},blocked_id.eq.${session.user.id}`),
          ]);
          for (const result of [captionResult, genreResult, vibeResult, audioResult, usernameResult, displayResult, roomTitleResult, roomVibeResult, blocksResult]) {
            if (result.error) throw result.error;
          }
          const blockedIds = new Set((blocksResult.data ?? []).map((item) => item.blocker_id === session.user.id ? item.blocked_id : item.blocker_id));
          const combinedPosts = new Map<string, SearchablePost>();
          for (const row of [...(captionResult.data ?? []), ...(genreResult.data ?? []), ...(vibeResult.data ?? []), ...(audioResult.data ?? [])]) {
            if (!blockedIds.has(row.user_id)) combinedPosts.set(row.id, row as SearchablePost);
          }
          const combinedCreators = new Map<string, SearchCreator>();
          for (const row of [...(usernameResult.data ?? []), ...(displayResult.data ?? [])]) {
            if (!blockedIds.has(row.id)) combinedCreators.set(row.id, row as SearchCreator);
          }
          if (!active) return;
          setPosts([...combinedPosts.values()].sort((a, b) => b.view_count - a.view_count));
          setCreators([...combinedCreators.values()]);
          setRooms([...new Map([...(roomTitleResult.data ?? []), ...(roomVibeResult.data ?? [])].map((room) => [room.id, room])).values()] as SearchLive[]);
        } catch (searchError) {
          if (active) setError(searchError instanceof Error ? searchError.message : "Search is unavailable.");
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, session.user.id]);

  const matchingVibes = useMemo(() => VIBES.filter((vibe) =>
    !hardMutedVibes.includes(vibe) && vibe.toLowerCase().includes(query.trim().toLowerCase()),
  ), [hardMutedVibes, query]);
  const visibleVibes = VIBES.filter((vibe) => !hardMutedVibes.includes(vibe));
  const visibleRooms = rooms.filter((room) => !hardMutedVibes.includes(room.vibe_tag));
  const visiblePosts = posts.filter((post) =>
    !hardMutedVibes.includes(post.vibe_tag) &&
    (tab === "Photos" ? post.media_type === "photo" : tab === "Videos" ? post.media_type !== "photo" : tab === "Sounds" ? post.audio_attribution.toLowerCase().includes(query.trim().toLowerCase()) : true),
  );
  const visibleCreators = creators.filter((creator) => tab === "Top" || tab === "Creators");

  async function remember(term: string) {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...recents.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
    setRecents(next);
    try {
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch (storageError) {
      Alert.alert("Search history not saved", storageError instanceof Error ? storageError.message : "Please try again.");
    }
  }

  async function clearRecents() {
    try {
      await AsyncStorage.removeItem(RECENTS_KEY);
      setRecents([]);
    } catch (storageError) {
      Alert.alert("Could not clear search history", storageError instanceof Error ? storageError.message : "Please try again.");
    }
  }

  const hasResults =
    ((tab === "Top" || tab === "Videos" || tab === "Photos" || tab === "Sounds") && visiblePosts.length > 0) ||
    ((tab === "Top" || tab === "Creators") && visibleCreators.length > 0) ||
    ((tab === "Top" || tab === "Vibes") && matchingVibes.length > 0) ||
    ((tab === "Top" || tab === "Live") && visibleRooms.length > 0);
  const termEntered = query.trim().length >= 2;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.back}><Ionicons name="chevron-back" size={25} color={colors.text} /></Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search videos, vibes, creators, sounds"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => void remember(query)}
          />
          {query ? <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
      </View>
      {!termEntered ? (
        <ScrollView contentContainerStyle={styles.discovery}>
          {recents.length ? (
            <View style={styles.group}>
              <View style={styles.groupHeading}><Text style={styles.heading}>Recent searches</Text><Pressable onPress={() => void clearRecents()}><Text style={styles.clear}>Clear</Text></Pressable></View>
              {recents.map((item) => <Pressable key={item} style={styles.suggestion} onPress={() => { setQuery(item); void remember(item); }}><Ionicons name="time-outline" size={17} color={colors.muted} /><Text style={styles.suggestionText}>{item}</Text><Ionicons name="arrow-up-left-box" size={16} color={colors.muted} /></Pressable>)}
            </View>
          ) : null}
          <View style={styles.group}>
            <Text style={styles.heading}>Trending searches</Text>
            {trending.map((item, index) => <Pressable key={item} style={styles.suggestion} onPress={() => { setQuery(item); void remember(item); }}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.suggestionText}>{item}</Text><Ionicons name="trending-up-outline" size={17} color={colors.mint} /></Pressable>)}
          </View>
          <View style={styles.group}>
            <Text style={styles.heading}>Explore vibes</Text>
            <View style={styles.vibes}>{visibleVibes.slice(0, 12).map((vibe) => <VibeChip key={vibe} vibe={vibe} compact onPress={() => { setQuery(vibe); setTab("Vibes"); }} />)}</View>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {SEARCH_TABS.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></Pressable>)}
          </ScrollView>
          {loading ? <EmptyState title="Searching…" body="Finding matching posts and creators." /> : error ? <EmptyState title="Search unavailable" body={error} action={<Button onPress={() => setQuery(`${query} `)}>Try again</Button>} /> : !hasResults ? <EmptyState title="No results yet" body="Try another search or explore a different vibe." /> : (
            <ScrollView contentContainerStyle={styles.results}>
              {(tab === "Top" || tab === "Videos" || tab === "Photos" || tab === "Sounds") && visiblePosts.length ? (
                <View style={styles.group}><Text style={styles.heading}>{tab === "Sounds" ? "Sounds" : "Posts"}</Text>{visiblePosts.map((post) => <SearchPost key={post.id} post={post} onSelect={() => { void remember(query); onOpenPost(post.id); }} />)}</View>
              ) : null}
              {(tab === "Top" || tab === "Creators") && visibleCreators.length ? (
                <View style={styles.group}><Text style={styles.heading}>Creators</Text>{visibleCreators.map((creator) => <Pressable key={creator.id} onPress={() => onOpenCreator(creator.username)} style={styles.creator}><Avatar uri={creator.avatar_url} label={creator.display_name || creator.username} size={44} /><View style={styles.creatorText}><Text style={styles.creatorName}>{creator.display_name || creator.username}</Text><Text style={styles.creatorHandle}>@{creator.username} · {creator.vibe_tags.slice(0, 2).join(" · ")}</Text></View></Pressable>)}</View>
              ) : null}
              {(tab === "Top" || tab === "Vibes") && matchingVibes.length ? (
                <View style={styles.group}><Text style={styles.heading}>Vibes</Text><View style={styles.vibes}>{matchingVibes.map((vibe) => <VibeChip key={vibe} vibe={vibe} compact onPress={() => { setActiveVibe(vibe); void remember(query); }} />)}</View></View>
              ) : null}
              {(tab === "Top" || tab === "Live") && visibleRooms.length ? (
                <View style={styles.group}><Text style={styles.heading}>Live now</Text>{visibleRooms.map((room) => <View key={room.id} style={styles.live}><Text style={styles.liveBadge}>LIVE</Text><View style={styles.creatorText}><Text style={styles.creatorName}>{room.title}</Text><Text style={styles.creatorHandle}>{room.vibe_tag} · {room.viewer_count} watching</Text></View></View>)}</View>
              ) : null}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

function SearchPost({ post, onSelect }: { post: SearchablePost; onSelect: () => void }) {
  const image = post.media_type === "photo" ? post.media_urls?.[0] : null;
  return (
    <Pressable style={styles.post} onPress={onSelect}>
      {image ? <Image source={{ uri: image }} style={styles.postImage} /> : <View style={styles.postPlaceholder}><Ionicons name="play" size={20} color={colors.text} /></View>}
      <View style={styles.postText}><Text numberOfLines={2} style={styles.postCaption}>{post.audio_attribution || post.caption || `${post.vibe_tag} ${post.media_type}`}</Text><Text style={styles.postMeta}>#{post.genre_tag} · {post.vibe_tag} · {post.view_count.toLocaleString()} views</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8 },
  back: { width: 30, alignItems: "center" },
  searchBox: { flex: 1, height: 45, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.panel },
  input: { flex: 1, color: colors.text, fontSize: 13, paddingVertical: 0 },
  discovery: { padding: 17, gap: 23, paddingBottom: 30 },
  results: { paddingHorizontal: 17, gap: 22, paddingBottom: 30 },
  group: { gap: 9 },
  groupHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { color: colors.text, fontSize: 15, fontWeight: "800" },
  clear: { color: colors.mint, fontSize: 12, fontWeight: "700" },
  suggestion: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  suggestionText: { flex: 1, color: colors.text, fontSize: 13 },
  rank: { width: 18, color: colors.mint, fontSize: 12, fontWeight: "800" },
  vibes: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tabs: { gap: 8, paddingHorizontal: 15, paddingVertical: 8 },
  tab: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.panel },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: colors.text },
  creator: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  creatorText: { flex: 1, gap: 3 },
  creatorName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  creatorHandle: { color: colors.muted, fontSize: 11 },
  live: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 14, backgroundColor: colors.panel },
  liveBadge: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", backgroundColor: "#E11D48", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  post: { flexDirection: "row", alignItems: "center", gap: 10 },
  postImage: { width: 65, height: 70, borderRadius: 9 },
  postPlaceholder: { width: 65, height: 70, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#30213D" },
  postText: { flex: 1, gap: 5 },
  postCaption: { color: colors.text, fontSize: 13, fontWeight: "700" },
  postMeta: { color: colors.muted, fontSize: 10 },
});
