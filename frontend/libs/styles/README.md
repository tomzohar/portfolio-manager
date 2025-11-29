# styles

This library was generated with [Nx](https://nx.dev).

## Overview

The `@stocks-researcher/styles` library provides a centralized design system for the Stocks Researcher frontend application. It includes:

1. **SCSS Framework**: Design tokens (colors, spacing, typography, borders) and reusable mixins.
2. **Wrapper Components**: Pre-built Angular Material wrapper components (Card, Select, Table, Toolbar) with standardized styling.

## Building

Run `nx build styles` to build the library.

## Running unit tests

Run `nx test styles` to execute the unit tests via [Jest](https://jestjs.io).

---

## SCSS Framework

The SCSS framework is located at `src/lib/scss/` and includes:

- **`_variables.scss`**: Design tokens for spacing, colors, typography, borders, breakpoints.
- **`_mixins.scss`**: Reusable mixins for common layout patterns (flex, containers, cards, etc.).
- **`index.scss`**: Barrel file that forwards all variables and mixins.

### Usage

To use the SCSS framework in your components:

```scss
@use '@stocks-researcher/styles/src/lib/scss' as *;

.my-container {
  @include container-center($max-width: $max-width-container, $padding: $spacing-lg);
}

.my-card {
  @include card-surface;
}
```

### Design Tokens

#### Spacing
- `$spacing-xs`: 4px
- `$spacing-sm`: 8px
- `$spacing-md`: 16px
- `$spacing-lg`: 24px
- `$spacing-xl`: 32px
- `$spacing-2xl`: 48px

#### Layout
- `$max-width-container`: 1200px
- `$max-width-narrow`: 800px
- `$max-width-wide`: 1600px

#### Colors
- Primary: `$color-primary`, `$color-primary-light`, `$color-primary-dark`
- Accent: `$color-accent`, `$color-accent-light`, `$color-accent-dark`
- Semantic: `$color-warn`, `$color-success`, `$color-info`

#### Borders
- Radius: `$border-radius-sm` (4px), `$border-radius-md` (8px), `$border-radius-lg` (12px)
- Width: `$border-width-thin` (1px), `$border-width-medium` (2px), `$border-width-thick` (4px)
- Color: `$border-color`, `$border-color-light`

### Mixins

#### `container-center($max-width, $padding)`
Creates a centered container with max-width and padding.

#### `flex-column($gap)` / `flex-row($gap, $align)`
Flexbox utilities for column/row layouts.

#### `card-surface`
Standard card/surface styling with shadow and padding.

#### `border($color, $width, $radius)`
Apply consistent borders.

#### `respond-to($breakpoint)`
Responsive media queries ('sm', 'md', 'lg', 'xl').

---

## Wrapper Components

All wrapper components are standalone, use Signal-based inputs/outputs, and are styled using the SCSS framework.

### CardComponent (`lib-card`)
Material Card wrapper with optional title, subtitle, and actions.

**Inputs:**
- `title`: Optional string
- `subtitle`: Optional string
- `actions`: Boolean (default: false)

**Usage:**
```html
<lib-card title="My Card" subtitle="Subtitle">
  <p>Card content</p>
</lib-card>
```

### SelectComponent (`lib-select`)
Material Select wrapper with dropdown options.

**Inputs:**
- `label`: String
- `options`: `SelectOption[]` (array of `{value, label}`)
- `selected`: Current selected value
- `disabled`: Boolean (default: false)

**Outputs:**
- `selectionChange`: Emits the selected value

**Usage:**
```html
<lib-select 
  label="Choose an option" 
  [options]="options()"
  [selected]="selected()"
  (selectionChange)="onSelect($event)">
</lib-select>
```

### TableComponent (`lib-table`)
Material Table wrapper with automatic column rendering.

**Inputs:**
- `data`: Array of data objects
- `columns`: `ColumnDef[]` (array of `{key, header, type?}`)

**Usage:**
```html
<lib-table [data]="assets()" [columns]="columnDefs"></lib-table>
```

### ToolbarComponent (`lib-toolbar`)
Material Toolbar wrapper with title and content projection.

**Inputs:**
- `title`: String

**Usage:**
```html
<lib-toolbar title="Dashboard">
  <button>Actions</button>
</lib-toolbar>
```

---

## Architecture Standards

All components in this library follow the **Zoneless/Signal Standards** as defined in `CODING_AGENT_PROMPT_FRONTEND.md`:

- **Signal Inputs/Outputs**: Use `input()`, `output()` instead of decorators.
- **Standalone Components**: All components are standalone.
- **SCSS Framework**: All styles use the centralized SCSS framework.
