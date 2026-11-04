import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/ThemeProvider";
import {
  createItem,
  deleteItem,
  ItemEntity,
  listItems,
  MOCK_SPORT_VENUES,
} from "@/lib/items";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { getErrorMessage } from "@/lib/errorMessage";

const CATEGORIES = ["Все", "Футбол", "Баскетбол", "Теннис", "Волейбол", "Сквош и падл"];

export default function ItemsScreen() {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<ItemEntity[]>(MOCK_SPORT_VENUES);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [search, setSearch] = useState("");

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Футбол");
  const [price, setPrice] = useState("15000");
  const [location, setLocation] = useState("г. Астана");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadVenues = useCallback(async () => {
    try {
      const res = await listItems({
        category: selectedCategory === "Все" ? undefined : selectedCategory,
        q: search.trim() || undefined,
      });
      setItems(res.items || MOCK_SPORT_VENUES);
    } catch {
      setItems(MOCK_SPORT_VENUES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Ошибка", "Введите название зала");
      return;
    }
    setSaving(true);
    try {
      const newItem: ItemEntity = {
        id: Date.now(),
        user_id: 1,
        title: title.trim(),
        description: description.trim() || "Новый спортивный зал",
        category,
        price: parseInt(price) || 12000,
        status: "active",
        image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
        metadata: {
          location: location.trim(),
          rating: 5.0,
          reviewsCount: 1,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      setModalOpen(false);
      setTitle("");
      setDescription("");
      hapticSuccess();
      Alert.alert("Успешно", "Зал добавлен в каталог!");
    } catch (e) {
      Alert.alert("Ошибка", getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#0B0F0D" }]} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Каталог залов</Text>
          <Text style={styles.subtitle}>Аренда спортивных площадок в Астане</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            hapticSelection();
            setModalOpen(true);
          }}
        >
          <Ionicons name="add" size={22} color="#0B0F0D" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#6B7C72" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Поиск по названию или адресу..."
          placeholderTextColor="#6B7C72"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      {/* Categories chips */}
      <View style={styles.categoryWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item: cat }) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  hapticSelection();
                  setSelectedCategory(cat);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Halls List */}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadVenues();
            }}
            tintColor="#22C55E"
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.image_url }} style={styles.cardImage} />
            <View style={styles.cardRating}>
              <Ionicons name="star" size={12} color="#22C55E" />
              <Text style={styles.ratingText}>
                {item.metadata?.rating || 4.8} ({item.metadata?.reviewsCount || 80})
              </Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#8E9B94" />
                <Text style={styles.locationText}>
                  {item.metadata?.location || "г. Астана"}
                </Text>
              </View>

              <Text style={styles.descText} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.priceText}>
                  {(item.price || 12000).toLocaleString("ru-RU")} ₸{" "}
                  <Text style={styles.priceSub}>/ час</Text>
                </Text>
                <Pressable
                  style={styles.bookBtn}
                  onPress={() => {
                    hapticSuccess();
                    Alert.alert(
                      "Забронировать",
                      `Зал "${item.title}" свободен на сегодня с 19:00. Забронировать за ${(item.price || 12000).toLocaleString("ru-RU")} ₸?`,
                      [
                        { text: "Отмена", style: "cancel" },
                        {
                          text: "Подтвердить",
                          onPress: () => Alert.alert("Успешно!", "Зал забронирован!"),
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.bookBtnText}>Забронировать</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* Add Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Добавить спортивный зал</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Название зала</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Например: Футбольный манеж Nomad"
              placeholderTextColor="#6B7C72"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Категория</Text>
            <View style={styles.catPicker}>
              {["Футбол", "Баскетбол", "Теннис", "Волейбол"].map((c) => (
                <Pressable
                  key={c}
                  style={[styles.catChip, category === c && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Цена за час (₸)</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="15000"
              placeholderTextColor="#6B7C72"
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Адрес</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="г. Астана, ул. Достык 12"
              placeholderTextColor="#6B7C72"
              style={styles.input}
            />

            <Pressable style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Сохранение..." : "Сохранить зал"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontSize: 13,
    color: "#8E9B94",
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    height: 46,
    backgroundColor: "#141A17",
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1F2823",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#FFFFFF",
  },
  categoryWrap: {
    marginBottom: 14,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#161D19",
    borderWidth: 1,
    borderColor: "#232F28",
  },
  chipActive: {
    backgroundColor: "#1A3324",
    borderColor: "#22C55E",
  },
  chipText: {
    fontSize: 13,
    color: "#8E9B94",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: "#141A17",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F2823",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: 160,
  },
  cardRating: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(11, 15, 13, 0.8)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  ratingText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cardBody: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: "#1B2A21",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#22C55E",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    color: "#8E9B94",
  },
  descText: {
    fontSize: 13,
    color: "#6B7C72",
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1F2823",
  },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  priceSub: {
    fontSize: 12,
    color: "#8E9B94",
    fontWeight: "400",
  },
  bookBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B0F0D",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131915",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#1F2B22",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E9B94",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#18201B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#25332A",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  catPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#18201B",
    borderWidth: 1,
    borderColor: "#25332A",
  },
  catChipActive: {
    backgroundColor: "#1A3324",
    borderColor: "#22C55E",
  },
  catChipText: {
    fontSize: 12,
    color: "#8E9B94",
  },
  catChipTextActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B0F0D",
  },
});
