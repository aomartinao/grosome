import Dexie, { type EntityTable } from 'dexie';
import type { FoodEntry, UserSettings, DailyGoal } from '@/types';

const db = new Dexie('ProteeDB') as Dexie & {
  foodEntries: EntityTable<FoodEntry, 'id'>;
  userSettings: EntityTable<UserSettings, 'id'>;
  dailyGoals: EntityTable<DailyGoal, 'id'>;
};

db.version(1).stores({
  foodEntries: '++id, date, source, createdAt',
  userSettings: '++id',
  dailyGoals: '++id, date',
});

export { db };

// Helper functions
export async function getEntriesForDate(date: string): Promise<FoodEntry[]> {
  return db.foodEntries.where('date').equals(date).toArray();
}

export async function getEntriesForDateRange(startDate: string, endDate: string): Promise<FoodEntry[]> {
  return db.foodEntries
    .where('date')
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function addFoodEntry(entry: Omit<FoodEntry, 'id'>): Promise<number> {
  const id = await db.foodEntries.add(entry as FoodEntry);
  return id as number;
}

export async function deleteFoodEntry(id: number): Promise<void> {
  return db.foodEntries.delete(id);
}

export async function updateFoodEntry(id: number, updates: Partial<FoodEntry>): Promise<number> {
  return db.foodEntries.update(id, updates);
}

export async function getUserSettings(): Promise<UserSettings | undefined> {
  return db.userSettings.toCollection().first();
}

export async function saveUserSettings(settings: Omit<UserSettings, 'id'>): Promise<void> {
  const existing = await getUserSettings();
  if (existing?.id) {
    await db.userSettings.update(existing.id, settings);
  } else {
    await db.userSettings.add(settings as UserSettings);
  }
}

export async function getDailyGoal(date: string): Promise<DailyGoal | undefined> {
  return db.dailyGoals.where('date').equals(date).first();
}

export async function setDailyGoal(date: string, goal: number): Promise<void> {
  const existing = await getDailyGoal(date);
  if (existing?.id) {
    await db.dailyGoals.update(existing.id, { goal });
  } else {
    await db.dailyGoals.add({ date, goal });
  }
}

export async function getAllDailyGoals(): Promise<DailyGoal[]> {
  return db.dailyGoals.toArray();
}
