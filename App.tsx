import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import "./global.css";

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0C]" edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl font-bold tracking-tight text-white">vibed</Text>
        <Text className="mt-3 text-base text-zinc-400">
          Find your room. Feel your vibe.
        </Text>
        <View className="mt-8 h-1 w-20 rounded-full bg-violet-500" />
      </View>
    </SafeAreaView>
  );
}
