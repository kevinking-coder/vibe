import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { Button, colors, Screen, VibeChip } from "../components/ui";
import { VIBES, type VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";

export function OnboardingScreen({
  session,
  onComplete,
}: {
  session: Session;
  onComplete: (vibes: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<VibeName[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(vibe: VibeName) {
    setSelected((current) =>
      current.includes(vibe) ? current.filter((item) => item !== vibe) : [...current, vibe],
    );
  }

  async function finish() {
    if (selected.length === 0) {
      Alert.alert("Pick your vibes", "Choose at least one vibe to shape your feed.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ vibe_tags: selected, onboarding_complete: true })
        .eq("id", session.user.id);
      if (error) throw error;
      await onComplete(selected);
    } catch (error) {
      Alert.alert("Could not save your choices", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.brand}>vibed</Text>
        <Text style={styles.title}>What are you feeling?</Text>
        <Text style={styles.subtitle}>Choose a few vibes. You can change them anytime.</Text>
      </View>
      <View style={styles.grid}>
        {VIBES.map((vibe) => {
          const active = selected.includes(vibe);
          return <VibeChip key={vibe} vibe={vibe} active={active} onPress={() => toggle(vibe)} />;
        })}
      </View>
      <Button loading={busy} onPress={finish}>Let’s go</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingTop: 32, paddingBottom: 20 },
  brand: { color: colors.mint, fontSize: 18, fontWeight: "800" },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 8 },
});
