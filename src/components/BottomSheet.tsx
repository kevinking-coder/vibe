import type { PropsWithChildren } from "react";
import { useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { colors } from "./ui";

export function BottomSheet({
  visible,
  onClose,
  children,
  height = "82%",
}: PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  height?: `${number}%` | number;
}>) {
  const translateY = useRef(new Animated.Value(0)).current;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 100 || gesture.vy > 1) {
            Animated.timing(translateY, {
              toValue: 700,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              onClose();
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 22,
            }).start();
          }
        },
      }),
    [onClose, translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
        <Animated.View style={[styles.sheet, { height, transform: [{ translateY }] }]}>
          <View {...responder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.64)" },
  sheet: { overflow: "hidden", borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.background },
  handleArea: { height: 28, alignItems: "center", justifyContent: "center" },
  handle: { width: 42, height: 4, borderRadius: 4, backgroundColor: "#60606A" },
});
