import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type POV = { 
  id: string; 
  user_id: string; 
  playback_url?: string | null;
  livepeer_playback_id?: string | null;
};

type ViewerState = {
  activeEventId: string | null;
  povs: POV[];
  activeIndex: number;
  setEvent: (id: string, povs: POV[]) => void;
  setActiveIndex: (i: number) => void;
  clear: () => void;
};

export const useViewerStore = create<ViewerState>((set, get) => ({
  activeEventId: null,
  povs: [],
  activeIndex: 0,
  setEvent: (id, povs) => {
    set({ activeEventId: id, povs, activeIndex: 0 });
    AsyncStorage.setItem("viewer_last_event", id).catch(() => {});
  },
  setActiveIndex: (i) => set({ activeIndex: i }),
  clear: () => set({ activeEventId: null, povs: [], activeIndex: 0 }),
}));
