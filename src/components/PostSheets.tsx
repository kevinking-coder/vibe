import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors } from "./ui";
import { BottomSheet } from "./BottomSheet";
import { supabase } from "../services/supabase";
import type { FeedVideo } from "../types/app";

type SheetName = "comments" | "share" | "more" | "report" | null;
type CommentRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  like_count: number;
};
type Contact = { id: string; username: string; display_name: string; avatar_url: string | null };
type ReportReason =
  | "graphic_violent"
  | "hate_harassment"
  | "nudity"
  | "spam_scam"
  | "misinformation"
  | "wrong_vibe_tag"
  | "copyright"
  | "other";

const reasons: { key: ReportReason; label: string }[] = [
  { key: "graphic_violent", label: "Graphic or violent content" },
  { key: "hate_harassment", label: "Hate or harassment" },
  { key: "nudity", label: "Nudity" },
  { key: "spam_scam", label: "Spam or scam" },
  { key: "misinformation", label: "Misinformation" },
  { key: "wrong_vibe_tag", label: "Wrong vibe tag" },
  { key: "copyright", label: "Copyright" },
  { key: "other", label: "Other" },
];

export function PostSheets({
  session,
  post,
  initialSheet,
  onClose,
  onNotInterested,
}: {
  session: Session;
  post: FeedVideo;
  initialSheet: SheetName;
  onClose: () => void;
  onNotInterested: () => void;
}) {
  const [sheet, setSheet] = useState<SheetName>(initialSheet);

  useEffect(() => setSheet(initialSheet), [initialSheet]);

  const link = useMemo(() => `vibed://post/${post.id}`, [post.id]);
  const dismiss = useCallback(() => {
    setSheet(null);
    onClose();
  }, [onClose]);

  return (
    <>
      <BottomSheet visible={sheet === "comments"} onClose={dismiss} height="88%">
        <CommentsPanel session={session} post={post} />
      </BottomSheet>
      <BottomSheet visible={sheet === "share"} onClose={dismiss} height="78%">
        <SharePanel session={session} post={post} link={link} onClose={dismiss} onNotInterested={onNotInterested} onReport={() => setSheet("report")} />
      </BottomSheet>
      <BottomSheet visible={sheet === "more"} onClose={dismiss} height="48%">
        <MorePanel session={session} post={post} link={link} onClose={dismiss} onNotInterested={onNotInterested} onReport={() => setSheet("report")} />
      </BottomSheet>
      <BottomSheet visible={sheet === "report"} onClose={dismiss} height="78%">
        <ReportPanel session={session} post={post} onClose={dismiss} />
      </BottomSheet>
    </>
  );
}

function CommentsPanel({ session, post }: { session: Session; post: FeedVideo }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: raw, error: commentError } = await supabase
        .from("comments")
        .select("id, user_id, parent_id, body, created_at")
        .eq("video_id", post.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (commentError) throw commentError;
      const rows = raw ?? [];
      const ids = [...new Set(rows.map((item) => item.user_id))];
      const commentIds = rows.map((item) => item.id);
      const [usersResult, likesResult] = await Promise.all([
        ids.length
          ? supabase.from("users").select("id, username, display_name, avatar_url").in("id", ids)
          : Promise.resolve({ data: [], error: null }),
        commentIds.length
          ? supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (likesResult.error) throw likesResult.error;
      const users = new Map((usersResult.data ?? []).map((item) => [item.id, item]));
      const likeRows = likesResult.data ?? [];
      setLiked(new Set(likeRows.filter((item) => item.user_id === session.user.id).map((item) => item.comment_id)));
      const counts = new Map<string, number>();
      for (const item of likeRows) counts.set(item.comment_id, (counts.get(item.comment_id) ?? 0) + 1);
      setComments(rows.map((item) => {
        const user = users.get(item.user_id);
        return {
          ...item,
          username: user?.username ?? "vibed_user",
          display_name: user?.display_name ?? "Vibed user",
          avatar_url: user?.avatar_url ?? null,
          like_count: counts.get(item.id) ?? 0,
        };
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Comments could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [post.id, session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (post.allow_comments === false) {
      Alert.alert("Comments are turned off", "The creator does not allow comments on this post.");
      return;
    }
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { error: sendError } = await supabase.from("comments").insert({
        video_id: post.id,
        user_id: session.user.id,
        parent_id: replyTo?.id ?? null,
        body: text,
      });
      if (sendError) throw sendError;
      setBody("");
      setReplyTo(null);
      await load();
    } catch (sendError) {
      Alert.alert("Comment not posted", sendError instanceof Error ? sendError.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function toggleLike(comment: CommentRow) {
    const already = liked.has(comment.id);
    try {
      if (already) {
        const { error } = await supabase.from("comment_likes").delete()
          .eq("user_id", session.user.id).eq("comment_id", comment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_likes").insert({
          user_id: session.user.id,
          comment_id: comment.id,
        });
        if (error) throw error;
      }
      setLiked((current) => {
        const next = new Set(current);
        if (already) next.delete(comment.id);
        else next.add(comment.id);
        return next;
      });
      setComments((current) => current.map((item) =>
        item.id === comment.id ? { ...item, like_count: Math.max(0, item.like_count + (already ? -1 : 1)) } : item,
      ));
      void Haptics.selectionAsync();
    } catch (error) {
      Alert.alert("Could not update comment like", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Comments</Text>
      {post.allow_comments === false ? <Text style={styles.muted}>Comments are turned off for this post.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Loading comments…</Text> : null}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.commentList}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>No comments yet. Start the conversation.</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.comment, item.parent_id && styles.reply]}>
            <Avatar uri={item.avatar_url} label={item.display_name || item.username} size={34} />
            <View style={styles.commentContent}>
              <Text style={styles.commentName}>{item.display_name || item.username} <Text style={styles.handle}>@{item.username}</Text></Text>
              <Text style={styles.commentText}>{item.body}</Text>
              {post.allow_comments === false ? null : <Pressable onPress={() => setReplyTo(item)}><Text style={styles.linkText}>Reply</Text></Pressable>}
            </View>
            <Pressable onPress={() => void toggleLike(item)} style={styles.commentLike}>
              <Ionicons name={liked.has(item.id) ? "heart" : "heart-outline"} size={18} color={liked.has(item.id) ? "#FB7185" : colors.muted} />
              <Text style={styles.handle}>{item.like_count}</Text>
            </Pressable>
          </View>
        )}
      />
      {post.allow_comments === false ? null : (
        <View style={styles.composer}>
          <TextInput value={body} onChangeText={setBody} placeholder={replyTo ? `Reply to ${replyTo.username}…` : "Add a comment…"} placeholderTextColor={colors.muted} maxLength={1000} style={styles.input} />
          <Pressable onPress={() => void send()} disabled={!body.trim() || sending}><Text style={[styles.linkText, !body.trim() && styles.disabled]}>{sending ? "…" : "Post"}</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function SharePanel({
  session,
  post,
  link,
  onClose,
  onNotInterested,
  onReport,
}: {
  session: Session;
  post: FeedVideo;
  link: string;
  onClose: () => void;
  onNotInterested: () => void;
  onReport: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: messages, error } = await supabase.from("messages")
        .select("sender_id, recipient_id")
        .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) {
        Alert.alert("Could not load recent chats", error.message);
        return;
      }
      const ids = [...new Set((messages ?? []).map((message) =>
        message.sender_id === session.user.id ? message.recipient_id : message.sender_id,
      ))];
      if (!ids.length) return;
      const { data, error: usersError } = await supabase.from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      if (usersError) Alert.alert("Could not load recent chats", usersError.message);
      else setContacts((data ?? []) as Contact[]);
    })();

    void supabase.from("saved_posts").select("video_id")
      .eq("user_id", session.user.id).eq("video_id", post.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) Alert.alert("Could not check saved post", error.message);
        else setSaved(Boolean(data));
      });
  }, [post.id, session.user.id]);

  async function copyLink() {
    try {
      await Clipboard.setStringAsync(link);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast("Link copied");
      setTimeout(() => setToast(""), 1800);
    } catch (error) {
      Alert.alert("Could not copy link", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function sendTo(contact: Contact) {
    if (post.allow_sharing === false) {
      Alert.alert("Sharing is turned off", "The creator does not allow this post to be shared.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: session.user.id,
        recipient_id: contact.id,
        body: `Shared a ${post.media_type === "photo" ? "photo" : "video"} · ${link}`,
        shared_video_id: post.id,
        attachment_url: post.media_urls?.[0] ?? post.optimized_url,
        attachment_urls: post.media_urls?.length ? post.media_urls : post.optimized_url ? [post.optimized_url] : [],
        attachment_type: post.media_type ?? "video",
      });
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sent", `Shared with ${contact.display_name || contact.username}.`);
      onClose();
    } catch (error) {
      Alert.alert("Could not share in chat", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function shareTo(target: "WhatsApp" | "Instagram" | "Messenger" | "SMS" | "Telegram" | "More") {
    if (post.allow_sharing === false) {
      Alert.alert("Sharing is turned off", "The creator does not allow this post to be shared.");
      return;
    }
    const message = `Watch this on Vibed: ${link}`;
    if (target === "More") {
      await Share.share({ message, url: link, title: post.caption || "Vibed post" });
      return;
    }
    const urls: Record<typeof target, string> = {
      WhatsApp: `whatsapp://send?text=${encodeURIComponent(message)}`,
      Instagram: `instagram://library?AssetPath=${encodeURIComponent(link)}`,
      Messenger: `fb-messenger://share/?link=${encodeURIComponent(link)}`,
      SMS: `sms:?body=${encodeURIComponent(message)}`,
      Telegram: `tg://msg?text=${encodeURIComponent(message)}`,
    };
    try {
      if (!(await Linking.canOpenURL(urls[target]))) throw new Error("App unavailable");
      await Linking.openURL(urls[target]);
    } catch {
      await Share.share({ message, url: link, title: post.caption || "Vibed post" });
    }
  }

  async function toggleSaved() {
    try {
      const result = saved
        ? await supabase.from("saved_posts").delete().eq("user_id", session.user.id).eq("video_id", post.id)
        : await supabase.from("saved_posts").insert({ user_id: session.user.id, video_id: post.id });
      if (result.error) throw result.error;
      setSaved(!saved);
      void Haptics.selectionAsync();
    } catch (error) {
      Alert.alert("Could not update saved posts", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function saveToDevice() {
    const uri = post.media_urls?.[0] ?? post.optimized_url;
    if (!uri) {
      Alert.alert("Media unavailable", "This post does not have a downloadable media URL.");
      return;
    }
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to save this post to your device.");
      return;
    }
    let downloadUri: string | null = null;
    try {
      if (!FileSystem.cacheDirectory) throw new Error("Temporary storage is unavailable on this device.");
      const cleanUrl = uri.split("?")[0];
      const extension = cleanUrl?.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (post.media_type === "photo" ? "jpg" : "mp4");
      const download = await FileSystem.downloadAsync(uri, `${FileSystem.cacheDirectory}vibed-${Date.now()}.${extension}`);
      downloadUri = download.uri;
      await MediaLibrary.saveToLibraryAsync(download.uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved to device", "The media was added to your photo library.");
    } catch (error) {
      Alert.alert("Could not save media", error instanceof Error ? error.message : "Please try again.");
    } finally {
      if (downloadUri) {
        await FileSystem.deleteAsync(downloadUri, { idempotent: true }).catch((error: unknown) => {
          Alert.alert("Temporary file cleanup failed", error instanceof Error ? error.message : "Remove the file from device storage if needed.");
        });
      }
    }
  }

  async function notInterested() {
    const { data, error } = await supabase.from("user_settings").select("settings").eq("user_id", session.user.id).maybeSingle();
    if (error) {
      Alert.alert("Could not update your feed", error.message);
      return;
    }
    const current = (data?.settings ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(current.notInterestedPostIds) ? current.notInterestedPostIds : [];
    const { error: updateError } = await supabase.from("user_settings").upsert({
      user_id: session.user.id,
      settings: { ...current, notInterestedPostIds: [...new Set([...ids, post.id])] },
    });
    if (updateError) Alert.alert("Could not update your feed", updateError.message);
    else {
      onNotInterested();
      onClose();
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Share post</Text>
      <Text style={styles.muted}>Send to a friend</Text>
      <FlatList
        horizontal
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contactList}
        ListEmptyComponent={<Text style={styles.muted}>Start a chat from Inbox to share directly.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => void sendTo(item)} disabled={busy} style={styles.contactItem}>
            <Avatar uri={item.avatar_url} label={item.display_name || item.username} size={52} />
            <Text numberOfLines={1} style={styles.contactName}>{item.display_name || item.username}</Text>
          </Pressable>
        )}
      />
      <FlatList
        horizontal
        data={["WhatsApp", "Instagram", "Messenger", "SMS", "Telegram", "More"] as const}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.targetList}
        renderItem={({ item }) => (
          <Pressable onPress={() => void shareTo(item)} style={styles.target}>
            <View style={styles.targetIcon}><Ionicons name={item === "More" ? "share-outline" : "send-outline"} size={20} color={colors.mint} /></View>
            <Text style={styles.targetText}>{item}</Text>
          </Pressable>
        )}
      />
      <View style={styles.optionList}>
        <SheetRow icon="copy-outline" label={toast || "Copy link"} onPress={() => void copyLink()} />
        <SheetRow icon="download-outline" label="Save to device" onPress={() => void saveToDevice()} />
        <SheetRow icon={saved ? "bookmark" : "bookmark-outline"} label={saved ? "Remove from favorites" : "Add to favorites"} onPress={() => void toggleSaved()} />
        <SheetRow icon="eye-off-outline" label="Not interested" onPress={() => void notInterested()} />
        <SheetRow icon="flag-outline" label="Report" onPress={onReport} />
      </View>
    </View>
  );
}

function MorePanel({
  session,
  post,
  link,
  onClose,
  onNotInterested,
  onReport,
}: {
  session: Session;
  post: FeedVideo;
  link: string;
  onClose: () => void;
  onNotInterested: () => void;
  onReport: () => void;
}) {
  async function block() {
    Alert.alert("Block this creator?", "Their content will be hidden from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("blocked_users").insert({
            blocker_id: session.user.id,
            blocked_id: post.user_id,
          });
          if (error) Alert.alert("Could not block creator", error.message);
          else onClose();
        },
      },
    ]);
  }

  async function notInterested() {
    try {
      const { data: settings, error: settingsError } = await supabase.from("user_settings").select("settings").eq("user_id", session.user.id).maybeSingle();
      if (settingsError) throw settingsError;
      const current = (settings?.settings ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(current.notInterestedPostIds) ? current.notInterestedPostIds : [];
      const { error } = await supabase.from("user_settings").upsert({
        user_id: session.user.id,
        settings: { ...current, notInterestedPostIds: [...new Set([...ids, post.id])] },
      });
      if (error) throw error;
      onNotInterested();
      onClose();
    } catch (error) {
      Alert.alert("Could not update your feed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Post options</Text>
      <View style={styles.optionList}>
        <SheetRow icon="flag-outline" label="Report" onPress={onReport} />
        <SheetRow icon="ban-outline" label="Block user" onPress={() => void block()} />
        <SheetRow icon="eye-off-outline" label="Not interested" onPress={() => void notInterested()} />
        {post.allow_sharing === false ? null : <SheetRow icon="copy-outline" label="Copy link" onPress={() => {
          void Clipboard.setStringAsync(link).then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).then(onClose)
            .catch((error: unknown) => Alert.alert("Could not copy link", error instanceof Error ? error.message : "Please try again."));
        }} />}
      </View>
    </View>
  );
}

function ReportPanel({
  session,
  post,
  onClose,
}: {
  session: Session;
  post: FeedVideo;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockUser, setBlockUser] = useState(false);

  async function submit() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("reported_content").insert({
        reporter_id: session.user.id,
        video_id: post.id,
        reported_user_id: post.user_id,
        reason: selected,
        details: details.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert("Report not submitted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    const { error } = await supabase.from("blocked_users").insert({
      blocker_id: session.user.id,
      blocked_id: post.user_id,
    });
    if (error) Alert.alert("Could not block creator", error.message);
    else {
      setBlockUser(true);
      onClose();
    }
  }

  if (submitted) {
    return (
      <View style={[styles.panel, styles.success]}>
        <Ionicons name="checkmark-circle" size={54} color={colors.mint} />
        <Text style={styles.title}>Thanks for letting us know</Text>
        <Text style={styles.muted}>Our team will review this report.</Text>
        <Button variant="secondary" onPress={() => void block()}>{blockUser ? "User blocked" : "Block this user"}</Button>
        <Button variant="quiet" onPress={onClose}>Close</Button>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{selected ? "Add details (optional)" : "Report this post"}</Text>
      {selected ? (
        <>
          <Text style={styles.muted}>{reasons.find((item) => item.key === selected)?.label}</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Tell us a little more…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1000}
            style={[styles.input, styles.details]}
          />
          <Button loading={busy} onPress={() => void submit()}>Submit report</Button>
          <Pressable onPress={() => setSelected(null)}><Text style={styles.linkText}>Choose a different reason</Text></Pressable>
        </>
      ) : (
        <FlatList
          data={reasons}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Pressable style={styles.reason} onPress={() => setSelected(item.key)}>
              <Text style={styles.commentText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sheetRow}>
      <Ionicons name={icon} size={21} color={colors.text} />
      <Text style={styles.sheetRowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: "#FCA5A5", paddingVertical: 8 },
  commentList: { gap: 15, paddingVertical: 8 },
  comment: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  reply: { marginLeft: 28 },
  commentContent: { flex: 1, gap: 5 },
  commentName: { color: colors.text, fontSize: 12, fontWeight: "700" },
  handle: { color: colors.muted, fontSize: 10, fontWeight: "400" },
  commentText: { color: "#E4E4E7", fontSize: 13, lineHeight: 19 },
  commentLike: { alignItems: "center", gap: 2 },
  linkText: { color: colors.mint, fontSize: 12, fontWeight: "700", paddingVertical: 4 },
  disabled: { opacity: 0.4 },
  composer: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderColor: colors.border },
  input: { flex: 1, minHeight: 44, maxHeight: 100, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.panel },
  details: { minHeight: 110, textAlignVertical: "top" },
  contactList: { gap: 15, paddingVertical: 9 },
  contactItem: { width: 65, alignItems: "center", gap: 5 },
  contactName: { color: colors.text, fontSize: 10, maxWidth: 65 },
  targetList: { gap: 18, paddingVertical: 8 },
  target: { width: 66, alignItems: "center", gap: 5 },
  targetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelRaised },
  targetText: { color: colors.muted, fontSize: 10 },
  optionList: { gap: 2 },
  sheetRow: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 12 },
  sheetRowText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  success: { alignItems: "center", justifyContent: "center" },
  reason: { minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.border },
});
