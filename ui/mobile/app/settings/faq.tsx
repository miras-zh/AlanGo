import { useState } from "react";
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hapticSelection } from "@/lib/haptics";
import { SUPPORT_EMAIL } from "@/lib/site";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const SECTIONS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Бронирование",
    items: [
      {
        q: "Как забронировать зал?",
        a: "Откройте зал, перейдите во вкладку «Расписание», выберите день, длительность и свободный (яркий) слот, затем нажмите «Забронировать» и подтвердите имя и телефон.",
      },
      {
        q: "Почему некоторые слоты тусклые?",
        a: "Тусклые слоты недоступны: время уже занято другой бронью, выходит за график работы зала или уже прошло.",
      },
      {
        q: "Как отменить или перенести бронь?",
        a: "Свяжитесь с администратором площадки через чат или по телефону из карточки комплекса — он отменит или перенесёт бронь.",
      },
    ],
  },
  {
    title: "Оплата",
    items: [
      {
        q: "Как оплатить аренду?",
        a: "Сейчас оплата производится на месте у администратора площадки. Сумма брони рассчитывается по тарифу зала и показывается до подтверждения.",
      },
    ],
  },
  {
    title: "Бизнес-аккаунт",
    items: [
      {
        q: "Как сдавать свой зал в аренду?",
        a: "Профиль → «Создать бизнес-аккаунт». Пройдите 5 шагов: формат, название, виды спорта и город. Затем добавьте залы, фото, цены и график.",
      },
      {
        q: "У каждого зала свой график?",
        a: "Да. В бизнес-кабинете на карточке зала нажмите «Настроить график» или выберите зал во вкладке «График». Можно скопировать график на все залы.",
      },
      {
        q: "Можно ли временно скрыть площадку?",
        a: "Да: Профиль → «Отключить бизнес-аккаунт». Площадка пропадёт из каталога, а все данные сохранятся — включить можно в любой момент.",
      },
    ],
  },
];

export default function FaqScreen() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          hitSlop={10}
          onPress={() => {
            hapticSelection();
            // After a reload the stack can be empty; fall back to the parent screen.
            if (router.canGoBack()) router.back();
            else router.replace("/settings");
          }}
        >
          <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Частые вопросы</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => {
                const expanded = open === item.q;
                return (
                  <Pressable
                    key={item.q}
                    style={[styles.item, i < section.items.length - 1 && styles.divider]}
                    onPress={() => {
                      hapticSelection();
                      LayoutAnimation.easeInEaseOut();
                      setOpen(expanded ? null : item.q);
                    }}
                  >
                    <View style={styles.qRow}>
                      <Text style={styles.q}>{item.q}</Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={c.textSecondary}
                      />
                    </View>
                    {expanded ? <Text style={styles.a}>{item.a}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.footer}>Не нашли ответ? Напишите нам: {SUPPORT_EMAIL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  headerTitle: {
    ...typography.sectionTitle,
    fontWeight: "800",
    color: c.textPrimary,
  },
  scroll: {
    padding: spacing.screenHorizontal,
    paddingBottom: spacing.xxl * 2,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: c.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.section,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  item: {
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  qRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  q: {
    ...typography.cardTitle,
    color: c.textPrimary,
    flex: 1,
  },
  a: {
    ...typography.body,
    color: c.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  footer: {
    ...typography.caption,
    color: c.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
