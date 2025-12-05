# Design System Implementation Guide

## Overview

This document outlines the complete design system foundation required before implementing the Autonomous Portfolio Manager dashboard components. The design system is based on the Figma design and creates a consistent, reusable foundation for all UI components.

---

## 📋 Implementation Checklist

### Phase 1: Design Tokens (Foundation) ✅ COMPLETE
- [x] Create `_tokens.scss` with all color, spacing, typography, and other design tokens
- [x] Create `_theme.scss` to expose tokens as CSS custom properties
- [x] Update `_variables.scss` to integrate new tokens
- [x] Update `index.scss` to forward all new files
- [x] Update global styles with dark theme
- [x] Load Inter and JetBrains Mono fonts
- [x] Clean up legacy variables
- [x] Verify compilation and functionality

### Phase 2: Typography System ✅ COMPLETE
- [x] Create `_fonts.scss` and load Inter font family
- [x] Load JetBrains Mono for monospace/code elements
- [x] Create `_typography.scss` with all typography mixins
- [x] Test font loading and rendering
- [x] Remove duplicate text-truncate mixin from _mixins.scss
- [x] Fix breakpoint mixin references
- [x] Verify compilation and functionality

### Phase 3: Component Base Styles ✅ COMPLETE
- [x] Create `_components.scss` with reusable component mixins
- [x] Create card mixin (glassmorphism style)
- [x] Create badge mixins (BUY/SELL/HOLD variants)
- [x] Create progress bar mixin
- [x] Create button variant mixins
- [x] Create tag pill mixin
- [x] Create status pill mixins
- [x] Create log icon container mixins
- [x] Create custom scrollbar mixin
- [x] Create rationale box mixin
- [x] Add layout helpers and utilities
- [x] Update index.scss to forward components
- [x] Verify compilation

### Phase 4: Icon System ✅ COMPLETE
- [x] Extract SVG icons from Figma design (placeholder SVGs added)
- [x] Create `custom-icons.ts` with all icon definitions
- [x] Create `IconComponent` wrapper for custom icons
- [x] Export icon component and types
- [x] Create icon type definitions
- [x] Add 30+ custom SVG icons
- [x] Support both Material and custom icons
- [x] Fix naming conflicts with Material Icons
- [x] Add accessibility support
- [x] Verify compilation

### Phase 5: Global Styles ✅ COMPLETE  
- [x] Update `client/src/styles.scss` with dark theme
- [x] Apply global typography settings
- [x] Set up CSS custom property usage
- [x] Create custom Material theme overrides
- [x] Override Material card backgrounds
- [x] Override Material toolbar colors
- [x] Override Material button styles
- [x] Override Material form field styles
- [x] Apply dark theme to all Material components
- [x] Verify compilation

### Phase 6: Utility Classes ✅ COMPLETE
- [x] Create `_utilities.scss` with spacing utilities
- [x] Add text color utilities
- [x] Add display/layout utilities
- [x] Add common state utilities
- [x] Add flex/grid utilities
- [x] Add gap utilities
- [x] Add border utilities
- [x] Add shadow utilities
- [x] Add transition utilities
- [x] Add common patterns
- [x] Update index.scss to forward utilities
- [x] Verify compilation

### Phase 7: Base Components ✅ COMPLETE
- [x] Create `BadgeComponent` (BUY/SELL/HOLD)
- [x] Create `ProgressBarComponent` (confidence meter)
- [x] Create `TagPillComponent` (category tags)
- [x] Update existing `ButtonComponent` with new variants (optional)

### Phase 8: Type Definitions ✅ COMPLETE
- [x] Create `design-tokens.ts` with token types
- [x] Create `badge-config.ts` with badge types
- [x] Create icon name types (integrated in `custom-icons.ts` as `CustomIconName`)
- [x] Update exports in `index.ts`

---

## 1. Design Tokens

Design tokens are the atomic values that make up the design system. They ensure consistency and make theme changes easy.

### File Structure

```
libs/styles/src/lib/scss/
├── _tokens.scss         ← NEW: All design tokens
├── _theme.scss          ← NEW: CSS custom properties
├── _fonts.scss          ← NEW: Font imports
├── _typography.scss     ← NEW: Typography mixins
├── _components.scss     ← NEW: Component base mixins
├── _utilities.scss      ← NEW: Utility classes
├── _variables.scss      ← UPDATE: Non-token variables
├── _mixins.scss         ← UPDATE: Add new mixins
└── index.scss           ← UPDATE: Forward all new files
```

---

## 2. Color System

### 2.1 Color Tokens

Create `libs/styles/src/lib/scss/_tokens.scss`:

```scss
// ============================================================================
// DESIGN TOKENS
// ============================================================================
// These tokens define the core values of the design system.
// They map directly to the Figma design specifications.
// ============================================================================

// === BACKGROUND COLORS ===
$color-bg-primary: #09090b;           // zinc-950 - Main app background
$color-bg-secondary: #18181b;         // zinc-900 - Secondary surfaces
$color-bg-tertiary: #27272a;          // zinc-800 - Tertiary surfaces
$color-bg-overlay: rgba(0, 0, 0, 0.5); // Modal/overlay background
$color-bg-card: rgba(24, 24, 27, 0.5); // Card background (glassmorphism)
$color-bg-elevated: rgba(9, 9, 11, 0.8); // Elevated surfaces (header)

// === TEXT COLORS ===
$color-text-primary: #ffffff;         // Primary text
$color-text-secondary: #f4f4f5;       // zinc-100 - Secondary text
$color-text-tertiary: #e4e4e7;        // zinc-200 - Tertiary text
$color-text-muted: #d4d4d8;           // zinc-300 - Muted text
$color-text-disabled: #9f9fa9;        // Disabled text
$color-text-subtle: #71717b;          // Subtle/helper text
$color-text-faint: #52525c;           // Faint text (timestamps, versions)

// === BORDER COLORS ===
$color-border-primary: #27272a;       // zinc-800 - Primary borders
$color-border-secondary: #3f3f46;     // zinc-700 - Secondary borders
$color-border-subtle: rgba(39, 39, 42, 0.5); // Subtle borders

// === AI/BRAND COLORS ===
$color-ai-primary: #a684ff;           // Main AI accent color
$color-ai-secondary: #8e51ff;         // Secondary AI accent
$color-ai-glow: rgba(142, 81, 255, 0.3); // AI glow effect
$color-ai-bg: rgba(142, 81, 255, 0.1); // AI background tint
$color-ai-text: #ddd6ff;              // AI-tinted text (reasoning logs)

// === STATUS COLORS ===
$color-success: #00d492;              // Success/positive
$color-success-light: #5ee9b5;        // Light success variant
$color-error: #ff637e;                // Error/negative
$color-warning: #ffd230;              // Warning
$color-caution: #ffb900;              // Caution (hold)
$color-info: #2196f3;                 // Info

// === ACTION BADGE COLORS ===
// BUY Badge
$color-buy-bg: rgba(0, 212, 146, 0.1);
$color-buy-border: rgba(0, 212, 146, 0.2);
$color-buy-text: #00d492;

// SELL Badge
$color-sell-bg: rgba(255, 99, 126, 0.1);
$color-sell-border: rgba(255, 99, 126, 0.2);
$color-sell-text: #ff637e;

// HOLD Badge
$color-hold-bg: rgba(254, 154, 0, 0.1);
$color-hold-border: rgba(254, 154, 0, 0.2);
$color-hold-text: #ffb900;

// MONITOR Badge
$color-monitor-bg: rgba(33, 150, 243, 0.1);
$color-monitor-border: rgba(33, 150, 243, 0.2);
$color-monitor-text: #2196f3;

// === TYPOGRAPHY ===
// Font Families
$font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-family-mono: 'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace;

// Font Sizes
$font-size-2xs: 10px;                 // Tag pills
$font-size-xs: 12px;                  // Small text, timestamps
$font-size-sm: 14px;                  // Base body text
$font-size-base: 16px;                // Medium body text
$font-size-md: 18px;                  // Large body text
$font-size-lg: 20px;                  // H3
$font-size-xl: 24px;                  // H2, confidence scores
$font-size-2xl: 30px;                 // H1, large values

// Font Weights
$font-weight-regular: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// Line Heights
$line-height-tight: 1.2;              // Headlines
$line-height-normal: 1.5;             // Body text
$line-height-relaxed: 1.625;          // Rationale text (22.75px / 14px)

// Letter Spacing
$letter-spacing-tight: -0.44px;       // Large headlines
$letter-spacing-normal: -0.15px;      // Body text
$letter-spacing-wide: 0.6px;          // Uppercase labels

// === SPACING ===
$spacing-xxs: 2px;
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 12px;
$spacing-base: 16px;
$spacing-lg: 20px;
$spacing-xl: 24px;
$spacing-2xl: 32px;
$spacing-3xl: 48px;

// Specific Component Spacing
$spacing-card-padding: 24px;
$spacing-log-entry-gap: 12px;
$spacing-header-padding: 16px;

// === BORDER RADIUS ===
$radius-sm: 8px;                      // Buttons, badges
$radius-md: 10px;                     // Rationale boxes
$radius-lg: 14px;                     // Cards, panels
$radius-pill: 9999px;                 // Status pills, progress bars

// === SHADOWS & ELEVATION ===
$shadow-none: none;
$shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
$shadow-md: 0 4px 6px -4px rgba(0, 0, 0, 0.1);
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
$shadow-xl: 0 10px 20px rgba(0, 0, 0, 0.15);
$shadow-ai: 0 10px 15px -3px rgba(142, 81, 255, 0.2), 0 4px 6px -4px rgba(142, 81, 255, 0.2);

// === TRANSITIONS & ANIMATIONS ===
$transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-base: 300ms cubic-bezier(0.4, 0, 0.2, 1);
$transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);

$easing-default: cubic-bezier(0.4, 0, 0.2, 1);
$easing-in: cubic-bezier(0.4, 0, 1, 1);
$easing-out: cubic-bezier(0, 0, 0.2, 1);

// === LAYOUT ===
$max-width-container: 1200px;
$max-width-narrow: 800px;
$max-width-wide: 1600px;

// === Z-INDEX SCALE ===
$z-index-dropdown: 1000;
$z-index-sticky: 1020;
$z-index-fixed: 1030;
$z-index-modal-backdrop: 1040;
$z-index-modal: 1050;
$z-index-popover: 1060;
$z-index-tooltip: 1070;

// === COMPONENT-SPECIFIC TOKENS ===
// Progress Bar
$progress-bar-height: 6px;
$progress-bar-height-lg: 8px;

// Badge
$badge-padding-y: 3px;
$badge-padding-x: 9px;
$badge-font-size: $font-size-xs;

// Tag Pill
$tag-padding-y: 4.5px;
$tag-padding-x: 8px;
$tag-font-size: $font-size-2xs;

// Header
$header-height: 65px;

// Summary Card
$summary-card-height: 150px;

// Icon Sizes
$icon-size-xs: 12px;
$icon-size-sm: 16px;
$icon-size-base: 20px;
$icon-size-md: 24px;
$icon-size-lg: 32px;
```

---

### 2.2 CSS Custom Properties

Create `libs/styles/src/lib/scss/_theme.scss`:

```scss
// ============================================================================
// THEME - CSS CUSTOM PROPERTIES
// ============================================================================
// Exposes design tokens as CSS custom properties for runtime access.
// Components should use var(--property-name) to access these values.
// ============================================================================

@use './tokens' as *;

:root {
  // === BACKGROUND COLORS ===
  --color-bg-primary: #{$color-bg-primary};
  --color-bg-secondary: #{$color-bg-secondary};
  --color-bg-tertiary: #{$color-bg-tertiary};
  --color-bg-overlay: #{$color-bg-overlay};
  --color-bg-card: #{$color-bg-card};
  --color-bg-elevated: #{$color-bg-elevated};

  // === TEXT COLORS ===
  --color-text-primary: #{$color-text-primary};
  --color-text-secondary: #{$color-text-secondary};
  --color-text-tertiary: #{$color-text-tertiary};
  --color-text-muted: #{$color-text-muted};
  --color-text-disabled: #{$color-text-disabled};
  --color-text-subtle: #{$color-text-subtle};
  --color-text-faint: #{$color-text-faint};

  // === BORDER COLORS ===
  --color-border-primary: #{$color-border-primary};
  --color-border-secondary: #{$color-border-secondary};
  --color-border-subtle: #{$color-border-subtle};

  // === AI/BRAND COLORS ===
  --color-ai-primary: #{$color-ai-primary};
  --color-ai-secondary: #{$color-ai-secondary};
  --color-ai-glow: #{$color-ai-glow};
  --color-ai-bg: #{$color-ai-bg};
  --color-ai-text: #{$color-ai-text};

  // === STATUS COLORS ===
  --color-success: #{$color-success};
  --color-success-light: #{$color-success-light};
  --color-error: #{$color-error};
  --color-warning: #{$color-warning};
  --color-caution: #{$color-caution};
  --color-info: #{$color-info};

  // === ACTION BADGE COLORS ===
  --color-buy-bg: #{$color-buy-bg};
  --color-buy-border: #{$color-buy-border};
  --color-buy-text: #{$color-buy-text};

  --color-sell-bg: #{$color-sell-bg};
  --color-sell-border: #{$color-sell-border};
  --color-sell-text: #{$color-sell-text};

  --color-hold-bg: #{$color-hold-bg};
  --color-hold-border: #{$color-hold-border};
  --color-hold-text: #{$color-hold-text};

  --color-monitor-bg: #{$color-monitor-bg};
  --color-monitor-border: #{$color-monitor-border};
  --color-monitor-text: #{$color-monitor-text};

  // === TYPOGRAPHY ===
  --font-family-primary: #{$font-family-primary};
  --font-family-mono: #{$font-family-mono};

  --font-size-2xs: #{$font-size-2xs};
  --font-size-xs: #{$font-size-xs};
  --font-size-sm: #{$font-size-sm};
  --font-size-base: #{$font-size-base};
  --font-size-md: #{$font-size-md};
  --font-size-lg: #{$font-size-lg};
  --font-size-xl: #{$font-size-xl};
  --font-size-2xl: #{$font-size-2xl};

  --font-weight-regular: #{$font-weight-regular};
  --font-weight-medium: #{$font-weight-medium};
  --font-weight-semibold: #{$font-weight-semibold};
  --font-weight-bold: #{$font-weight-bold};

  --line-height-tight: #{$line-height-tight};
  --line-height-normal: #{$line-height-normal};
  --line-height-relaxed: #{$line-height-relaxed};

  --letter-spacing-tight: #{$letter-spacing-tight};
  --letter-spacing-normal: #{$letter-spacing-normal};
  --letter-spacing-wide: #{$letter-spacing-wide};

  // === SPACING ===
  --spacing-xxs: #{$spacing-xxs};
  --spacing-xs: #{$spacing-xs};
  --spacing-sm: #{$spacing-sm};
  --spacing-md: #{$spacing-md};
  --spacing-base: #{$spacing-base};
  --spacing-lg: #{$spacing-lg};
  --spacing-xl: #{$spacing-xl};
  --spacing-2xl: #{$spacing-2xl};
  --spacing-3xl: #{$spacing-3xl};

  --spacing-card-padding: #{$spacing-card-padding};
  --spacing-log-entry-gap: #{$spacing-log-entry-gap};
  --spacing-header-padding: #{$spacing-header-padding};

  // === BORDER RADIUS ===
  --radius-sm: #{$radius-sm};
  --radius-md: #{$radius-md};
  --radius-lg: #{$radius-lg};
  --radius-pill: #{$radius-pill};

  // === SHADOWS ===
  --shadow-none: #{$shadow-none};
  --shadow-sm: #{$shadow-sm};
  --shadow-md: #{$shadow-md};
  --shadow-lg: #{$shadow-lg};
  --shadow-xl: #{$shadow-xl};
  --shadow-ai: #{$shadow-ai};

  // === TRANSITIONS ===
  --transition-fast: #{$transition-fast};
  --transition-base: #{$transition-base};
  --transition-slow: #{$transition-slow};

  // === LAYOUT ===
  --max-width-container: #{$max-width-container};
  --max-width-narrow: #{$max-width-narrow};
  --max-width-wide: #{$max-width-wide};

  // === Z-INDEX ===
  --z-index-dropdown: #{$z-index-dropdown};
  --z-index-sticky: #{$z-index-sticky};
  --z-index-fixed: #{$z-index-fixed};
  --z-index-modal-backdrop: #{$z-index-modal-backdrop};
  --z-index-modal: #{$z-index-modal};
  --z-index-popover: #{$z-index-popover};
  --z-index-tooltip: #{$z-index-tooltip};

  // === COMPONENT-SPECIFIC ===
  --progress-bar-height: #{$progress-bar-height};
  --progress-bar-height-lg: #{$progress-bar-height-lg};
  --badge-padding-y: #{$badge-padding-y};
  --badge-padding-x: #{$badge-padding-x};
  --badge-font-size: #{$badge-font-size};
  --tag-padding-y: #{$tag-padding-y};
  --tag-padding-x: #{$tag-padding-x};
  --tag-font-size: #{$tag-font-size};
  --header-height: #{$header-height};
  --summary-card-height: #{$summary-card-height};
  --icon-size-xs: #{$icon-size-xs};
  --icon-size-sm: #{$icon-size-sm};
  --icon-size-base: #{$icon-size-base};
  --icon-size-md: #{$icon-size-md};
  --icon-size-lg: #{$icon-size-lg};
}

// === LIGHT THEME (Future) ===
// Uncomment when light theme is needed
/*
[data-theme='light'] {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  // ... override all colors for light theme
}
*/
```

---

## 3. Typography System

### 3.1 Font Loading

Create `libs/styles/src/lib/scss/_fonts.scss`:

```scss
// ============================================================================
// FONTS
// ============================================================================
// Loads web fonts for the application.
// ============================================================================

// === GOOGLE FONTS (Option 1 - CDN) ===
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

// === LOCAL FONTS (Option 2 - Self-hosted) ===
// Uncomment and add font files to assets/fonts/ if self-hosting

/*
@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/assets/fonts/JetBrainsMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/assets/fonts/JetBrainsMono-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/assets/fonts/JetBrainsMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
*/
```

---

### 3.2 Typography Mixins

Create `libs/styles/src/lib/scss/_typography.scss`:

```scss
// ============================================================================
// TYPOGRAPHY MIXINS
// ============================================================================
// Reusable typography styles based on Figma design specs.
// Use these mixins to ensure consistent text styling across components.
// ============================================================================

@use './tokens' as *;

// === HEADINGS ===

@mixin heading-1 {
  font-family: $font-family-primary;
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  letter-spacing: $letter-spacing-tight;
  color: var(--color-text-primary);
}

@mixin heading-2 {
  font-family: $font-family-primary;
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-primary);
}

@mixin heading-3 {
  font-family: $font-family-primary;
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  color: var(--color-text-primary);
}

// === BODY TEXT ===

@mixin body-large {
  font-family: $font-family-primary;
  font-size: $font-size-base;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-primary);
}

@mixin body-base {
  font-family: $font-family-primary;
  font-size: $font-size-sm;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-tertiary);
}

@mixin body-small {
  font-family: $font-family-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  color: var(--color-text-muted);
}

// === LABELS ===

@mixin label-large {
  font-family: $font-family-primary;
  font-size: $font-size-base;
  font-weight: $font-weight-medium;
  line-height: $line-height-normal;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-primary);
}

@mixin label-medium {
  font-family: $font-family-primary;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  line-height: $line-height-normal;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-secondary);
}

@mixin label-small {
  font-family: $font-family-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  line-height: $line-height-normal;
  color: var(--color-text-subtle);
}

@mixin label-uppercase {
  font-family: $font-family-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  text-transform: uppercase;
  letter-spacing: $letter-spacing-wide;
  color: var(--color-text-subtle);
}

// === NUMERIC VALUES ===

@mixin value-large {
  font-family: $font-family-primary;
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  letter-spacing: 0.4px;
  color: var(--color-text-primary);
}

@mixin value-medium {
  font-family: $font-family-primary;
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  color: var(--color-text-primary);
}

@mixin value-small {
  font-family: $font-family-primary;
  font-size: $font-size-md;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  letter-spacing: $letter-spacing-tight;
  color: var(--color-text-primary);
}

// === MONOSPACE / CODE ===

@mixin code-block {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  color: var(--color-text-tertiary);
}

@mixin timestamp {
  font-family: $font-family-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  color: var(--color-text-faint);
}

// === SPECIAL TEXT STYLES ===

@mixin text-rationale {
  font-family: $font-family-primary;
  font-size: $font-size-sm;
  font-weight: $font-weight-regular;
  line-height: $line-height-relaxed;
  letter-spacing: $letter-spacing-normal;
  color: var(--color-text-muted);
}

@mixin text-ai-reasoning {
  font-family: $font-family-primary;
  font-size: $font-size-sm;
  font-weight: $font-weight-regular;
  line-height: $line-height-normal;
  color: var(--color-ai-text);
}

// === UTILITY MIXINS ===

@mixin text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin text-truncate-lines($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## 4. Component Base Styles

Create `libs/styles/src/lib/scss/_components.scss`:

```scss
// ============================================================================
// COMPONENT BASE STYLES
// ============================================================================
// Reusable mixins for common component patterns.
// These provide consistent styling for cards, badges, buttons, etc.
// ============================================================================

@use './tokens' as *;

// === CARD VARIANTS ===

@mixin card-base {
  background-color: var(--color-bg-card);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color var(--transition-base);

  &:hover {
    border-color: var(--color-border-secondary);
  }
}

@mixin card-solid {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

@mixin card-elevated {
  @include card-base;
  box-shadow: var(--shadow-lg);
}

@mixin glassmorphism {
  background-color: var(--color-bg-card);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--color-border-primary);
}

// === BADGE VARIANTS ===

@mixin badge-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--badge-padding-y) var(--badge-padding-x);
  border-radius: var(--radius-sm);
  font-size: var(--badge-font-size);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  border: 1px solid transparent;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

@mixin badge-buy {
  @include badge-base;
  background-color: var(--color-buy-bg);
  border-color: var(--color-buy-border);
  color: var(--color-buy-text);
}

@mixin badge-sell {
  @include badge-base;
  background-color: var(--color-sell-bg);
  border-color: var(--color-sell-border);
  color: var(--color-sell-text);
}

@mixin badge-hold {
  @include badge-base;
  background-color: var(--color-hold-bg);
  border-color: var(--color-hold-border);
  color: var(--color-hold-text);
}

@mixin badge-monitor {
  @include badge-base;
  background-color: var(--color-monitor-bg);
  border-color: var(--color-monitor-border);
  color: var(--color-monitor-text);
}

// === TAG PILLS ===

@mixin tag-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--tag-padding-y) var(--tag-padding-x);
  border-radius: var(--radius-pill);
  font-size: var(--tag-font-size);
  font-weight: var(--font-weight-regular);
  line-height: 1;
  letter-spacing: 0.12px;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-disabled);
  white-space: nowrap;
}

// === PROGRESS BAR ===

@mixin progress-bar-container {
  width: 100%;
  height: var(--progress-bar-height);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-pill);
  overflow: hidden;
  position: relative;
}

@mixin progress-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-ai-primary),
    var(--color-ai-secondary)
  );
  border-radius: inherit;
  transition: width var(--transition-base);
}

// === STATUS PILLS ===

@mixin status-pill($size: 12px) {
  width: $size;
  height: $size;
  border-radius: 50%;
  display: inline-block;
}

@mixin status-pill-active {
  @include status-pill;
  background-color: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

@mixin status-pill-idle {
  @include status-pill;
  background-color: var(--color-text-subtle);
}

@mixin status-pill-warning {
  @include status-pill;
  background-color: var(--color-warning);
  box-shadow: 0 0 8px var(--color-warning);
}

// === BUTTONS ===

@mixin button-primary {
  background-color: var(--color-ai-primary);
  color: var(--color-text-primary);
  border: none;
  padding: $spacing-sm $spacing-base;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background-color: var(--color-ai-secondary);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@mixin button-ghost {
  background-color: transparent;
  color: var(--color-text-disabled);
  border: none;
  padding: $spacing-sm $spacing-base;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-tertiary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@mixin button-secondary {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-secondary);
  padding: $spacing-sm $spacing-base;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-border-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// === LOG ENTRY ICON CONTAINERS ===

@mixin log-icon-base {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

@mixin log-icon-info {
  @include log-icon-base;
  // No background for info icons
}

@mixin log-icon-reasoning {
  @include log-icon-base;
  background-color: var(--color-ai-bg);
  box-shadow: 0 0 0 1px var(--color-ai-glow);
  padding: 4px;
}

@mixin log-icon-success {
  @include log-icon-base;
  color: var(--color-success-light);
}

@mixin log-icon-warning {
  @include log-icon-base;
  color: var(--color-warning);
}

@mixin log-icon-error {
  @include log-icon-base;
  color: var(--color-error);
}

// === SCROLLBAR ===

@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-bg-tertiary);
    border-radius: 4px;

    &:hover {
      background: var(--color-border-secondary);
    }
  }

  // Firefox
  scrollbar-width: thin;
  scrollbar-color: var(--color-bg-tertiary) var(--color-bg-secondary);
}

// === RATIONALE BOX ===

@mixin rationale-box {
  background-color: rgba(9, 9, 11, 0.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: 13px;
}
```

---

## 5. Updated Mixins

Update `libs/styles/src/lib/scss/_mixins.scss` to include existing + new mixins:

```scss
@use './tokens' as *;

// === EXISTING MIXINS (Keep these) ===

// Mixin: Centered Container
@mixin container-center($max-width: $max-width-container, $padding: $spacing-xl) {
  max-width: $max-width;
  margin: 0 auto;
  padding: $padding;
  width: 100%;
  box-sizing: border-box;
}

// Mixin: Flexbox Column Layout
@mixin flex-column($gap: $spacing-base) {
  display: flex;
  flex-direction: column;
  gap: $gap;
}

// Mixin: Flexbox Row Layout
@mixin flex-row($gap: $spacing-base, $align: center) {
  display: flex;
  flex-direction: row;
  align-items: $align;
  gap: $gap;
}

// Mixin: Standard Border
@mixin border($color: $color-border-primary, $width: 1px, $radius: $radius-sm) {
  border: $width solid $color;
  border-radius: $radius;
}

// Mixin: Responsive Breakpoint
@mixin respond-to($breakpoint) {
  @if $breakpoint == 'sm' {
    @media (min-width: 600px) { @content; }
  }
  @else if $breakpoint == 'md' {
    @media (min-width: 960px) { @content; }
  }
  @else if $breakpoint == 'lg' {
    @media (min-width: 1280px) { @content; }
  }
  @else if $breakpoint == 'xl' {
    @media (min-width: 1920px) { @content; }
  }
}

// Mixin: Reset button styles
@mixin button-reset {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

// === NEW MIXINS ===

// Mixin: Flex space-between
@mixin flex-between($align: center) {
  display: flex;
  justify-content: space-between;
  align-items: $align;
}

// Mixin: Absolute positioning helper
@mixin absolute-cover {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

// Mixin: Focus visible styles
@mixin focus-visible {
  outline: 2px solid var(--color-ai-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

// Mixin: Hover lift effect
@mixin hover-lift {
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
}
```

---

## 6. Utility Classes (Optional)

Create `libs/styles/src/lib/scss/_utilities.scss`:

```scss
// ============================================================================
// UTILITY CLASSES
// ============================================================================
// Common utility classes for rapid development.
// Use sparingly - prefer semantic classes in most cases.
// ============================================================================

@use './tokens' as *;

// === SPACING UTILITIES ===

// Margin
.mt-xs { margin-top: var(--spacing-xs); }
.mt-sm { margin-top: var(--spacing-sm); }
.mt-md { margin-top: var(--spacing-md); }
.mt-base { margin-top: var(--spacing-base); }
.mt-lg { margin-top: var(--spacing-lg); }
.mt-xl { margin-top: var(--spacing-xl); }

.mb-xs { margin-bottom: var(--spacing-xs); }
.mb-sm { margin-bottom: var(--spacing-sm); }
.mb-md { margin-bottom: var(--spacing-md); }
.mb-base { margin-bottom: var(--spacing-base); }
.mb-lg { margin-bottom: var(--spacing-lg); }
.mb-xl { margin-bottom: var(--spacing-xl); }

// Padding
.p-xs { padding: var(--spacing-xs); }
.p-sm { padding: var(--spacing-sm); }
.p-md { padding: var(--spacing-md); }
.p-base { padding: var(--spacing-base); }
.p-lg { padding: var(--spacing-lg); }
.p-xl { padding: var(--spacing-xl); }
.p-card { padding: var(--spacing-card-padding); }

// === TEXT COLOR UTILITIES ===
.text-primary { color: var(--color-text-primary); }
.text-secondary { color: var(--color-text-secondary); }
.text-muted { color: var(--color-text-muted); }
.text-subtle { color: var(--color-text-subtle); }
.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.text-warning { color: var(--color-warning); }
.text-ai { color: var(--color-ai-primary); }

// === DISPLAY UTILITIES ===
.flex { display: flex; }
.flex-column { @include flex-column; }
.flex-row { @include flex-row; }
.flex-between { @include flex-between; }
.flex-center { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
}

// === VISIBILITY ===
.hidden { display: none; }
.visible { display: block; }

// === FULL WIDTH ===
.w-full { width: 100%; }
.h-full { height: 100%; }
```

---

## 7. Update Index File

Update `libs/styles/src/lib/scss/index.scss`:

```scss
// ============================================================================
// STYLES LIBRARY - MAIN ENTRY POINT
// ============================================================================
// Import order matters - tokens and theme must come first.
// ============================================================================

// 1. Load fonts first
@forward './fonts';

// 2. Load design tokens
@forward './tokens';

// 3. Load theme (CSS custom properties)
@forward './theme';

// 4. Load typography
@forward './typography';

// 5. Load component base styles
@forward './components';

// 6. Load existing mixins and variables
@forward './variables';
@forward './mixins';

// 7. Load utilities (optional)
@forward './utilities';
```

---

## 8. Icon System

### 8.1 Custom Icons TypeScript

Create `libs/styles/src/lib/constants/custom-icons.ts`:

```typescript
/**
 * Custom SVG icons extracted from Figma design.
 * These are used throughout the application for consistent iconography.
 * 
 * Usage:
 * ```typescript
 * import { CUSTOM_ICONS, CustomIconName } from '@frontend/styles';
 * 
 * const iconSvg = CUSTOM_ICONS['brain'];
 * ```
 */

export const CUSTOM_ICONS = {
  // === AGENT / AI ICONS ===
  brain: `<svg><!-- TODO: Extract from Figma --></svg>`,
  sparkle: `<svg><!-- TODO: Extract from Figma --></svg>`,
  cpu: `<svg><!-- TODO: Extract from Figma --></svg>`,

  // === STATUS / TRENDING ICONS ===
  trendingUp: `<svg><!-- TODO: Extract from Figma --></svg>`,
  trendingDown: `<svg><!-- TODO: Extract from Figma --></svg>`,
  
  // === TOOL ICONS ===
  news: `<svg><!-- TODO: Extract from Figma --></svg>`,
  chart: `<svg><!-- TODO: Extract from Figma --></svg>`,
  shield: `<svg><!-- TODO: Extract from Figma --></svg>`,
  
  // === NAVIGATION ICONS ===
  dashboard: `<svg><!-- TODO: Extract from Figma --></svg>`,
  portfolio: `<svg><!-- TODO: Extract from Figma --></svg>`,
  settings: `<svg><!-- TODO: Extract from Figma --></svg>`,
  
  // === ACTION ICONS ===
  arrowRight: `<svg><!-- TODO: Extract from Figma --></svg>`,
  play: `<svg><!-- TODO: Extract from Figma --></svg>`,
  
  // === LOG ENTRY ICONS ===
  info: `<svg><!-- TODO: Extract from Figma --></svg>`,
  checkmark: `<svg><!-- TODO: Extract from Figma --></svg>`,
  warning: `<svg><!-- TODO: Extract from Figma --></svg>`,
  error: `<svg><!-- TODO: Extract from Figma --></svg>`,
} as const;

export type CustomIconName = keyof typeof CUSTOM_ICONS;

/**
 * Get an icon SVG string by name
 */
export function getIcon(name: CustomIconName): string {
  return CUSTOM_ICONS[name];
}
```

---

### 8.2 Icon Component

Create `libs/styles/src/lib/wrappers/icon.component.ts`:

```typescript
import { Component, input, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CustomIconName, CUSTOM_ICONS } from '../constants/custom-icons';

/**
 * IconComponent
 * 
 * Renders custom SVG icons from the design system.
 * Icons are defined in the CUSTOM_ICONS constant and sanitized before rendering.
 * 
 * @example
 * ```html
 * <!-- 16px icon (default) -->
 * <lib-icon name="brain" />
 * 
 * <!-- 24px icon -->
 * <lib-icon name="sparkle" [size]="24" />
 * 
 * <!-- Custom color via CSS -->
 * <lib-icon name="warning" class="text-warning" />
 * ```
 */
@Component({
  selector: 'lib-icon',
  standalone: true,
  template: `
    <span 
      class="icon" 
      [style.--icon-size]="size() + 'px'"
      [innerHTML]="getSafeIconSvg()"
    ></span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-size, 16px);
      height: var(--icon-size, 16px);
      flex-shrink: 0;
      
      ::ng-deep svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
    }
  `]
})
export class IconComponent {
  /**
   * Icon name from the CUSTOM_ICONS constant
   */
  name = input.required<CustomIconName>();

  /**
   * Icon size in pixels (default: 16)
   */
  size = input<number>(16);

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Get the sanitized SVG HTML for the icon
   */
  getSafeIconSvg(): string {
    const svg = CUSTOM_ICONS[this.name()];
    return this.sanitizer.sanitize(SecurityContext.HTML, svg) || '';
  }
}
```

---

## 9. Type Definitions

### 9.1 Design Tokens Types

Create `libs/styles/src/lib/types/design-tokens.ts`:

```typescript
/**
 * Design token type definitions for type-safe styling
 */

export type ColorToken = 
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ai-primary'
  | 'ai-secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'caution'
  | 'info';

export type TextColorToken =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'muted'
  | 'disabled'
  | 'subtle'
  | 'faint';

export type SpacingToken = 
  | 'xxs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

export type TypographyVariant = 
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'body-large'
  | 'body-base'
  | 'body-small'
  | 'label-large'
  | 'label-medium'
  | 'label-small'
  | 'label-uppercase'
  | 'value-large'
  | 'value-medium'
  | 'value-small'
  | 'code-block'
  | 'timestamp';

export type RadiusToken = 'sm' | 'md' | 'lg' | 'pill';

export type ShadowToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'ai';

export type TransitionToken = 'fast' | 'base' | 'slow';
```

---

### 9.2 Badge Config Types

Create `libs/styles/src/lib/types/badge-config.ts`:

```typescript
/**
 * Badge component configuration types
 */

export type BadgeVariant = 'buy' | 'sell' | 'hold' | 'monitor';

export interface BadgeConfig {
  /**
   * Badge variant determines the color scheme
   */
  variant: BadgeVariant;

  /**
   * Badge label text
   */
  label: string;

  /**
   * Optional CSS classes
   */
  cssClass?: string;

  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string;
}
```

---

## 10. Base Components to Create

### 10.1 Badge Component

Create `libs/styles/src/lib/wrappers/badge.component.ts`:

```typescript
import { Component, input } from '@angular/core';
import { BadgeConfig, BadgeVariant } from '../types/badge-config';
import { NgClass } from '@angular/common';

/**
 * BadgeComponent
 * 
 * Displays action recommendation badges (BUY, SELL, HOLD, MONITOR).
 * Uses design system color tokens for consistent styling.
 * 
 * @example
 * ```html
 * <lib-badge [config]="{ variant: 'buy', label: 'BUY' }" />
 * <lib-badge [config]="{ variant: 'hold', label: 'HOLD' }" />
 * ```
 */
@Component({
  selector: 'lib-badge',
  standalone: true,
  imports: [NgClass],
  template: `
    <span 
      class="badge" 
      [ngClass]="'badge--' + config().variant"
      [attr.aria-label]="config().ariaLabel || config().label"
    >
      {{ config().label }}
    </span>
  `,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  config = input.required<BadgeConfig>();
}
```

Create `libs/styles/src/lib/wrappers/badge.component.scss`:

```scss
@use '../scss' as *;

.badge {
  @include badge-base;

  &--buy {
    @include badge-buy;
  }

  &--sell {
    @include badge-sell;
  }

  &--hold {
    @include badge-hold;
  }

  &--monitor {
    @include badge-monitor;
  }
}
```

---

### 10.2 Progress Bar Component

Create `libs/styles/src/lib/wrappers/progress-bar.component.ts`:

```typescript
import { Component, input } from '@angular/core';
import { NgStyle } from '@angular/common';

/**
 * ProgressBarComponent
 * 
 * Displays a horizontal progress bar with gradient fill.
 * Used for confidence meters and other percentage displays.
 * 
 * @example
 * ```html
 * <!-- 87% confidence -->
 * <lib-progress-bar [value]="87" [label]="'Confidence'" />
 * 
 * <!-- Without label -->
 * <lib-progress-bar [value]="65" />
 * ```
 */
@Component({
  selector: 'lib-progress-bar',
  standalone: true,
  imports: [NgStyle],
  template: `
    <div class="progress-bar" [attr.aria-label]="label()">
      <div 
        class="progress-bar__fill" 
        [ngStyle]="{ width: value() + '%' }"
        [attr.role]="'progressbar'"
        [attr.aria-valuenow]="value()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
      ></div>
    </div>
  `,
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  /**
   * Progress value (0-100)
   */
  value = input.required<number>();

  /**
   * Optional aria-label for accessibility
   */
  label = input<string>('Progress');
}
```

Create `libs/styles/src/lib/wrappers/progress-bar.component.scss`:

```scss
@use '../scss' as *;

.progress-bar {
  @include progress-bar-container;

  &__fill {
    @include progress-bar-fill;
  }
}
```

---

### 10.3 Tag Pill Component

Create `libs/styles/src/lib/wrappers/tag-pill.component.ts`:

```typescript
import { Component, input } from '@angular/core';

/**
 * TagPillComponent
 * 
 * Displays category/topic tags (e.g., "Tech", "Growth", "Semiconductors").
 * 
 * @example
 * ```html
 * <lib-tag-pill label="Tech" />
 * <lib-tag-pill label="Growth" />
 * ```
 */
@Component({
  selector: 'lib-tag-pill',
  standalone: true,
  template: `
    <span class="tag-pill">{{ label() }}</span>
  `,
  styleUrl: './tag-pill.component.scss',
})
export class TagPillComponent {
  label = input.required<string>();
}
```

Create `libs/styles/src/lib/wrappers/tag-pill.component.scss`:

```scss
@use '../scss' as *;

.tag-pill {
  @include tag-pill;
}
```

---

## 11. Global Styles Update

Update `client/src/styles.scss`:

```scss
// ============================================================================
// GLOBAL STYLES
// ============================================================================

// Import design system
@use '../libs/styles/src/lib/scss' as *;

// === GLOBAL RESETS ===

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  height: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-family-primary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

// === TYPOGRAPHY DEFAULTS ===

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  font-weight: var(--font-weight-bold);
}

p {
  margin: 0;
}

a {
  color: var(--color-ai-primary);
  text-decoration: none;
  transition: color var(--transition-fast);

  &:hover {
    color: var(--color-ai-secondary);
  }
}

// === FOCUS STYLES ===

*:focus-visible {
  @include focus-visible;
}

// === SCROLLBAR ===

* {
  @include custom-scrollbar;
}

// === MATERIAL OVERRIDES ===
// TODO: Create custom Material theme matching dark design
// For now, import Material theme
@import '@angular/material/prebuilt-themes/indigo-pink.css';

// Override Material colors to match design system
// This is a temporary solution - ideally create a custom Material theme
.mat-mdc-button,
.mat-mdc-raised-button,
.mat-mdc-flat-button {
  font-family: var(--font-family-primary) !important;
}
```

---

## 12. Export Updates

Update `libs/styles/src/index.ts`:

```typescript
// === SCSS Framework ===
// SCSS files are imported via @use in component stylesheets

// === TypeScript Exports ===
export * from './lib/styles';

// Components
export * from './lib/wrappers/button.component';
export * from './lib/wrappers/card.component';
export * from './lib/wrappers/select.component';
export * from './lib/wrappers/table.component';
export * from './lib/wrappers/toolbar.component';
export * from './lib/wrappers/empty-state.component';
export * from './lib/wrappers/input.component';
export * from './lib/wrappers/menu.component';
export * from './lib/wrappers/action-menu.component';
export * from './lib/wrappers/icon.component'; // NEW
export * from './lib/wrappers/badge.component'; // NEW
export * from './lib/wrappers/progress-bar.component'; // NEW
export * from './lib/wrappers/tag-pill.component'; // NEW

// Types
export * from './lib/types/button-config';
export * from './lib/types/input-config';
export * from './lib/types/menu-config';
export * from './lib/types/action-menu-config';
export * from './lib/types/design-tokens'; // NEW
export * from './lib/types/badge-config'; // NEW

// Constants
export * from './lib/constants/material-icons';
export * from './lib/constants/custom-icons'; // NEW
```

---

## 13. Implementation Order

Follow this sequence for smooth implementation:

### Week 1: Foundation
1. ✅ Create `_tokens.scss` with all design tokens
2. ✅ Create `_theme.scss` with CSS custom properties
3. ✅ Create `_fonts.scss` and load Inter font
4. ✅ Create `_typography.scss` with typography mixins
5. ✅ Update `index.scss` to forward all new files
6. ✅ Test: Verify tokens are accessible in a test component

### Week 2: Component Base Styles
7. ✅ Create `_components.scss` with component mixins
8. ✅ Update `_mixins.scss` with new utility mixins
9. ✅ Update global styles in `client/src/styles.scss`
10. ✅ Test: Create a sample card using new mixins

### Week 3: Icon System
11. ✅ Extract SVG icons from Figma (use Figma export)
12. ✅ Create `custom-icons.ts` with icon definitions
13. ✅ Create `IconComponent`
14. ✅ Test: Render all icons in a test page

### Week 4: Base Components
15. ✅ Create `BadgeComponent` with all variants
16. ✅ Create `ProgressBarComponent`
17. ✅ Create `TagPillComponent`
18. ✅ Update type definitions
19. ✅ Update exports in `index.ts`
20. ✅ Test: Create component showcase page

### Week 5+: Complex Components
21. ✅ Build Stock Card component
22. ✅ Build Log Entry component
23. ✅ Build Agent Brain panel
24. ✅ Build Portfolio Summary cards
25. ✅ Build Header/Navigation
26. ✅ Assemble full dashboard

---

## 14. Testing Checklist

After implementing the foundation:

### Visual Tests
- [ ] All color tokens render correctly
- [ ] Inter font loads and displays properly
- [ ] Typography mixins produce correct sizes/weights
- [ ] Badge variants show correct colors
- [ ] Progress bars animate smoothly
- [ ] Icons scale properly at different sizes
- [ ] Dark theme is consistent across all components

### Accessibility Tests
- [ ] All interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] ARIA labels are present where needed
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announces components correctly

### Integration Tests
- [ ] Design tokens can be imported in any component
- [ ] SCSS mixins work in all contexts
- [ ] CSS custom properties override correctly
- [ ] Components work with Angular Material
- [ ] No CSS specificity conflicts

---

## 15. Common Issues & Solutions

### Issue: Fonts Not Loading
**Solution**: Check network tab, ensure font URLs are correct. Consider self-hosting fonts in `assets/fonts/`.

### Issue: CSS Custom Properties Not Working
**Solution**: Ensure `:root` selector is in `_theme.scss` and file is forwarded in `index.scss`.

### Issue: SCSS Import Errors
**Solution**: Use `@use` instead of `@import`. Check that paths use relative paths or configured aliases.

### Issue: Material Theme Conflicts
**Solution**: Create custom Material theme using `mat.define-theme()` with design system colors.

### Issue: Icons Not Rendering
**Solution**: Ensure SVGs are properly sanitized. Check that `innerHTML` binding is allowed in Angular.

---

## 16. Next Steps After Foundation

Once the design system foundation is complete:

1. **Create Storybook** (optional but recommended)
   - Document all components
   - Show all variants
   - Interactive controls

2. **Build Complex Components**
   - Stock Card
   - Log Entry
   - Agent Brain Panel
   - Portfolio Summary

3. **Create Page Layouts**
   - Dashboard Layout
   - Full dashboard assembly

4. **State Management**
   - NgRx stores for portfolio data
   - Real-time log streaming
   - WebSocket integration

5. **Testing**
   - Unit tests for components
   - E2E tests for workflows
   - Visual regression tests

---

## 17. Resources

### Design References
- Figma Component Breakdown: `frontend/figma-component-breakdown.md`
- Design Prompt: `frontend/design_prompt.md`

### Documentation
- [Inter Font](https://fonts.google.com/specimen/Inter)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
- [Angular Material Theming](https://material.angular.io/guide/theming)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

### Tools
- [Figma](https://www.figma.com/) - Extract icons and measurements
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [SVGOMG](https://jakearchibald.github.io/svgomg/) - Optimize SVG icons

---

## Summary

This design system provides:

✅ **Complete color palette** with dark theme  
✅ **Typography system** with Inter font and predefined text styles  
✅ **Spacing scale** from 2px to 48px  
✅ **Component mixins** for cards, badges, buttons, progress bars  
✅ **Icon system** with custom SVG icons  
✅ **Base components** for rapid UI development  
✅ **Type safety** with TypeScript definitions  
✅ **Accessibility** built-in from the start  

The foundation is now ready for building the dashboard components!
