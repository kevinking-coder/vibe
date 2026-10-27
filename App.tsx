import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import "./global.css";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.title}>vibed</Text>
        <Text style={styles.subtitle}>
          Find your room. Feel your vibe.
        </Text>
        <View style={styles.accent} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0A0C",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 12,
    color: "#A1A1AA",
    fontSize: 16,
  },
  accent: {
    width: 80,
    height: 4,
    marginTop: 32,
    borderRadius: 2,
    backgroundColor: "#8B5CF6",
  },
});
