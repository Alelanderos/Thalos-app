import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Reactive } from "./storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  try {
    const response = await Notifications.getExpoPushTokenAsync();
    token = response.data;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1a8e2d",
      });
    }

    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export async function scheduleReactiveReminder(
  reactive: Reactive
): Promise<string | undefined> {
  if (!reactive.reminderEnabled) return;

  try {
    // Schedule notifications for each time
    for (const time of reactive.times) {
      const [hours, minutes] = time.split(":").map(Number);
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);

      // If time has passed for today, schedule for tomorrow
      if (today < new Date()) {
        today.setDate(today.getDate() + 1);
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reactive Reminder",
          body: `Time to take ${reactive.name} (${reactive.quantity})`,
          data: { reactiveId: reactive.id },
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling reactive reminder:", error);
    return undefined;
  }
}

export async function scheduleRefillReminder(
  reactive: Reactive
): Promise<string | undefined> {
  if (!reactive.refillReminder) return;

  try {
    // Schedule a notification when supply is low
    if (reactive.currentSupply <= reactive.refillAt) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Refill Reminder",
          body: `Your ${reactive.name} supply is running low. Current supply: ${reactive.currentSupply}`,
          data: { reactiveId: reactive.id, type: "refill" },
        },
        trigger: null, // Show immediately
      });

      return identifier;
    }
  } catch (error) {
    console.error("Error scheduling refill reminder:", error);
    return undefined;
  }
}

export async function cancelReactiveReminders(
  reactiveId: string
): Promise<void> {
  try {
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduledNotifications) {
      const data = notification.content.data as {
        reactiveId?: string;
      } | null;
      if (data?.reactiveId === reactiveId) {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        );
      }
    }
  } catch (error) {
    console.error("Error canceling reactive reminders:", error);
  }
}

export async function updateReactiveReminders(
  reactive: Reactive
): Promise<void> {
  try {
    // Cancel existing reminders
    await cancelReactiveReminders(reactive.id);

    // Schedule new reminders
    await scheduleReactiveReminder(reactive);
    await scheduleRefillReminder(reactive);
  } catch (error) {
    console.error("Error updating reactive reminders:", error);
  }
}