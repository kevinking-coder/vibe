import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

import { DEFAULT_VIBE, type VibeName } from "../config/vibes";

type AppState = {
  activeVibeRoom: VibeName;
  session: Session | null;
  setActiveVibeRoom: (vibe: VibeName) => void;
  setSession: (session: Session | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeVibeRoom: DEFAULT_VIBE,
  session: null,
  setActiveVibeRoom: (activeVibeRoom) => set({ activeVibeRoom }),
  setSession: (session) => set({ session }),
}));
