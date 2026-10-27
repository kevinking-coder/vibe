import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "./global.css";
import { Button, colors } from "./src/components/ui";
import { supabase } from "./src/services/supabase";
import type { UserProfile } from "./src/types/app";
import { AuthScreen } from "./src/screens/AuthScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { MainTabs } from "./src/navigation/MainTabs";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [starting, setStarting] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: result, error }) => {
        if (error) throw error;
        if (active) setSession(result.session);
      })
      .catch((error: unknown) => {
        Alert.alert("Could not restore your session", error instanceof Error ? error.message : "Please reopen the app.");
      })
      .finally(() => {
        if (active) setStarting(false);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, display_name, bio, avatar_url, vibe_tags, hard_muted_vibes, onboarding_complete")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      setProfile(data as UserProfile);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not load your profile.");
    } finally {
      setLoadingProfile(false);
    }
  }, [session]);

  useEffect(() => {
    if (!starting) void loadProfile();
  }, [loadProfile, starting]);

  async function completeOnboarding(vibes: string[]) {
    if (!profile) return;
    setProfile({ ...profile, vibe_tags: vibes, onboarding_complete: true });
  }

  if (starting) {
    return <LoadingScreen label="Getting Vibed ready…" />;
  }
  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    );
  }
  if (loadingProfile) {
    return <LoadingScreen label="Loading your profile…" />;
  }
  if (profileError || !profile) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>We couldn’t load your profile</Text>
        <Text style={styles.errorBody}>
          {profileError ?? "Your profile wasn’t created. Check that the profile trigger from your Supabase SQL ran successfully."}
        </Text>
        <Button onPress={() => void loadProfile()}>Try again</Button>
        <Button variant="quiet" onPress={() => void signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Button>
      </View>
    );
  }
  if (!profile.onboarding_complete) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingScreen session={session} onComplete={completeOnboarding} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <MainTabs
        session={session}
        profile={profile}
        onProfileUpdated={setProfile}
      />
    </>
  );
}

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    Alert.alert("Sign-out failed", error instanceof Error ? error.message : "Please try again.");
  }
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { color: colors.muted, fontSize: 14 },
  error: { flex: 1, padding: 28, gap: 16, justifyContent: "center", backgroundColor: colors.background },
  errorTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  errorBody: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  signOut: { color: colors.mint, fontWeight: "700" },
});
