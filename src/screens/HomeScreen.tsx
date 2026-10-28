import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Session } from "@supabase/supabase-js";

import { Button, colors, EmptyState, VibeChip } from "../components/ui";
import { PostActions } from "../components/PostActions";
import { PostSheets } from "../components/PostSheets";
import { VIBES, VIBE_THEMES, type VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";
import { useAppStore } from "../store/appStore";
import type { FeedVideo, UserProfile } from "../types/app";

const viewportHeight = Dimensions.get("window").height - 180;
const viewabilityConfig = { itemVisiblePercentThreshold: 70 };

export function HomeScreen({
  session,
  profile,
  deepLinkPostId,
  onDeepLinkHandled,
}: {
  session: Session;
  profile: UserProfile;
  deepLinkPostId?: string;
  onDeepLinkHandled: () => void;
}) {
  const globalVibe = useAppStore((state) => state.activeVibeRoom);
  const setGlobalVibe = useAppStore((state) => state.setActiveVibeRoom);
  const autoplay = useAppStore((state) => state.settings.autoplay);
  const [vibe, setVibe] = useState<VibeName>(globalVibe);
  const [posts, setPosts] = useState<FeedVideo[]>([]);
  const [pinnedPost, setPinnedPost] = useState<FeedVideo | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ post: FeedVideo; type: "comments" | "share" | "more" | "report" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewedIds = useRef(new Set<string>());
  const cursor = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const generation = useRef(0);
  const handledDeepLinkId = useRef<string | null>(null);

  const loadFeed = useCallback(async (append = false) => {
    if (append && (!cursor.current || loadingMoreRef.current)) return;
    if (!append) generation.current += 1;
    const requestId = generation.current;
    if (append) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    setError(null);
    try {
      const { data, error: feedError } = await supabase.rpc("get_vibe_feed", {
        p_vibe_tag: vibe,
        p_limit: 30,
        p_before: append ? cursor.current : null,
      });
      if (feedError) throw feedError;
      if (requestId !== generation.current) return;
      let page = (data ?? []) as FeedVideo[];
      if (!append && deepLinkPostId && handledDeepLinkId.current !== deepLinkPostId) {
        const { data: target, error: targetError } = await supabase.from("videos")
          .select("id, user_id, optimized_url, media_urls, media_type, visibility, allow_comments, allow_sharing, cover_url, text_overlay, caption, genre_tag, vibe_tag, audio_attribution, duration_ms, view_count, like_count, created_at")
          .eq("id", deepLinkPostId)
          .single();
        if (targetError) throw targetError;
        if (target.vibe_tag !== vibe) {
          if (!VIBES.includes(target.vibe_tag as VibeName)) throw new Error("This post has an unsupported vibe tag.");
          setVibe(target.vibe_tag as VibeName);
          return;
        }
        const { data: creator, error: creatorError } = await supabase.from("users")
          .select("username, display_name, avatar_url")
          .eq("id", target.user_id)
          .single();
        if (creatorError) throw creatorError;
        const targetPost = {
          ...target,
          username: creator.username,
          display_name: creator.display_name,
          avatar_url: creator.avatar_url,
        } as FeedVideo;
        setPinnedPost(targetPost);
        handledDeepLinkId.current = deepLinkPostId;
        if (!page.some((post) => post.id === targetPost.id)) page = [targetPost, ...page];
        onDeepLinkHandled();
      }
      if (!append && pinnedPost?.vibe_tag === vibe && !page.some((post) => post.id === pinnedPost.id)) {
        page = [pinnedPost, ...page];
      }
      cursor.current = page[page.length - 1]?.created_at ?? null;
      if (append) setPosts((current) => [...current, ...page]);
      else {
        setPosts(page);
        setActiveId(page[0]?.id ?? null);
        viewedIds.current.clear();
      }

      const ids = page.map((post) => post.id);
      if (ids.length) {
        const [likesResult, savedResult, commentsResult] = await Promise.all([
          supabase.from("engagements").select("video_id").eq("user_id", session.user.id).eq("event_type", "like").in("video_id", ids),
          supabase.from("saved_posts").select("video_id").eq("user_id", session.user.id).in("video_id", ids),
          supabase.from("comments").select("video_id").in("video_id", ids),
        ]);
        if (likesResult.error) throw likesResult.error;
        if (savedResult.error) throw savedResult.error;
        if (commentsResult.error) throw commentsResult.error;
        const likes = (likesResult.data ?? []).map((item) => item.video_id);
        const saved = (savedResult.data ?? []).map((item) => item.video_id);
        const counts: Record<string, number> = {};
        for (const comment of commentsResult.data ?? []) counts[comment.video_id] = (counts[comment.video_id] ?? 0) + 1;
        setLikedIds((current) => append ? new Set([...current, ...likes]) : new Set(likes));
        setSavedIds((current) => append ? new Set([...current, ...saved]) : new Set(saved));
        setCommentCounts((current) => append ? { ...current, ...counts } : counts);
      } else if (!append) {
        setLikedIds(new Set());
        setSavedIds(new Set());
        setCommentCounts({});
      }
    } catch (loadError) {
      if (requestId === generation.current) {
        setError(loadError instanceof Error ? loadError.message : "The Vibe Room could not be loaded.");
        if (!append) setPosts([]);
      }
    } finally {
      if (append) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      } else {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [deepLinkPostId, onDeepLinkHandled, session.user.id, vibe]);

  useEffect(() => {
    cursor.current = null;
    setGlobalVibe(vibe);
    setLoading(true);
    void loadFeed(false);
  }, [loadFeed, setGlobalVibe, vibe]);

  useEffect(() => {
    if (!profile.hard_muted_vibes.includes(vibe)) return;
    const nextVibe = VIBES.find((item) => !profile.hard_muted_vibes.includes(item));
    if (nextVibe) setVibe(nextVibe);
  }, [profile.hard_muted_vibes, vibe]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.find((item) => item.isViewable);
    if (visible?.item) setActiveId((visible.item as FeedVideo).id);
  }, []);

  useEffect(() => {
    if (!activeId || viewedIds.current.has(activeId)) return;
    viewedIds.current.add(activeId);
    void supabase.rpc("record_video_engagement", {
      p_video_id: activeId,
      p_event_type: "view",
      p_watch_time_ms: 0,
      p_completed: false,
    }).then(({ error: recordError }) => {
      if (recordError) Alert.alert("View wasn’t recorded", recordError.message);
    });
  }, [activeId]);

  async function toggleLike(post: FeedVideo) {
    const liked = likedIds.has(post.id);
    try {
      const { error } = liked
        ? await supabase.rpc("remove_video_like", { p_video_id: post.id })
        : await supabase.rpc("record_video_engagement", {
            p_video_id: post.id,
            p_event_type: "like",
            p_watch_time_ms: 0,
            p_completed: false,
          });
      if (error) throw error;
      setLikedIds((current) => {
        const next = new Set(current);
        if (liked) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setPosts((current) => current.map((item) =>
        item.id === post.id ? { ...item, like_count: Math.max(0, item.like_count + (liked ? -1 : 1)) } : item,
      ));
      if (!liked) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert("Could not update like", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function toggleSave(post: FeedVideo) {
    const saved = savedIds.has(post.id);
    try {
      const result = saved
        ? await supabase.from("saved_posts").delete().eq("user_id", session.user.id).eq("video_id", post.id)
        : await supabase.from("saved_posts").insert({ user_id: session.user.id, video_id: post.id });
      if (result.error) throw result.error;
      setSavedIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      void Haptics.selectionAsync();
    } catch (error) {
      Alert.alert("Could not update saved posts", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function followCreator(post: FeedVideo) {
    const { error } = await supabase.from("vibe_followers").insert({
      follower_id: session.user.id,
      followed_id: post.user_id,
      source_vibe: post.vibe_tag,
    });
    if (error?.code === "23505") Alert.alert("Already following", `You already follow @${post.username}.`);
    else if (error) Alert.alert("Could not follow creator", error.message);
    else Alert.alert("Following", `You’re now following @${post.username}.`);
  }

  const openSheet = useCallback((post: FeedVideo, type: "comments" | "share" | "more" | "report") => {
    setSheet({ post, type });
  }, []);

  const visibleVibes = useMemo(() => VIBES.filter((item) => !profile.hard_muted_vibes.includes(item)), [profile.hard_muted_vibes]);

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.heading}>
          <Text style={styles.wordmark}>vibed</Text>
          <Text style={styles.greeting}>Hi, {profile.display_name || profile.username}</Text>
        </View>
        <Text style={styles.dialLabel}>VIBE DIAL</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {visibleVibes.map((item) => (
            <VibeChip key={item} vibe={item} active={item === vibe} onPress={() => setVibe(item)} />
          ))}
        </ScrollView>
      </View>
      {error ? (
        <EmptyState title="Vibe Room unavailable" body={error} action={<Button onPress={() => void loadFeed(false)}>Retry</Button>} />
      ) : loading ? (
        <EmptyState title="Tuning into your vibe…" body="Finding videos from your community." />
      ) : posts.length === 0 ? (
        <EmptyState title={`The ${vibe} room is quiet`} body="Be the first to post something with this vibe." />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.mint} onRefresh={() => { cursor.current = null; setRefreshing(true); void loadFeed(false); }} />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => void loadFeed(true)}
          onEndReachedThreshold={0.45}
          ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>Finding more of your vibe…</Text> : null}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              active={item.id === activeId}
              autoplay={autoplay}
              liked={likedIds.has(item.id)}
              saved={savedIds.has(item.id)}
              commentCount={commentCounts[item.id] ?? 0}
              onLike={() => void toggleLike(item)}
              onSave={() => void toggleSave(item)}
              onFollow={() => void followCreator(item)}
              onComments={() => openSheet(item, "comments")}
              onShare={() => openSheet(item, "share")}
              sharingAllowed={item.allow_sharing !== false}
              commentsAllowed={item.allow_comments !== false}
              onMore={() => openSheet(item, "more")}
              onReport={() => openSheet(item, "report")}
            />
          )}
        />
      )}
      {sheet ? (
        <PostSheets
          session={session}
          post={sheet.post}
          initialSheet={sheet.type}
          onNotInterested={() => {
            setPosts((current) => current.filter((post) => post.id !== sheet.post.id));
            setPinnedPost((current) => current?.id === sheet.post.id ? null : current);
          }}
          onClose={() => {
            const postId = sheet.post.id;
            setSheet(null);
            void supabase.from("comments").select("id", { count: "exact", head: true }).eq("video_id", postId)
              .then(({ count, error }) => {
                if (error) Alert.alert("Could not refresh comment count", error.message);
                else setCommentCounts((current) => ({ ...current, [postId]: count ?? 0 }));
              });
          }}
        />
      ) : null}
    </View>
  );
}

function PostCard({
  post,
  active,
  autoplay,
  liked,
  saved,
  commentCount,
  onLike,
  onSave,
  onFollow,
  onComments,
  onShare,
  onMore,
  onReport,
  sharingAllowed,
  commentsAllowed,
}: {
  post: FeedVideo;
  active: boolean;
  autoplay: boolean;
  liked: boolean;
  saved: boolean;
  commentCount: number;
  onLike: () => void;
  onSave: () => void;
  onFollow: () => void;
  onComments: () => void;
  onShare: () => void;
  onMore: () => void;
  onReport: () => void;
  sharingAllowed: boolean;
  commentsAllowed: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const mediaUrls = post.media_urls?.length ? post.media_urls : post.optimized_url ? [post.optimized_url] : [];
  const accent = VIBE_THEMES[post.vibe_tag]?.accent ?? colors.accent;
  const isPhoto = post.media_type === "photo";

  function tapMedia() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      onLike();
      setPaused(false);
      heartScale.setValue(0);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 12 }),
        Animated.delay(450),
        Animated.timing(heartScale, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    if (!isPhoto) setPaused((value) => !value);
  }

  return (
    <View style={[styles.card, { height: viewportHeight }]}>
      <Pressable onPress={tapMedia} style={StyleSheet.absoluteFill}>
        {isPhoto ? (
          <FlatList
            data={mediaUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, index) => `${url}-${index}`}
            onMomentumScrollEnd={(event) => {
              const width = event.nativeEvent.layoutMeasurement.width;
              setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
            renderItem={({ item }) => <Image source={{ uri: item }} style={styles.media} resizeMode="cover" />}
          />
        ) : post.optimized_url ? (
          <VideoMedia uri={post.optimized_url} active={active} autoplay={autoplay} paused={paused} />
        ) : null}
      </Pressable>
      <View pointerEvents="none" style={styles.scrim} />
      <Animated.View pointerEvents="none" style={[styles.heartOverlay, { transform: [{ scale: heartScale }] }]}>
        <Ionicons name="heart" size={88} color="#FFFFFF" />
      </Animated.View>
      {post.text_overlay ? <Text pointerEvents="none" style={styles.textOverlay}>{post.text_overlay}</Text> : null}
      {!isPhoto && paused ? (
        <View pointerEvents="none" style={styles.pauseOverlay}>
          <Ionicons name="play" size={38} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={styles.bottom}>
          <View style={styles.details}>
            <Text style={styles.creator}>{post.display_name || post.username} <Text style={styles.handle}>@{post.username}</Text></Text>
            <Text style={styles.caption}>{post.caption}</Text>
            <Text style={styles.audio}>♫ {post.audio_attribution || `Original Audio by @${post.username}`}</Text>
            {isPhoto && mediaUrls.length > 1 ? <Text style={styles.photoCount}>{photoIndex + 1} / {mediaUrls.length}</Text> : null}
          </View>
          <PostActions
            avatarUrl={post.avatar_url}
            creatorName={post.display_name || post.username}
            liked={liked}
            saved={saved}
            likeCount={post.like_count}
            commentCount={commentCount}
            accent={accent}
            onFollow={onFollow}
            onLike={onLike}
            onComment={onComments}
            onShare={onShare}
            onSave={onSave}
            onMore={onMore}
            sharingAllowed={sharingAllowed}
            commentsAllowed={commentsAllowed}
          />
        </View>
      </View>
    </View>
  );
}

function VideoMedia({ uri, active, autoplay, paused }: { uri: string; active: boolean; autoplay: boolean; paused: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    if (active && autoplay && !paused) player.play();
    else player.pause();
  }, [active, autoplay, paused, player]);

  return <VideoView style={styles.media} player={player} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingTop: 4, paddingBottom: 8, backgroundColor: colors.background },
  heading: { paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 35 },
  wordmark: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -1 },
  greeting: { color: colors.muted, fontSize: 12 },
  dialLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.8, paddingHorizontal: 18, paddingTop: 3 },
  chips: { gap: 8, paddingHorizontal: 15, paddingVertical: 8 },
  card: { marginHorizontal: 8, marginBottom: 5, overflow: "hidden", borderRadius: 22, backgroundColor: colors.panel },
  media: { width: Dimensions.get("window").width - 16, height: "100%" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  heartOverlay: { position: "absolute", left: "40%", top: "38%", shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 12 },
  textOverlay: { position: "absolute", left: 28, right: 80, top: "38%", color: "#FFFFFF", fontSize: 22, fontWeight: "900", textAlign: "center", textShadowColor: "#000000", textShadowRadius: 6 },
  pauseOverlay: { position: "absolute", left: "44%", top: "42%", width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  content: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", paddingHorizontal: 15, paddingBottom: 16 },
  bottom: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  details: { flex: 1, gap: 8, paddingBottom: 8 },
  creator: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textShadowColor: "#000000", textShadowRadius: 4 },
  handle: { color: "#E4E4E7", fontSize: 12, fontWeight: "500" },
  caption: { color: "#FFFFFF", fontSize: 14, lineHeight: 20, textShadowColor: "#000000", textShadowRadius: 4 },
  audio: { color: "#FFFFFF", fontSize: 12, fontWeight: "600", textShadowColor: "#000000", textShadowRadius: 4 },
  photoCount: { color: "#FFFFFF", fontSize: 11 },
  loadingMore: { color: colors.muted, textAlign: "center", paddingVertical: 16 },
});
