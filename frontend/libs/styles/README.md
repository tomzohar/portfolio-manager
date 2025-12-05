# Styles Library

A comprehensive design system library providing SCSS tokens, mixins, components, and utilities for the Autonomous Portfolio Manager application.

## 📦 Installation

The styles library is already part of the workspace. Import it in your components:

```typescript
// Import TypeScript exports (components, types, constants)
import { ButtonComponent, BadgeComponent } from '@frontend/styles';

// Import SCSS in component stylesheets
@use '@frontend/styles/scss' as *;
```

## 🎨 Design System

### Phase 1: Foundation (✅ Complete)
### Phase 2: Typography System (✅ Complete)

The design system includes:

#### Design Tokens (`_tokens.scss`)
- **Colors**: Background, text, border, AI/brand, status, and badge colors
- **Typography**: Font families (Inter, JetBrains Mono), sizes, weights, line heights
- **Spacing**: Consistent spacing scale from 2px to 48px
- **Border Radius**: sm (8px), md (10px), lg (14px), pill (9999px)
- **Shadows**: Elevation levels from sm to xl, plus AI-themed shadow
- **Transitions**: Fast (150ms), base (300ms), slow (500ms)
- **Z-Index**: Consistent layering scale

#### Typography Mixins (`_typography.scss`)
20+ typography mixins for consistent text styling:
- **Headings**: heading-1, heading-2, heading-3
- **Body Text**: body-large, body-base, body-small
- **Labels**: label-large, label-medium, label-small, label-uppercase
- **Values**: value-large, value-medium, value-small
- **Special**: code-block, timestamp, text-rationale, text-ai-reasoning
- **Utilities**: text-truncate, text-truncate-lines, text-no-select

#### CSS Custom Properties (`_theme.scss`)
All design tokens are exposed as CSS custom properties:

```scss
// Use in your stylesheets
.my-component {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: var(--font-family-primary);
}
```

### Usage Examples

#### Using Typography Mixins

```scss
@use 'scss' as *;

.stock-card {
  background: var(--color-bg-card);
  padding: var(--spacing-xl);
  
  .ticker {
    @include heading-3;  // 20px bold
  }
  
  .price {
    @include value-small;  // 18px bold
  }
  
  .description {
    @include body-base;  // 14px regular
  }
  
  .rationale {
    @include text-rationale;  // 14px with relaxed line height
  }
  
  .tag {
    @include label-small;  // 12px medium
  }
}
```

#### Using Design Tokens in SCSS

```scss
@use 'scss' as *;

.my-card {
  background-color: $color-bg-card;
  border: 1px solid $color-border-primary;
  border-radius: $radius-lg;
  padding: $spacing-card-padding;
  box-shadow: $shadow-lg;

  h2 {
    font-family: $font-family-primary;
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-text-primary;
  }
}
```

#### Using CSS Custom Properties

```scss
.my-component {
  // These work anywhere, including in style attributes
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  padding: var(--spacing-lg);
  transition: all var(--transition-base);

  &:hover {
    background: var(--color-bg-tertiary);
    transform: translateY(-2px);
  }
}
```

## 📋 Design Token Reference

### Colors

#### Background Colors
- `--color-bg-primary`: #09090b (zinc-950) - Main app background
- `--color-bg-secondary`: #18181b (zinc-900) - Secondary surfaces
- `--color-bg-tertiary`: #27272a (zinc-800) - Tertiary surfaces
- `--color-bg-card`: rgba(24, 24, 27, 0.5) - Glassmorphism cards
- `--color-bg-elevated`: rgba(9, 9, 11, 0.8) - Elevated surfaces

#### Text Colors
- `--color-text-primary`: #ffffff - Primary text
- `--color-text-secondary`: #f4f4f5 - Secondary text
- `--color-text-muted`: #d4d4d8 - Muted text
- `--color-text-subtle`: #71717b - Subtle/helper text
- `--color-text-disabled`: #9f9fa9 - Disabled text

#### AI/Brand Colors
- `--color-ai-primary`: #a684ff - Main AI accent
- `--color-ai-secondary`: #8e51ff - Secondary AI accent
- `--color-ai-text`: #ddd6ff - AI-tinted text

#### Status Colors
- `--color-success`: #00d492 - Success/positive
- `--color-error`: #ff637e - Error/negative
- `--color-warning`: #ffd230 - Warning
- `--color-caution`: #ffb900 - Caution

#### Badge Colors (BUY/SELL/HOLD)
Each badge type has background, border, and text colors:
- Buy: Green variants
- Sell: Red variants
- Hold: Orange variants
- Monitor: Blue variants

### Typography

#### Font Families
- `--font-family-primary`: 'Inter', sans-serif
- `--font-family-mono`: 'JetBrains Mono', monospace

#### Font Sizes
- `--font-size-2xs`: 10px - Tag pills
- `--font-size-xs`: 12px - Small text, timestamps
- `--font-size-sm`: 14px - Base body text
- `--font-size-base`: 16px - Medium body text
- `--font-size-md`: 18px - Large body text
- `--font-size-lg`: 20px - H3
- `--font-size-xl`: 24px - H2
- `--font-size-2xl`: 30px - H1, large values

#### Font Weights
- `--font-weight-regular`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

### Spacing

- `--spacing-xxs`: 2px
- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 12px
- `--spacing-base`: 16px
- `--spacing-lg`: 20px
- `--spacing-xl`: 24px
- `--spacing-2xl`: 32px
- `--spacing-3xl`: 48px

#### Component-Specific Spacing
- `--spacing-card-padding`: 24px
- `--spacing-log-entry-gap`: 12px
- `--spacing-header-padding`: 16px

### Border Radius

- `--radius-sm`: 8px - Buttons, badges
- `--radius-md`: 10px - Rationale boxes
- `--radius-lg`: 14px - Cards, panels
- `--radius-pill`: 9999px - Status pills, fully rounded

### Shadows

- `--shadow-sm`: Subtle elevation
- `--shadow-md`: Medium elevation
- `--shadow-lg`: Large elevation
- `--shadow-xl`: Extra large elevation
- `--shadow-ai`: AI-themed purple shadow

### Transitions

- `--transition-fast`: 150ms - Quick interactions
- `--transition-base`: 300ms - Standard animations
- `--transition-slow`: 500ms - Slow, deliberate animations

## 🔄 Migration from Legacy Variables

Existing components use legacy Material Design-inspired variables. These are kept for backward compatibility but marked as deprecated.

### Migration Guide

| Old Variable | New Token | Notes |
|-------------|-----------|-------|
| `$color-primary` | `$color-ai-primary` | Use AI brand color |
| `$color-success` | `$color-success` | Same value, but use new token |
| `$spacing-md` | `$spacing-base` | Old md was 16px, new base is 16px |
| `$spacing-lg` | `$spacing-xl` | Old lg was 24px, new xl is 24px |
| `$border-radius-sm` | `$radius-sm` | Both are 8px |
| `$border-radius-lg` | `$radius-lg` | Old was 12px, new is 14px |

## 📚 Next Steps

See `design_system.md` for the complete implementation roadmap including:
- Phase 2: Typography System
- Phase 3: Component Base Styles
- Phase 4: Icon System
- Phase 5: Global Styles
- And more...

## 🧪 Testing

To test the design tokens:

1. **Import in a component stylesheet:**
```scss
@use '@frontend/styles/scss' as *;

.test-component {
  background: $color-bg-primary;
  color: $color-text-primary;
}
```

2. **Use CSS custom properties:**
```html
<div style="background: var(--color-bg-card); padding: var(--spacing-xl);">
  Design system is working!
</div>
```

3. **Check in browser DevTools:**
- Inspect any element
- Check Computed styles
- Look for `--color-*`, `--spacing-*`, etc. variables

## 📖 Documentation

- [Component Breakdown](../../../figma-component-breakdown.md) - Detailed Figma design analysis
- [Design System Guide](../../../design_system.md) - Complete implementation plan
- [Design Prompt](../../../design_prompt.md) - Original design requirements
