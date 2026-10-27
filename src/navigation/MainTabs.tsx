import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { colors } from "../components/ui";
import type { UserProfile } from "../types/app";
import type { MainTabParamList } from "./types";
import { CreateScreen } from "../screens/CreateScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { InboxScreen } from "../screens/InboxScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs({
  session,
  profile,
  onProfileUpdated,
}: {
  session: Session;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}) {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            height: 66,
            paddingTop: 7,
            paddingBottom: 8,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.mint,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
          tabBarIcon: ({ focused, color }) => {
            const symbols: Record<keyof MainTabParamList, string> = {
              Home: "⌂",
              Discover: "⌕",
              Upload: "+",
              Inbox: "♡",
              Profile: "●",
            };
            return (
              <Text style={{ color, fontSize: focused ? 23 : 21, fontWeight: "700", lineHeight: 25 }}>
                {symbols[route.name]}
              </Text>
            );
          },
        })}
      >
        <Tab.Screen name="Home" options={{ title: "For you" }}>
          {() => <HomeScreen session={session} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="Discover" options={{ title: "Explore" }}>
          {() => <DiscoverScreen session={session} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="Upload" options={{ title: "Create" }}>
          {() => <CreateScreen session={session} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="Inbox" options={{ title: "Inbox" }}>
          {() => <InboxScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: "You" }}>
          {() => <ProfileScreen session={session} profile={profile} onProfileUpdated={onProfileUpdated} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
