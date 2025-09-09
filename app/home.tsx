import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  registerForPushNotificationsAsync,
  scheduleReactiveReminder,
} from "./utils/notifications";
import {
  DoseHistory,
  getReactives,
  getTodaysDoses,
  Reactive,
  recordDose,
} from "./utils/storage";

const { width } = Dimensions.get("window");



const QUICK_ACTIONS = [
  {
    icon: "add-circle-outline" as const,
    label: "Invetario",
    route: "/reactives/add" as const,
    color: "#2E7D32",
    gradient: ["#4CAF50", "#2E7D32"] as [string, string],
  },
  {
    icon: "calendar-outline" as const,
    label: "Calendario",
    route: "/calendar" as const,
    color: "#1976D2",
    gradient: ["#2196F3", "#1976D2"] as [string, string],
  },
  {
    icon: "time-outline" as const,
    label: "Historial\nEntradas",
    route: "/history" as const,
    color: "#C2185B",
    gradient: ["#E91E63", "#C2185B"] as [string, string],
  },
  {
    icon: "medical-outline" as const,
    label: "Refill\nInventario",
    route: "/refills" as const,
    color: "#E64A19",
    gradient: ["#FF5722", "#E64A19"] as [string, string],
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [reactives, setReactives] = useState<Reactive[]>([]);
  const [todaysReactives, setTodaysReactives] = useState<Reactive[]>([]);
  const [completedDoses, setCompletedDoses] = useState(0);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);

  const loadReactives = useCallback(async () => {
    try {
      const [allReactives, todaysDoses] = await Promise.all([
        getReactives(),
        getTodaysDoses(),
      ]);

      setDoseHistory(todaysDoses);
      setReactives(allReactives);

      // Filter Reactives for today
      const today = new Date();
      const todayMeds = allReactives.filter((reac) => {
        const startDate = new Date(reac.startDate);
        const durationDays = parseInt(reac.duration.split(" ")[0]);

        // For ongoing reactives or if within duration
        if (
          durationDays === -1 ||
          (today >= startDate &&
            today <=
              new Date(
                startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
              ))
        ) {
          return true;
        }
        return false;
      });

      setTodaysReactives(todayMeds);

      // Calculate completed doses
      const completed = todaysDoses.filter((dose) => dose.taken).length;
      setCompletedDoses(completed);
    } catch (error) {
      console.error("Error loading reactives:", error);
    }
  }, []);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        console.log("Failed to get push notification token");
        return;
      }

      // Schedule reminders for all reactives
      const reactives = await getReactives();
      for (const reactive of reactives) {
        if (reactive.reminderEnabled) {
          await scheduleReactiveReminder(reactive);
        }
      }
    } catch (error) {
      console.error("Error setting up notifications:", error);
    }
  };

  // Use useEffect for initial load
  useEffect(() => {
    loadReactives();
    setupNotifications();

    // Handle app state changes for notifications
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadReactives();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Use useFocusEffect for subsequent updates
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = () => {
        // Cleanup if needed
      };

      loadReactives();
      return () => unsubscribe();
    }, [loadReactives])
  );

  const handleTakeDose = async (reactive: Reactive) => {
    try {
      await recordDose(reactive.id, true, new Date().toISOString());
      await loadReactives(); // Reload data after recording dose
    } catch (error) {
      console.error("Error recording dose:", error);
      Alert.alert("Error", "Failed to record dose. Please try again.");
    }
  };

  const isDoseTaken = (reactiveId: string) => {
    return doseHistory.some(
      (dose) => dose.reactiveId === reactiveId && dose.taken
    );
  };

  const progress =
    todaysReactives.length > 0
      ? completedDoses / (todaysReactives.length * 2)
      : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#1a8e2d", "#146922"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>Thalos</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              {todaysReactives.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>
                    {todaysReactives.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {/* Aqui se le mueve la cantidad de muestras, si es que se usa*/}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Link href={action.route} key={action.label} asChild>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                  >
                    <View style={styles.actionContent}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={action.icon} size={28} color="white" />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Link href="/calender" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            </Link>
          </View>
          {todaysReactives.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                No reactives used for today
              </Text>
              <Link href="/reactives/add" asChild>
                <TouchableOpacity style={styles.addReactiveButton}>
                  <Text style={styles.addReactiveButtonText}>
                    Add Reactive
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            todaysReactives.map((reactive) => {
              const taken = isDoseTaken(reactive.id);
              return (
                <View key={reactive.id} style={styles.doseCard}>
                  <View
                    style={[
                      styles.doseBadge,
                      { backgroundColor: `${reactive.color}15` },
                    ]}
                  >
                    <Ionicons
                      name="medical"
                      size={24}
                      color={reactive.color}
                    />
                  </View>
                  <View style={styles.doseInfo}>
                    <View>
                      <Text style={styles.medicineName}>{reactive.name}</Text>
                      <Text style={styles.quantityInfo}>{reactive.quantity}</Text>
                    </View>
                    <View style={styles.doseTime}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.timeText}>{reactive.times[0]}</Text>
                    </View>
                  </View>
                  {taken ? (
                    <View style={[styles.takenBadge]}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#4CAF50"
                      />
                      <Text style={styles.takenText}>Taken</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.takeDoseButton,
                        { backgroundColor: reactive.color },
                      ]}
                      onPress={() => handleTakeDose(reactive)}
                    >
                      <Text style={styles.takeDoseText}>Take</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity
                onPress={() => setShowNotifications(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {todaysReactives.map((reactive) => (
              <View key={reactive.id} style={styles.notificationItem}>
                <View style={styles.notificationIcon}>
                  <Ionicons name="medical" size={24} color={reactive.color} />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {reactive.name}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {reactive.quantity}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {reactive.times[0]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingTop: 50,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "600",
    color: "white",
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 15,
  },
  actionButton: {
    width: (width - 52) / 2,
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: {
    flex: 1,
    padding: 15,
  },
  actionContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 5,
  },
  seeAllButton: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  doseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  doseBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  doseInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  medicineName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  quantityInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  doseTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    marginLeft: 5,
    color: "#666",
    fontSize: 14,
  },
  takeDoseButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginLeft: 10,
  },
  takeDoseText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  progressTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  progressPercentage: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
  },
  progressLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
  },
  progressRing: {
    transform: [{ rotate: "-90deg" }],
  },
  flex1: {
    flex: 1,
  },
  notificationButton: {
    position: "relative",
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    marginLeft: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF5252",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#146922",
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  progressDetails: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 5,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    marginBottom: 10,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "white",
    borderRadius: 16,
    marginTop: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 20,
  },
  addReactiveButton: {
    backgroundColor: "#1a8e2d",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addReactiveButtonText: {
    color: "white",
    fontWeight: "600",
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10,
  },
  takenText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
});