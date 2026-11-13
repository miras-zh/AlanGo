import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useT, type MessageKey } from "@/lib/i18n";
import { hapticSelection } from "@/lib/haptics";
import { isSplashDone, onSplashDone } from "@/components/AnimatedSplashScreen";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/site";
import { radii, spacing } from "@/constants/theme";
import { usePalette, useThemedStyles, type Palette } from "@/theme/palette";

type Slide = {
  id: string;
  title: MessageKey;
  accent: MessageKey;
  subtitle: MessageKey;
  image: ImageSourcePropType;
  // "circle": photo in a glowing circle on the right; "cover": full-card photo.
  layout: "circle" | "cover";
  // Route to open, or "advertise" — an email to the team about ad placement.
  href: Href | "advertise";
};

// Text is rendered from the dictionaries (not baked into the pictures), so it
// follows the selected app language.
const SLIDES: Slide[] = [
  {
    id: "rent",
    title: "banner.rentTitle",
    accent: "banner.rentAccent",
    subtitle: "banner.rentSubtitle",
    image: { uri: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&q=80" },
    layout: "circle",
    href: "/(tabs)/items",
  },
  {
    id: "padel",
    title: "banner.padelTitle",
    accent: "banner.padelAccent",
    subtitle: "banner.padelSubtitle",
    image: require("@/assets/banners/padel.jpg"),
    layout: "circle",
    href: { pathname: "/arenas", params: { sport: "Сквош и падл" } },
  },
  {
    id: "tournaments",
    title: "banner.tournamentsTitle",
    accent: "banner.tournamentsAccent",
    subtitle: "banner.tournamentsSubtitle",
    image: require("@/assets/banners/trophy.jpg"),
    layout: "circle",
    href: "/(tabs)/events",
  },
  {
    id: "badminton",
    title: "banner.badmintonTitle",
    accent: "banner.badmintonAccent",
    subtitle: "banner.badmintonSubtitle",
    image: require("@/assets/banners/badminton.jpg"),
    layout: "circle",
    href: "/(tabs)/items",
  },
  {
    id: "advertise",
    title: "banner.adTitle",
    accent: "banner.adAccent",
    subtitle: "banner.adSubtitle",
    image: require("@/assets/banners/soccer.jpg"),
    layout: "cover",
    href: "advertise",
  },
];

/**
 * Auto-advance slows down each full round of slides:
 * round 1 — every 5 s, round 2 — 10 s, round 3 — 20 s, round 4 onward — 40 s.
 * Counted per app launch.
 */
export function bannerIntervalMs(changesSoFar: number, slideCount = SLIDES.length): number {
  const round = Math.floor(changesSoFar / slideCount);
  if (round === 0) return 5_000;
  if (round === 1) return 10_000;
  if (round === 2) return 20_000;
  return 40_000;
}

const CARD_HEIGHT = 160;

export function HomeBannerSlider() {
  const c = usePalette();
  const styles = useThemedStyles(createStyles);
  const t = useT();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  // Don't spend the first slide's time behind the launch splash.
  const [splashGone, setSplashGone] = useState(isSplashDone());
  // Number of slide changes so far — drives the round-based interval.
  const changes = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => (splashGone ? undefined : onSplashDone(() => setSplashGone(true))), [splashGone]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // One timer per shown slide: re-armed after every change (auto or swipe).
  useEffect(() => {
    if (!width || !focused || !appActive || !splashGone) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      changes.current += 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, bannerIntervalMs(changes.current));
    return () => clearTimeout(timer);
  }, [index, width, focused, appActive, splashGone]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      changes.current += 1;
      setIndex(next);
    }
  };

  return (
    <View style={styles.card} onLayout={onLayout}>
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s) => {
            const cover = s.layout === "cover";
            return (
              <Pressable
                key={s.id}
                style={[styles.slide, { width }]}
                onPress={() => {
                  hapticSelection();
                  if (s.href === "advertise") {
                    const subject = encodeURIComponent(t("banner.adMailSubject", { site: SITE_NAME }));
                    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {});
                  } else {
                    router.push(s.href);
                  }
                }}
              >
                {cover ? (
                  <>
                    <Image source={s.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <View style={[StyleSheet.absoluteFill, styles.coverShade]} />
                  </>
                ) : null}
                <View style={styles.textCol}>
                  <Text
                    style={[styles.title, cover && styles.onImage]}
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {t(s.title)}
                    {"\n"}
                    <Text style={styles.accent}>{t(s.accent)}</Text>
                  </Text>
                  <Text style={[styles.subtitle, cover && styles.onImageSoft]} numberOfLines={2}>
                    {t(s.subtitle)}
                  </Text>
                </View>
                {cover ? null : (
                  <View style={styles.imageWrap}>
                    <Image source={s.image} style={styles.image} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.dots} pointerEvents="none">
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={[styles.dot, { backgroundColor: i === index ? c.primary : c.border }, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const IMAGE_SIZE = 120;

function createStyles(c: Palette) {
  return StyleSheet.create({
    card: {
      height: CARD_HEIGHT,
      backgroundColor: c.surfaceElevated,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: spacing.xs,
      marginBottom: spacing.card,
      overflow: "hidden",
    },
    slide: {
      height: CARD_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: spacing.lg,
      paddingRight: spacing.md,
    },
    textCol: {
      flex: 1,
      paddingRight: spacing.sm,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "900",
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    accent: {
      color: c.primary,
    },
    coverShade: {
      backgroundColor: c.overlay,
    },
    onImage: {
      color: c.onImage,
    },
    onImageSoft: {
      color: c.onImage,
      opacity: 0.85,
    },
    subtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: c.textSecondary,
      marginTop: spacing.xs,
    },
    imageWrap: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: IMAGE_SIZE / 2,
      backgroundColor: c.surface,
      shadowColor: c.primary,
      shadowOpacity: 0.55,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    image: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: IMAGE_SIZE / 2,
    },
    dots: {
      position: "absolute",
      left: spacing.lg,
      bottom: spacing.md,
      flexDirection: "row",
      gap: spacing.xs,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 16,
    },
  });
}
