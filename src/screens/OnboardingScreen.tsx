import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { Button, colors, Screen } from "../components/ui";
import { VIBE_THEMES, type VibeName } from "../config/vibes";
import { supabase } from "../services/supabase";

const vibes = Object.keys(VIBE_THEMES) as VibeName[];

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
        {vibes.map((vibe) => {
          const active = selected.includes(vibe);
          const accent = VIBE_THEMES[vibe].accent;
          return (
            <Button
              key={vibe}
              variant="secondary"
              onPress={() => toggle(vibe)}
              style={[styles.vibe, active && { borderColor: accent, backgroundColor: `${accent}22` }]}
            >
              <Text style={[styles.vibeText, active && { color: accent }]}>{vibe}</Text>
            </Button>
          );
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  vibe: { width: "47%", minHeight: 64 },
  vibeText: { color: colors.text, fontSize: 16, fontWeight: "700" },
});
