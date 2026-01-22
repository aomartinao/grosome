export interface FoodEntry {
  id?: number;
  date: string;              // YYYY-MM-DD
  source: 'text' | 'photo' | 'manual' | 'label';
  foodName: string;
  protein: number;           // grams
  confidence: 'high' | 'medium' | 'low';
  imageData?: string;        // base64 encoded image for photo entries
  createdAt: Date;
}

export interface UserSettings {
  id?: number;
  defaultGoal: number;       // daily protein target in grams
  theme: 'light' | 'dark' | 'system';
  claudeApiKey?: string;     // user provides their own key
}

export interface DailyGoal {
  id?: number;
  date: string;              // YYYY-MM-DD
  goal: number;              // protein target for this specific day
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  imageData?: string;
  foodEntry?: FoodEntry;
  isLoading?: boolean;
  timestamp: Date;
}

export interface DailyStats {
  date: string;
  totalProtein: number;
  goal: number;
  entries: FoodEntry[];
  goalMet: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastGoalMetDate: string | null;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AIAnalysisResult {
  foodName: string;
  protein: number;
  confidence: ConfidenceLevel;
  reasoning?: string;
}
