import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserSettings, ChatMessage, FoodEntry } from '@/types';

interface AppState {
  // User Settings
  settings: UserSettings;
  setSettings: (settings: Partial<UserSettings>) => void;

  // Chat Messages (in-memory only, not persisted)
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Pending Entry (food being confirmed)
  pendingEntry: Partial<FoodEntry> | null;
  setPendingEntry: (entry: Partial<FoodEntry> | null) => void;

  // UI State
  isAnalyzing: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Default settings
      settings: {
        defaultGoal: 150,
        theme: 'system',
        claudeApiKey: undefined,
      },
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Chat messages
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        })),
      clearMessages: () => set({ messages: [] }),

      // Pending entry
      pendingEntry: null,
      setPendingEntry: (entry) => set({ pendingEntry: entry }),

      // UI state
      isAnalyzing: false,
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
    }),
    {
      name: 'protee-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
