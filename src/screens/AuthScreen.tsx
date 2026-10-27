import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

import { Button, colors, Field, Screen } from "../components/ui";
import { supabase } from "../services/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 6) {
      Alert.alert("Check your details", "Enter your email and a password with at least 6 characters.");
      return;
    }
    if (mode === "sign-up" && !/^[a-z0-9_]{3,24}$/i.test(username.trim())) {
      Alert.alert("Choose a username", "Use 3–24 letters, numbers, or underscores.");
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
          : await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: { data: { username: username.trim().toLowerCase(), display_name: username.trim() } },
            });
      if (result.error) {
        throw result.error;
      }
      if (mode === "sign-up" && !result.data.session) {
        Alert.alert("Check your email", "Confirm your email address, then sign in to finish setting up Vibed.");
      }
    } catch (error) {
      Alert.alert(mode === "sign-in" ? "Sign-in failed" : "Sign-up failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>vibed</Text>
          <Text style={styles.tagline}>Your feed. Your feeling.</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.title}>{mode === "sign-in" ? "Welcome back" : "Find your people"}</Text>
          {mode === "sign-up" ? (
            <Field label="Username" autoCapitalize="none" value={username} onChangeText={setUsername} placeholder="yourname" maxLength={24} />
          ) : null}
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 6 characters" />
          <Button loading={busy} onPress={submit}>
            {mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
          <Button
            variant="quiet"
            onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          >
            <Text style={styles.switchText}>
              {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 26 },
  brand: { alignItems: "center", marginBottom: 54 },
  logo: { color: colors.text, fontSize: 48, fontWeight: "900", letterSpacing: -2 },
  tagline: { color: colors.muted, fontSize: 15, marginTop: 5 },
  form: { gap: 16 },
  title: { color: colors.text, fontSize: 25, fontWeight: "800", marginBottom: 4 },
  switchText: { color: colors.mint, fontWeight: "600" },
});
