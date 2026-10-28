import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { colors } from "../components/ui";
import type { UserProfile } from "../types/app";
import type { MainTabParamList } from "./types";
import { CreateScreen } from "../screens/CreateScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { InboxScreen } from "../screens/InboxScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { useAppStore } from "../store/appStore";

const Tab = createBottomTabNavigator<MainTabParamList>();
const linking: LinkingOptions<MainTabParamList> = {
  prefixes: ["vibed://"],
  config: {
    screens: {
      Home: "post/:postId",
      Profile: "creator/:username",
      Inbox: "inbox/:contactId",
    },
  },
};

export function MainTabs({
  session,
  profile,
  onProfileUpdated,
}: {
  session: Session;
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}) {
  const theme = useAppStore((state) => state.settings.theme);
  const accentColor = useAppStore((state) => state.settings.accentColor);
  const systemScheme = useColorScheme();
  const light = theme === "light" || (theme === "system" && systemScheme === "light");
  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            height: 66,
            paddingTop: 7,
            paddingBottom: 8,
            backgroundColor: light ? "#FFFFFF" : colors.background,
            borderTopColor: light ? "#D4D4D8" : colors.border,
          },
          tabBarActiveTintColor: accentColor,
          tabBarInactiveTintColor: light ? "#71717A" : colors.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
          tabBarIcon: ({ focused, color }) => {
            const symbols: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
              Home: focused ? "home" : "home-outline",
              Discover: "search-outline",
              Upload: focused ? "add-circle" : "add-circle-outline",
              Inbox: focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline",
              Profile: focused ? "person-circle" : "person-circle-outline",
            };
            return <Ionicons name={symbols[route.name]} size={focused ? 23 : 21} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" options={{ title: "Vibe Room" }}>
          {({ navigation, route }) => (
            <HomeScreen
              session={session}
              profile={profile}
              deepLinkPostId={route.params?.postId}
              onDeepLinkHandled={() => navigation.setParams({ postId: undefined })}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Discover" options={{ title: "Explore" }}>
          {({ navigation }) => (
            <DiscoverScreen
              session={session}
              profile={profile}
              onOpenCreator={(username) => navigation.navigate("Profile", { username })}
              onOpenPost={(postId) => navigation.navigate("Home", { postId })}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Upload" options={{ title: "Create" }}>
          {() => <CreateScreen session={session} profile={profile} />}
        </Tab.Screen>
        <Tab.Screen name="Inbox" options={{ title: "Inbox" }}>
          {({ navigation, route }) => (
            <InboxScreen
              session={session}
              initialContactId={route.params?.contactId}
              onInitialContactHandled={() => navigation.setParams({ contactId: undefined })}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: "You" }}>
          {({ navigation, route }) => (
            <ProfileScreen
              session={session}
              profile={profile}
              creatorUsername={route.params?.username}
              onProfileUpdated={onProfileUpdated}
              onMessageCreator={(contactId) => navigation.navigate("Inbox", { contactId })}
              onClosePublicProfile={() => navigation.navigate("Profile", {})}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
