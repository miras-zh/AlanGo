# Alan Go — Mobile Design System

## 1. Design philosophy

Alan Go uses a premium Dark Sports UI.

Core principles:

- Dark and modern
- Compact and functional
- Sport-focused
- Minimal visual noise
- Consistent Liquid Glass effects
- Strong contrast and readable content

All new screens must follow this design system.

## 2. Color tokens

```ts
export const colors = {
  background: "#080D0B",
  surface: "#121A16",
  surfaceElevated: "#1C2722",

  primary: "#00C968",
  primaryGlow: "#12F27B",

  accent: "#F04452",

  textPrimary: "#F7FAF8",
  textSecondary: "#87978F",

  border: "#26382F",
  glassBorder: "rgba(255,255,255,0.12)",
  glassBackground: "rgba(28,39,34,0.72)",

  success: "#00C968",
  error: "#F04452",
};
```

Use semantic tokens instead of hardcoded colors inside components.

## 3. Typography

Use the project's existing font family, preferably the native system font unless another font is already established.

Suggested sizes:

- Screen title: 28px / Bold
- Section title: 20px / Semibold
- Card title: 16px / Semibold
- Body: 14px / Regular
- Caption: 12px / Regular
- Button: 14–16px / Semibold

## 4. Spacing

Use a consistent 4px spacing scale.

- Screen horizontal padding: 16px
- Card spacing: 12px
- Section spacing: 20px
- Compact internal spacing: 8px
- Icon spacing: 6px

## 5. Border radius

- Small chips: 12px
- Buttons: 14px
- Cards: 18px
- Modals: 24px
- Floating navigation: 28px

## 6. Liquid Glass

Apply glass effects selectively to:

- Bottom navigation
- Filter modal
- Floating buttons
- Search overlays
- Selected interactive controls

Use translucent backgrounds, subtle borders, backdrop blur where supported, and restrained highlights.

Avoid applying expensive blur effects to every card.

Provide a performant fallback for devices that do not support native blur.

## 7. Buttons

Primary button:

- Green background
- Dark text
- Rounded corners
- Minimum touch target: 44 × 44 points

Secondary button:

- Dark elevated surface
- Light text
- Subtle border

Destructive button:

- Red accent
- Clear confirmation when required

## 8. Venue cards

Cards should prioritize:

1. Photo
2. Name
3. Rating
4. Location
5. Price
6. Primary action

Use consistent image ratios and avoid unnecessary text.

## 9. Bottom navigation

Five tabs:

- Главная
- Залы
- События
- Чат
- Профиль

Active state uses green.

Inactive states use muted gray.

Navigation must respect safe areas and remain visually consistent throughout the app.

## 10. Agent rules

Every coding agent must:

- Read this document before implementing UI.
- Reuse design tokens.
- Reuse shared components.
- Avoid introducing new arbitrary colors.
- Avoid inconsistent spacing or radii.
- Follow the established navigation patterns.
- Keep components responsive.
- Support iOS and Android.
- Maintain accessibility and adequate text contrast.
- Treat reference screenshots as visual guidance, not as a reason to rewrite existing business logic.

If a design requirement conflicts with an existing architectural decision, report the conflict before making a major change.

