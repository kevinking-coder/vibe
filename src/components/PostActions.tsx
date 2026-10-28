import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Avatar, colors } from "./ui";

export function PostActions({
  avatarUrl,
  creatorName,
  liked,
  saved,
  likeCount,
  commentCount,
  accent,
  onFollow,
  onLike,
  onComment,
  onShare,
  onSave,
  onMore,
  sharingAllowed = true,
  commentsAllowed = true,
}: {
  avatarUrl?: string | null;
  creatorName: string;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  accent: string;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onMore: () => void;
  sharingAllowed?: boolean;
  commentsAllowed?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!liked) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 28, bounciness: 12 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();
  }, [liked, scale]);

  function tap(action: () => void) {
    void Haptics.selectionAsync();
    action();
  }

  return (
    <View style={styles.column}>
      <View style={styles.creator}>
        <Avatar uri={avatarUrl} label={creatorName} size={44} />
        <Pressable onPress={() => tap(onFollow)} style={styles.follow}>
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
      <Pressable accessibilityLabel={liked ? "Unlike" : "Like"} onPress={() => tap(onLike)} style={styles.action}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={29} color={liked ? accent : "#FFFFFF"} style={styles.shadow} />
        </Animated.View>
        <Text style={styles.count}>{likeCount.toLocaleString()}</Text>
      </Pressable>
      {commentsAllowed ? (
        <Pressable accessibilityLabel="Comment" onPress={() => tap(onComment)} style={styles.action}>
          <Ionicons name="chatbubble-ellipses-outline" size={27} color="#FFFFFF" style={styles.shadow} />
          <Text style={styles.count}>{commentCount.toLocaleString()}</Text>
        </Pressable>
      ) : null}
      {sharingAllowed ? (
        <Pressable accessibilityLabel="Share" onPress={() => tap(onShare)} style={styles.action}>
          <Ionicons name="arrow-redo-outline" size={28} color="#FFFFFF" style={styles.shadow} />
          <Text style={styles.count}>Share</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityLabel={saved ? "Unsave post" : "Save post"} onPress={() => tap(onSave)} style={styles.action}>
        <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={26} color={saved ? accent : "#FFFFFF"} style={styles.shadow} />
        <Text style={styles.count}>{saved ? "Saved" : "Save"}</Text>
      </Pressable>
      <Pressable accessibilityLabel="More post options" onPress={() => tap(onMore)} style={styles.action}>
        <Ionicons name="ellipsis-horizontal" size={27} color="#FFFFFF" style={styles.shadow} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center", gap: 19, paddingBottom: 8 },
  creator: { position: "relative", marginBottom: 1 },
  follow: { position: "absolute", bottom: -7, left: 14, width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  action: { minWidth: 42, alignItems: "center", gap: 3 },
  shadow: { textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  count: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", textShadowColor: "#000000", textShadowRadius: 4 },
});
