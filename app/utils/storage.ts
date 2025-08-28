import AsyncStorage from "@react-native-async-storage/async-storage";

const REACTIVES_KEY = "@reactives";
const DOSE_HISTORY_KEY = "@dose_history";

export interface Reactive {
  id: string;
  name: string;
  quantity: string;
  times: string[];
  startDate: string;
  duration: string;
  color: string;
  reminderEnabled: boolean;
  currentSupply: number;
  totalSupply: number;
  refillAt: number;
  refillReminder: boolean;
  lastRefillDate?: string;
}

export interface DoseHistory {
  id: string;
  reactiveId: string;
  timestamp: string;
  taken: boolean;
}

export async function getReactives(): Promise<Reactive[]> {
  try {
    const data = await AsyncStorage.getItem(REACTIVES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting Reactives:", error);
    return [];
  }
}

export async function addReactive(reactive: Reactive): Promise<void> {
  try {
    const reactives = await getReactives();
    reactives.push(reactive);
    await AsyncStorage.setItem(REACTIVES_KEY, JSON.stringify(reactives));
  } catch (error) {
    console.error("Error adding Reactives:", error);
    throw error;
  }
}

export async function updateReactive(
  updatedReactive: Reactive
): Promise<void> {
  try {
    const reactives = await getReactives();
    const index = reactives.findIndex(
      (reac) => reac.id === updatedReactive.id
    );
    if (index !== -1) {
      reactives[index] = updatedReactive;
      await AsyncStorage.setItem(REACTIVES_KEY, JSON.stringify(reactives));
    }
  } catch (error) {
    console.error("Error updating Reactives:", error);
    throw error;
  }
}

export async function deleteReactives(id: string): Promise<void> {
  try {
    const reactives = await getReactives();
    const updatedReactive = reactives.filter((reac) => reac.id !== id);
    await AsyncStorage.setItem(
      REACTIVES_KEY,
      JSON.stringify(updatedReactive)
    );
  } catch (error) {
    console.error("Error deleting Reactives:", error);
    throw error;
  }
}

export async function getDoseHistory(): Promise<DoseHistory[]> {
  try {
    const data = await AsyncStorage.getItem(DOSE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting dose history:", error);
    return [];
  }
}

export async function getTodaysDoses(): Promise<DoseHistory[]> {
  try {
    const history = await getDoseHistory();
    const today = new Date().toDateString();
    return history.filter(
      (dose) => new Date(dose.timestamp).toDateString() === today
    );
  } catch (error) {
    console.error("Error getting today's doses:", error);
    return [];
  }
}

export async function recordDose(
  reactiveId: string,
  taken: boolean,
  timestamp: string
): Promise<void> {
  try {
    const history = await getDoseHistory();
    const newDose: DoseHistory = {
      id: Math.random().toString(36).substr(2, 9),
      reactiveId,
      timestamp,
      taken,
    };

    history.push(newDose);
    await AsyncStorage.setItem(DOSE_HISTORY_KEY, JSON.stringify(history));

    // Update reactive supply if taken
    if (taken) {
      const reactives = await getReactives();
      const reactive = reactives.find((reac) => reac.id === reactiveId);
      if (reactive && reactive.currentSupply > 0) {
        reactive.currentSupply -= 1;
        await updateReactive(reactive);
      }
    }
  } catch (error) {
    console.error("Error recording dose:", error);
    throw error;
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([REACTIVES_KEY, DOSE_HISTORY_KEY]);
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
}