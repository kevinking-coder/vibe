import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { Platform } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState } from "../components/ui";
import { VIBE_THEMES, type VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";
import type { FeedVideo, UserProfile } from "../types/app";

const knownVibes = Object.keys(VIBE_THEMES) as VibeName[];
const viewportHeight = Dimensions.get("window").height - 175;
const viewabilityConfig = { itemVisiblePercentThreshold: 70 };

export function HomeScreen({
  session,
  profile,
}: {
  session: Session;
  profile: UserProfile;
}) {
  const firstVibe = profile.vibe_tags.find((vibe): vibe is VibeName =>
    knownVibes.includes(vibe as VibeName),
  ) ?? "Chill";
  const [vibe, setVibe] = useState<VibeName>(firstVibe);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentVideo, setCommentVideo] = useState<FeedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewedIds = useRef(new Set<string>());
  const cursor = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const feedGeneration = useRef(0);

  const loadFeed = useCallback(async (append = false) => {
    if (append && (!cursor.current || loadingMoreRef.current)) return;
    if (!append) feedGeneration.current += 1;
    const generation = feedGeneration.current;
    setError(null);
    if (append) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const { data, error: feedError } = await supabase.rpc("get_vibe_feed", {
        p_vibe_tag: vibe,
        p_limit: 30,
        p_before: append ? cursor.current : null,
      });
      if (feedError) throw feedError;
      if (generation !== feedGeneration.current) return;
      const items = (data ?? []) as FeedVideo[];
      const lastItem = items[items.length - 1];
      cursor.current = lastItem?.created_at ?? null;
      if (append) {
        setVideos((current) => [...current, ...items]);
      } else {
        setVideos(items);
        setActiveId(items[0]?.id ?? null);
        viewedIds.current.clear();
      }
      if (items.length) {
        const { data: likes, error: likeError } = await supabase
          .from("engagements")
          .select("video_id")
          .eq("user_id", session.user.id)
          .eq("event_type", "like")
          .in("video_id", items.map((item) => item.id));
        if (likeError) throw likeError;
        setLikedIds((current) =>
          append
            ? new Set([...current, ...(likes ?? []).map((item) => item.video_id)])
            : new Set((likes ?? []).map((item) => item.video_id)),
        );
      } else if (!append) {
        setLikedIds(new Set());
      }
    } catch (loadError) {
      if (generation === feedGeneration.current) {
        setError(loadError instanceof Error ? loadError.message : "The feed could not be loaded.");
        if (!append) setVideos([]);
      }
    } finally {
      if (append) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
      else {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [session.user.id, vibe]);

  useEffect(() => {
    cursor.current = null;
    setLoading(true);
    void loadFeed();
  }, [loadFeed]);

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

  const availableVibes = useMemo(() => {
    const followedVibes = profile.vibe_tags.filter((item): item is VibeName =>
      knownVibes.includes(item as VibeName),
    );
    return followedVibes.length ? followedVibes : knownVibes;
  }, [profile.vibe_tags]);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visible = viewableItems.find((item) => item.isViewable);
      if (visible?.item) setActiveId((visible.item as FeedVideo).id);
    },
    [],
  );

  async function toggleLike(video: FeedVideo) {
    const liked = likedIds.has(video.id);
    try {
      if (liked) {
        const { error: unlikeError } = await supabase.rpc("remove_video_like", {
          p_video_id: video.id,
        });
        if (unlikeError) throw unlikeError;
      } else {
        const { error: likeError } = await supabase.rpc("record_video_engagement", {
          p_video_id: video.id,
          p_event_type: "like",
          p_watch_time_ms: 0,
          p_completed: false,
        });
        if (likeError) throw likeError;
      }
      setLikedIds((current) => {
        const next = new Set(current);
        if (liked) next.delete(video.id);
        else next.add(video.id);
        return next;
      });
      setVideos((current) =>
        current.map((item) =>
          item.id === video.id
            ? { ...item, like_count: Math.max(0, item.like_count + (liked ? -1 : 1)) }
            : item,
        ),
      );
    } catch (likeError) {
      Alert.alert("Could not update like", likeError instanceof Error ? likeError.message : "Please try again.");
    }
  }

  function reportVideo(video: FeedVideo) {
    Alert.alert("Report this video", "Choose a reason. Reports are reviewed by the Vibed team.", [
      ...(["mis_tagged", "harassment", "spam", "unsafe", "other"] as const).map((reason) => ({
        text: reason.replace("_", " "),
        onPress: () => {
          void supabase.from("reported_content").insert({
            reporter_id: session.user.id,
            video_id: video.id,
            reason,
          }).then(({ error: reportError }) => {
            if (reportError) Alert.alert("Report failed", reportError.message);
            else Alert.alert("Thanks", "Your report has been submitted.");
          });
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>vibed</Text>
        <Text style={styles.greeting}>For you, {profile.display_name || profile.username}</Text>
      </View>
      <View style={styles.vibes}>
        {availableVibes.map((item) => {
          const active = item === vibe;
          return (
            <Pressable
              key={item}
              onPress={() => setVibe(item)}
              style={[
                styles.vibePill,
                active && { backgroundColor: `${VIBE_THEMES[item].accent}25`, borderColor: VIBE_THEMES[item].accent },
              ]}
            >
              <Text style={[styles.vibeText, active && { color: VIBE_THEMES[item].accent }]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <EmptyState title="Feed unavailable" body={error} action={<Button onPress={() => void loadFeed(false)}>Try again</Button>} />
      ) : loading ? (
        <EmptyState title="Finding your vibe…" body="Loading videos from your community." />
      ) : videos.length === 0 ? (
        <EmptyState
          title={`No ${vibe.toLowerCase()} videos yet`}
          body="Be the first to post something for this vibe. Or try another room."
          action={<Button onPress={() => setVibe(knownVibes[(knownVibes.indexOf(vibe) + 1) % knownVibes.length])}>Explore another vibe</Button>}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.mint} onRefresh={() => { cursor.current = null; setRefreshing(true); void loadFeed(false); }} />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => void loadFeed(true)}
          onEndReachedThreshold={0.45}
          ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>Loading more videos…</Text> : null}
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              active={item.id === activeId}
              liked={likedIds.has(item.id)}
              onLike={() => void toggleLike(item)}
              onReport={() => reportVideo(item)}
              onComments={() => setCommentVideo(item)}
            />
          )}
        />
      )}
      <Modal
        visible={commentVideo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentVideo(null)}
      >
        {commentVideo ? (
          <CommentsSheet
            session={session}
            video={commentVideo}
            onClose={() => setCommentVideo(null)}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function VideoCard({
  video,
  active,
  liked,
  onLike,
  onReport,
  onComments,
}: {
  video: FeedVideo;
  active: boolean;
  liked: boolean;
  onLike: () => void;
  onReport: () => void;
  onComments: () => void;
}) {
  const player = useVideoPlayer(video.optimized_url, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <View style={styles.card}>
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.videoContent}>
        <View style={styles.creator}>
          <Avatar uri={video.avatar_url} label={video.display_name || video.username} size={38} />
          <View style={styles.creatorText}>
            <Text style={styles.creatorName}>{video.display_name || video.username}</Text>
            <Text style={styles.creatorHandle}>@{video.username} · {video.vibe_tag}</Text>
          </View>
        </View>
        <Text numberOfLines={3} style={styles.caption}>{video.caption || " "}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.audio}>
            <Text style={styles.audioText}>♫ {video.audio_attribution || "Original audio"}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityLabel={liked ? "Unlike video" : "Like video"} onPress={onLike} style={styles.action}>
              <Text style={[styles.actionIcon, liked && styles.liked]}>{liked ? "♥" : "♡"}</Text>
              <Text style={styles.actionLabel}>{video.like_count}</Text>
            </Pressable>
            <View style={styles.action}>
              <Text style={styles.actionIcon}>◉</Text>
              <Text style={styles.actionLabel}>{video.view_count}</Text>
            </View>
            <Pressable accessibilityLabel="View comments" onPress={onComments} style={styles.action}>
              <Text style={styles.actionIcon}>▱</Text>
              <Text style={styles.actionLabel}>Comment</Text>
            </Pressable>
            <Pressable accessibilityLabel="Report video" onPress={onReport} style={styles.action}>
              <Text style={styles.actionIcon}>•••</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

type StoredComment = { id: string; user_id: string; body: string; created_at: string };
type Comment = StoredComment & { username: string; display_name: string; avatar_url: string | null };
type CommentUser = { id: string; username: string; display_name: string; avatar_url: string | null };

function CommentsSheet({
  session,
  video,
  onClose,
}: {
  session: Session;
  video: FeedVideo;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setError(null);
    try {
      const { data, error: commentsError } = await supabase
        .from("comments")
        .select("id, user_id, body, created_at")
        .eq("video_id", video.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (commentsError) throw commentsError;
      const stored = (data ?? []) as StoredComment[];
      const userIds = [...new Set(stored.map((comment) => comment.user_id))];
      let users: CommentUser[] = [];
      if (userIds.length) {
        const { data: userData, error: usersError } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);
        if (usersError) throw usersError;
        users = (userData ?? []) as CommentUser[];
      }
      const byId = new Map(users.map((user) => [user.id, user]));
      setComments(
        stored.map((comment) => {
          const user = byId.get(comment.user_id);
          return {
            ...comment,
            username: user?.username ?? "vibed_user",
            display_name: user?.display_name ?? "Vibed user",
            avatar_url: user?.avatar_url ?? null,
          };
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Comments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [video.id]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function sendComment() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { error: insertError } = await supabase.from("comments").insert({
        video_id: video.id,
        user_id: session.user.id,
        body: text,
      });
      if (insertError) throw insertError;
      setBody("");
      await loadComments();
    } catch (sendError) {
      Alert.alert("Comment not posted", sendError instanceof Error ? sendError.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.modalScrim}>
      <KeyboardAvoidingView
        style={styles.commentsSheet}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.commentsHeader}>
          <View>
            <Text style={styles.commentsTitle}>Comments</Text>
            <Text style={styles.commentsSubtitle}>@{video.username} · {video.vibe_tag}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close comments">
            <Text style={styles.closeComments}>Done</Text>
          </Pressable>
        </View>
        {error ? (
          <View style={styles.commentsEmpty}>
            <Text style={styles.commentsError}>{error}</Text>
            <Pressable onPress={() => void loadComments()}><Text style={styles.closeComments}>Try again</Text></Pressable>
          </View>
        ) : loading ? (
          <View style={styles.commentsEmpty}><Text style={styles.commentsSubtitle}>Loading comments…</Text></View>
        ) : comments.length === 0 ? (
          <View style={styles.commentsEmpty}>
            <Text style={styles.commentsTitle}>Start the conversation</Text>
            <Text style={styles.commentsSubtitle}>Be the first to share a thought.</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Avatar uri={item.avatar_url} label={item.display_name || item.username} size={36} />
                <View style={styles.commentBody}>
                  <Text style={styles.commentName}>{item.display_name || item.username} <Text style={styles.commentHandle}>@{item.username}</Text></Text>
                  <Text style={styles.commentText}>{item.body}</Text>
                  <Text style={styles.commentTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
            )}
          />
        )}
        <View style={styles.commentComposer}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Add a comment…"
            placeholderTextColor={colors.muted}
            maxLength={1000}
            multiline
            style={styles.commentInput}
          />
          <Pressable
            onPress={() => void sendComment()}
            disabled={!body.trim() || sending}
            style={[styles.commentSend, (!body.trim() || sending) && styles.commentSendDisabled]}
          >
            <Text style={styles.commentSendText}>{sending ? "…" : "Post"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { height: 48, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -1 },
  greeting: { color: colors.muted, fontSize: 13, maxWidth: "68%" },
  vibes: { height: 52, flexDirection: "row", gap: 8, paddingHorizontal: 16, alignItems: "center" },
  vibePill: { paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.panel },
  vibeText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  card: { height: viewportHeight, marginHorizontal: 10, marginBottom: 8, overflow: "hidden", borderRadius: 22, backgroundColor: colors.panel },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  videoContent: { flex: 1, justifyContent: "flex-end", padding: 18 },
  creator: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  creatorText: { flex: 1 },
  creatorName: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  creatorHandle: { color: "#E4E4E7", fontSize: 12, marginTop: 2 },
  caption: { maxWidth: "82%", color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "600", marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  audio: { flex: 1, paddingRight: 8 },
  audioText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  actions: { gap: 12, alignItems: "center" },
  action: { minWidth: 34, alignItems: "center", gap: 2 },
  actionIcon: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  liked: { color: "#FB7185" },
  actionLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  modalScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  commentsSheet: { height: "82%", paddingTop: 19, paddingHorizontal: 16, paddingBottom: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background },
  commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottomWidth: 1, borderColor: colors.border },
  commentsTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  commentsSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  closeComments: { color: colors.mint, fontSize: 14, fontWeight: "700", padding: 8 },
  commentsEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  commentsError: { color: "#FCA5A5", textAlign: "center" },
  commentsList: { gap: 16, paddingVertical: 16 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  commentBody: { flex: 1, gap: 4 },
  commentName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  commentHandle: { color: colors.muted, fontSize: 11, fontWeight: "400" },
  commentText: { color: "#E4E4E7", fontSize: 14, lineHeight: 20 },
  commentTime: { color: colors.muted, fontSize: 10 },
  commentComposer: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  commentInput: { flex: 1, maxHeight: 100, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 16, color: colors.text, backgroundColor: colors.panel, fontSize: 14 },
  commentSend: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.accent },
  commentSendDisabled: { opacity: 0.45 },
  commentSendText: { color: colors.text, fontWeight: "800" },
  loadingMore: { color: colors.muted, textAlign: "center", paddingVertical: 16 },
});
