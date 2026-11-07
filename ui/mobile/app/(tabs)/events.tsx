import { useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";

type EventItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  price: string;
  image: string;
  spotsLeft: number;
};

const MOCK_EVENTS: EventItem[] = [
  {
    id: "1",
    title: "Nomad Padel Cup 2026",
    category: "Сквош и падл",
    date: "14 Ноября",
    time: "10:00 - 18:00",
    location: "Сквош и Падл Клуб Nomad",
    price: "8 000 ₸",
    image: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600",
    spotsLeft: 4,
  },
  {
    id: "2",
    title: "Ночная лига по футзалу 5x5",
    category: "Футбол",
    date: "16 Ноября",
    time: "21:00 - 23:30",
    location: "Футбольный зал Arena",
    price: "15 000 ₸ / команда",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600",
    spotsLeft: 2,
  },
  {
    id: "3",
    title: "Турнир по уличному баскетболу 3х3",
    category: "Баскетбол",
    date: "20 Ноября",
    time: "14:00 - 19:00",
    location: "Баскетбольный зал Pro",
    price: "5 000 ₸",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600",
    spotsLeft: 6,
  },
  {
    id: "4",
    title: "Открытый мастер-класс по теннису",
    category: "Теннис",
    date: "22 Ноября",
    time: "11:00 - 13:00",
    location: "Теннисный клуб Grand Slam",
    price: "6 000 ₸",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600",
    spotsLeft: 8,
  },
];

export default function EventsScreen() {
  const { colors } = useAppTheme();
  const [events] = useState<EventItem[]>(MOCK_EVENTS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Спортивные события</Text>
        <Text style={styles.subtitle}>Турниры, открытые игры и мастер-классы</Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.category}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color="#8E9B94" />
                <Text style={styles.metaText}>{item.date} • {item.time}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color="#8E9B94" />
                <Text style={styles.metaText}>{item.location}</Text>
              </View>

              <View style={styles.footerRow}>
                <View>
                  <Text style={styles.priceLabel}>Участие</Text>
                  <Text style={styles.priceValue}>{item.price}</Text>
                </View>
                <Pressable style={styles.joinBtn}>
                  <Text style={styles.joinBtnText}>Записаться ({item.spotsLeft} мест)</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#8E9B94",
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 16,
  },
  card: {
    backgroundColor: "#141B17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2A23",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 150,
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(11, 15, 13, 0.8)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  badgeText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "700",
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#8E9B94",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2A23",
  },
  priceLabel: {
    fontSize: 11,
    color: "#6B7C72",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  joinBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  joinBtnText: {
    color: "#0B0F0D",
    fontSize: 13,
    fontWeight: "700",
  },
});

