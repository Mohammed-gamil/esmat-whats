# Esmat E-Learning Platform – Design System & Color Palette Specification

This document provides a comprehensive specification of the entire **Color System & Design Tokens** powering the **Esmat** E-Learning Platform. Built on Tailwind CSS v4, dynamic CSS variables, and glassmorphism styling, this color system ensures high visual impact, strict accessibility compliance, and seamless auto-switching between Dark Mode and Light Mode.

---

## 1. Core Brand Color Palette

The primary brand accent is an energetic, high-contrast **Orange** palette (`#f05a28`), giving the platform its distinct academic and tech-forward identity.

| Token | CSS Variable | Hex Code | RGB Equivalent | Purpose & Usage |
| :--- | :--- | :--- | :--- | :--- |
| `brand` | `--color-brand` | `#f05a28` | `rgb(240, 90, 40)` | Primary brand color, CTA buttons, active state highlights, focus rings, scrollbars |
| `brand-light` | `--color-brand-light` | `#ff8c5a` | `rgb(255, 140, 90)` | Hover states for brand elements, gradient endpoints, vibrant accent glow |
| `brand-dark` | `--color-brand-dark` | `#e04d1e` | `rgb(224, 77, 30)` | Pressed/Active button states, dark gradient stops |

### Brand Gradient Patterns
```css
/* Standard Brand Gradient */
background: linear-gradient(to right, #f05a28, #ff8c5a);

/* Brand Glow Shadow */
box-shadow: 0 0 20px rgba(240, 90, 40, 0.35), 0 0 40px rgba(240, 90, 40, 0.15);

/* Selection Highlight */
::selection {
  background: rgba(240, 90, 40, 0.20);
  color: inherit;
}
```

---

## 2. Dynamic Dark/Light Theme System

The application uses dynamic tokens configured in CSS (`:root` and `.dark`), exposed via `@theme inline` in Tailwind CSS v4. Components using dynamic tokens (`bg-page`, `bg-card`, `text-ink`, `text-ink-dim`, `border-rim`) auto-switch themes without requiring explicit `isDark` conditional logic.

| Utility Class | Dynamic Variable | Light Mode (`:root`) | Dark Mode (`.dark`) | Application / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `bg-page` | `--color-page` | `#f9fafb` | `#0a191e` | Main page body & viewport background |
| `bg-card` | `--color-card` | `#ffffff` | `#0d2530` | Container cards, modals, dropdown menus |
| `bg-deep` | `--color-deep` | `#f3f4f6` | `#081419` | Sunken containers, code blocks, sidebar tracks |
| `text-ink` | `--color-ink` | `#0a191e` | `#ffffff` | Primary text headings, body text, high contrast labels |
| `text-ink-dim` | `--color-ink-dim` | `rgba(10, 25, 30, 0.55)` | `rgba(255, 255, 255, 0.50)` | Secondary text, subtitles, meta descriptors, timestamps |
| `border-rim` | `--color-rim` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.08)` | Card borders, dividers, subtle separators |

---

## 3. Fixed Surface Tokens (Dark & Light Modes)

For components requiring explicit, theme-fixed backgrounds (e.g. video player overlays, dark footers, fixed light panels):

### Dark Mode Fixed Surfaces (`@theme`)

| Utility Class | Variable Name | Hex Code | Purpose & Context |
| :--- | :--- | :--- | :--- |
| `bg-surface` | `--color-surface` | `#0a191e` | Base Slate/Navy dark surface |
| `bg-surface-deep` | `--color-surface-deep` | `#081419` | Deepest dark navy surface background |
| `bg-surface-card` | `--color-surface-card` | `#0d2530` | Card container background in dark mode |
| `bg-surface-footer` | `--color-surface-footer` | `#060f13` | Footer & bottom navigation bar background |

### Light Mode Fixed Surfaces

| Utility Class | Variable Name | Hex Code | Purpose & Context |
| :--- | :--- | :--- | :--- |
| `bg-panel-light` | `--color-panel-light` | `#f8f9fa` | Neutral light panel background |

---

## 4. Semantic & Status Colors

Semantic colors provide instant visual feedback across course progress, assessment results, warnings, and badges.

| Category | Tailwind Classes / Hex | Hex Code | Usage Examples |
| :--- | :--- | :--- | :--- |
| **Success / Passed** | `emerald-500`, `emerald-400` | `#10b981` | Quiz pass, 100% video completion, active status, success toast |
| **Warning / Caution** | `amber-500`, `amber-400`, `text-star` | `#f59e0b` | Star ratings (`--color-star`), expiring deadlines, pending verification |
| **Danger / Lockout** | `red-500`, `rose-500` | `#ef4444` / `#e11d48` | Hearts depletion lockout, failed exam, error state, delete action |
| **Info / Interactive** | `cyan-500`, `cyan-400`, `sky-400` | `#06b6d4` / `#0284c7` | Bitrate switcher, active tab indicator, lesson content badge |
| **Primary Accent** | `indigo-600`, `indigo-500` | `#4f46e5` | Certificate badges, academic rank indicators |
| **Special / Category** | `purple-500`, `violet-400` | `#8b5cf6` | Advanced course tag, admin analytics categories |

---

## 5. Analytics & Chart Color Palette

Used in Recharts components (`AnalyticsCharts.tsx`, `ActivityChart.tsx`) for student progress and administrative charts:

| Index | Color Name | Hex Code | Use Case / Feature |
| :---: | :--- | :--- | :--- |
| 0 | Vibrant Blue | `#3b82f6` | Default chart series 1, primary enrollment metric |
| 1 | Purple Accent | `#8b5cf6` | Secondary chart series, quiz performance |
| 2 | Cyan Accent | `#06b6d4` | Bitrate / Streaming analytics |
| 3 | Emerald Green | `#10b981` | Course completion percentage |
| 4 | Amber Yellow | `#f59e0b` | Average time spent / warning metrics |
| 5 | Red Danger | `#ef4444` | Drop-off rate / abandoned assessments |
| 6 | Pink Accent | `#ec4899` | Student engagement indicators |
| 7 | Indigo Blue | `#6366f1` | Cumulative student count |
| 8 | Teal Accent | `#14b8a6` | Category completion distribution |
| 9 | Orange Accent | `#f97316` | Active daily streak highlight |

---

## 6. Glassmorphism & Translucency Tokens

The design system uses backdrop blurs and subtle alpha translucent layers to achieve a modern glass aesthetic.

```css
/* Glass Card Styling */
background: rgba(13, 37, 48, 0.60); /* Dark Glass */
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.08);

/* Light Glass Surface */
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(12px);
border: 1px solid rgba(0, 0, 0, 0.06);
```

| Utility / Pattern | Alpha Level | CSS Definition | Recommended Application |
| :--- | :--- | :--- | :--- |
| `bg-white/5` | 5% | `rgba(255, 255, 255, 0.05)` | Subtle card hover fill |
| `bg-white/10` | 10% | `rgba(255, 255, 255, 0.10)` | Button background, input fields |
| `bg-black/50` | 50% | `rgba(0, 0, 0, 0.50)` | Modal backdrop dark scrim |
| `border-white/10` | 10% | `rgba(255, 255, 255, 0.10)` | Glass card outline |
| `border-brand/20` | 20% | `rgba(240, 90, 40, 0.20)` | Highlighted item border |

---

## 7. Floating WhatsApp Widget Colors

Dedicated brand colors for the interactive float action button:

- **WhatsApp Green**: `#25D366`
- **WhatsApp Dark Teal**: `#128C7E`
- **Pulsing Wave Animation Overlay**: `rgba(37, 211, 102, 0.4)`

---

## 8. Tailwind CSS v4 Configuration & Design Token Code

Below is the `@theme` and `@theme inline` snippet from `src/index.css`:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

/* Static tokens */
@theme {
  --color-brand: #f05a28;
  --color-brand-light: #ff8c5a;
  --color-brand-dark: #e04d1e;

  --color-surface: #0a191e;
  --color-surface-deep: #081419;
  --color-surface-footer: #060f13;
  --color-surface-card: #0d2530;

  --color-panel-light: #f8f9fa;
  --color-star: #f59e0b;
}

/* Dynamic theme tokens */
:root {
  --dyn-page: #f9fafb;
  --dyn-card: #ffffff;
  --dyn-deep: #f3f4f6;
  --dyn-ink: #0a191e;
  --dyn-muted: rgba(10, 25, 30, 0.55);
  --dyn-rim: rgba(0, 0, 0, 0.08);
}

.dark {
  --dyn-page: #0a191e;
  --dyn-card: #0d2530;
  --dyn-deep: #081419;
  --dyn-ink: #ffffff;
  --dyn-muted: rgba(255, 255, 255, 0.50);
  --dyn-rim: rgba(255, 255, 255, 0.08);
}

@theme inline {
  --color-page: var(--dyn-page);
  --color-card: var(--dyn-card);
  --color-deep: var(--dyn-deep);
  --color-ink: var(--dyn-ink);
  --color-ink-dim: var(--dyn-muted);
  --color-rim: var(--dyn-rim);
}
```

---

## 9. Developer Guidelines & Best Practices

1. **Use Dynamic Tokens First**: Always prefer `bg-page`, `bg-card`, `text-ink`, `text-ink-dim`, and `border-rim` over hardcoded dark/light values so elements support theme switching automatically.
2. **Brand Contrast**: Ensure brand text (`text-brand`) is placed against sufficiently dark or light backgrounds to satisfy WCAG AA 4.5:1 contrast requirements.
3. **Focus States**: Interactive controls MUST maintain visible focus rings using `#f05a28` outline (`focus-visible:outline-brand` or `focus-visible:ring-2 focus-visible:ring-brand`).
4. **No Raw Color Hardcoding**: Do not hardcode ad-hoc hex values in JSX inline styles unless rendering dynamic chart components or canvas graphics. Use the designated CSS tokens.
