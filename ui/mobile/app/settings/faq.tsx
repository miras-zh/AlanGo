import { useState } from "react";
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hapticSelection } from "@/lib/haptics";
import { SUPPORT_EMAIL } from "@/lib/site";
import { useT, type MessageKey } from "@/lib/i18n";
import { radii, spacing, typography } from "@/constants/theme";

import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

const SECTIONS: { title: MessageKey; items: { q: MessageKey; a: MessageKey }[] }[] = [
  {
    title: "faq.booking",
    items: [
      {
        q: "faq.q1",
        a: "faq.a1",
      },
      {
        q: "faq.q2",
        a: "faq.a2",
      },
      {
        q: "faq.q3",
        a: "faq.a3",
      },
    ],
  },
  {
    title: "faq.payment",
    items: [
      {
        q: "faq.q4",
        a: "faq.a4",
      },
    ],
  },
  {
    title: "faq.business",
    items: [
      {
        q: "faq.q5",
        a: "faq.a5",
      },
      {
        q: "faq.q6",
        a: "faq.a6",
      },
      {
        q: "faq.q7",
        a: "faq.a7",
      },
    ],
  },
];

export default function FaqScreen() {
  const t = useT();
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
        <Text style={styles.headerTitle}>{t("faq.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionLabel}>{t(section.title)}</Text>
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
                      <Text style={styles.q}>{t(item.q)}</Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={c.textSecondary}
                      />
                    </View>
                    {expanded ? <Text style={styles.a}>{t(item.a)}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.footer}>{t("faq.footer", { email: SUPPORT_EMAIL })}</Text>
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
