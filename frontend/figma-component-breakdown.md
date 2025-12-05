# Figma Dashboard Component Breakdown

## Overview
This document provides a comprehensive breakdown of all UI components used in the Autonomous Portfolio Manager dashboard, as extracted from the Figma design.

---

## 1. Layout Structure

### App Container
- **Type**: Main container
- **Background**: `zinc-950` (dark mode)
- **Layout**: Flexbox column with 24px gap
- **Dimensions**: 1023px wide × 674px tall
- **Purpose**: Root container for all dashboard content

---

## 2. Header / Navigation Bar

### Top Navigation
- **Type**: Header bar
- **Background**: `rgba(9,9,11,0.8)` with bottom border
- **Border**: Bottom 1px solid `zinc-800`
- **Height**: 65px
- **Layout**: Horizontal flex, space-between alignment

#### Logo Section
- **Components**:
  - Icon container with purple shadow
  - Brand text: "Portfolio" (zinc-100) + "Mind" (purple accent #a684ff)
  - Font: Inter Bold, 18px

#### Navigation Buttons
- **Dashboard Button** (Active state):
  - Background: `zinc-800`
  - Icon + Text: "Dashboard"
  - Border radius: 8px
  
- **Portfolio Button** (Inactive):
  - Text color: `#9f9fa9`
  - No background

#### Action Button
- **"Run Agent Analysis"** button:
  - Icon: Play/Run icon
  - Text: White
  - Interactive element

#### Settings Icon
- Position: Right corner
- Icon: Gear/Settings

---

## 3. Portfolio Summary Section (Top Cards)

### Card 1: Total Portfolio Value
- **Type**: Stat card
- **Background**: `rgba(24,24,27,0.5)`
- **Border**: 1px solid `zinc-800`
- **Border radius**: 14px
- **Height**: 150px

**Contents**:
- **Label**: "Total Portfolio Value" (gray, 14px)
- **Icon**: Trending up icon in rounded container
- **Main Value**: "$142,503.45" (white, 30px bold)
- **Change Indicator**: 
  - Text: "+1,240.5 (0.85%)" (green #00d492)
  - Suffix: "today" (gray)

### Card 2: Agent Status
- **Type**: Status card
- **Background**: `rgba(24,24,27,0.5)`
- **Border**: 1px solid `zinc-800`
- **Dimensions**: 330px wide

**Contents**:
- **Label**: "Agent Status" 
- **Status Badge**: "IDLE" (zinc-800 bg, gray text, pill-shaped)
- **Status Indicator**: 
  - Gray dot (12px)
  - Text: "Monitoring Market Data" (white, 16px)
- **Timestamp**: "Last active: Just now" (gray, 12px)

### Card 3: Global Confidence
- **Type**: Metric card
- **Background**: `rgba(24,24,27,0.5)`
- **Dimensions**: 243px wide

**Contents**:
- **Label**: "Global Confidence"
- **Icon**: Sparkle/AI icon
- **Main Value**: "87%" (white, 24px bold)
- **Subtitle**: "Accuracy Score" (gray)
- **Progress Bar**: 
  - Background: `zinc-800`
  - Fill color: Gradient (purple accent)
  - Height: 8px, rounded pill

---

## 4. Agent Brain / Activity Log (Left Panel)

### Container
- **Type**: Scrollable log panel
- **Background**: `zinc-950`
- **Border**: 1px solid `zinc-800`
- **Border radius**: 14px
- **Shadow**: Subtle elevation shadow
- **Width**: 586.75px
- **Height**: Scrollable (1498.5px content)

### Header Bar
- **Background**: `zinc-900`
- **Border bottom**: 1px solid `zinc-800`
- **Height**: 45px
- **Contents**:
  - Icon + Title: "Agent Reasoning Trace" (zinc-200, 14px)
  - Version: "v2.4.0" (right-aligned, gray, 12px)

### Log Entry Types

#### 1. **Info Log Entry**
- **Structure**:
  - Timestamp: "09:14:15" (gray, 12px, monospace)
  - Icon: Info icon (12px)
  - Message: "Initializing autonomous agent v2.4..." (zinc-300, 14px)

#### 2. **System Log Entry**
- Similar to info but may include:
  - Sub-message with left border (zinc-800)
  - Metadata: e.g., "Latency: 12ms" (gray, 12px)

#### 3. **Reasoning Log Entry** (Special)
- **Icon Container**: 
  - Background: `rgba(142,81,255,0.1)` (purple tint)
  - Border: `rgba(142,81,255,0.3)` shadow
  - Size: 20px
  - Icon: Brain/CPU icon
- **Message**: Purple-tinted text (#ddd6ff)
- **Purpose**: Highlights AI decision-making steps
- **Sub-message**: Indented with left border

#### 4. **Success Log Entry**
- Icon: Checkmark (green)
- Message color: Green (#5ee9b5)
- Example: "AAPL Sentiment: Strongly Positive (0.85)"

#### 5. **Warning Log Entry**
- Icon: Warning triangle
- Message color: Yellow (#ffd230)
- Example: "NVDA RSI divergence detected on 4H chart."

#### 6. **Tool Call Log Entry**
- **Icon Container**: Square with tool icon
- Icons vary by tool:
  - News icon
  - Chart/Technical icon
  - Shield/Risk icon
- **Status**: May include completion checkmark

### Log Content Area
- **Background**: `rgba(0,0,0,0.5)`
- **Padding**: 16px
- **Layout**: Vertical list with 12px gaps
- **Font**: Inter Regular, 14px
- **Overflow**: Scrollable

---

## 5. Latest Recommendations (Right Panel)

### Container
- **Type**: Scrollable card list
- **Width**: 436.25px
- **Layout**: Vertical stack with gaps

### Section Header
- **Text**: "Latest Recommendations" (white, medium weight)
- **Icon**: Trending arrow (optional)
- **Alignment**: Left

### Stock Recommendation Card

**Card Structure**:
- **Background**: `zinc-900`
- **Border**: 1px solid `zinc-800`
- **Border radius**: 14px
- **Height**: Variable (343-366px)
- **Shadow**: Subtle elevation
- **Layout**: Header, Content, Footer sections

---

#### Card Header (80px)
**Left Section**:
- **Ticker Symbol**: 
  - Text: "AAPL" / "NVDA" / "TSLA" / "AMD" (white, 20px bold)
  
- **Action Badge**:
  - **BUY**: Green background `rgba(0,212,146,0.1)`, border `rgba(0,212,146,0.2)`, text green
  - **HOLD**: Orange background `rgba(254,154,0,0.1)`, border `rgba(254,154,0,0.2)`, text `#ffb900`
  - **SELL**: Red background `rgba(255,99,126,0.1)`, border `rgba(255,99,126,0.2)`, text red
  - Border radius: 8px
  - Padding: 3px 9px
  - Font: 12px medium

- **Company Name**: 
  - Text: "Apple Inc." (gray, 12px)

**Right Section**:
- **Current Price**: 
  - Text: "$178.35" (white, 18px bold)
  
- **Price Change**:
  - Icon: Up/Down arrow (12px)
  - Text: "+2.3%" or "-0.45%" (green/red, 12px)
  - Alignment: Right

---

#### Card Content (Variable height)
**Agent Confidence Section**:
- **Label**: 
  - Icon: Sparkle (12px)
  - Text: "Agent Confidence" (gray, 12px)
  
- **Value**: 
  - Text: "89%" / "65%" / "78%" / "82%" (white, 14px bold)
  - Alignment: Right

- **Progress Bar**:
  - Background: `zinc-800`
  - Height: 6px
  - Border radius: Pill
  - Fill: Varies based on confidence level

**Rationale Section**:
- **Container**: 
  - Background: `rgba(9,9,11,0.5)`
  - Border: 1px solid `rgba(39,39,42,0.5)`
  - Border radius: 10px
  - Padding: 13px
  - Height: 117px

- **Label**: 
  - Text: "RATIONALE" (gray, 12px, uppercase, letter-spacing: 0.6px)

- **Content**: 
  - Text: Multi-line explanation (zinc-300, 14px)
  - Line height: 22.75px
  - Max width: ~330px

**Example Rationales**:
- AAPL: "Strong ecosystem lock-in combined with positive sentiment from recent product launch leaks. Technicals show a breakout from a 3-month consolidation pattern."
- NVDA: "AI demand remains robust, but valuation is stretched. RSI divergence suggests a short-term pullback is likely. Wait for better entry around $440."

---

#### Card Footer (45px)
**Left Section - Tags**:
- **Tag Pills**:
  - Background: `zinc-800`
  - Border: 1px solid `rgba(63,63,70,0.5)`
  - Border radius: Pill
  - Padding: 4.5px 8px
  - Text: "Tech", "Growth", "Semiconductors", "AI", "Auto", "Value" (gray, 10px)
  - Layout: Horizontal flex with 8px gap

**Right Section - Action**:
- **Deep Dive Button**:
  - Text: "Deep Dive" (gray, 12px)
  - Icon: Arrow right (16px)
  - Interactive: Hoverable
  - Border radius: 8px

---

## 6. Reusable UI Components

### Icon Set
- **Size variants**: 12px, 16px, 24px, 32px
- **Categories**:
  - Navigation: Dashboard, Portfolio, Settings
  - Actions: Play, Arrow right, Info
  - Status: Checkmark, Warning, Error
  - Tools: News, Chart, Shield, Brain
  - Misc: Trending, Sparkle, Gear

### Typography System

**Headings**:
- H1: Inter Bold, 18px, -0.89px tracking
- H2: Inter Bold, 24px
- H3: Inter Bold, 20px

**Body Text**:
- Large: Inter Regular, 16px, -0.31px tracking
- Medium: Inter Regular/Medium, 14px, -0.15px tracking
- Small: Inter Regular, 12px

**Labels**:
- Inter Medium, 14px, -0.15px tracking
- Uppercase labels: 12px, 0.6px letter-spacing

**Numeric Values**:
- Large: Inter Bold, 30px, 0.4px tracking
- Medium: Inter Bold, 24px
- Small: Inter Bold, 18px, -0.44px tracking

### Color Palette

**Background Colors**:
- Primary: `zinc-950` (#09090b)
- Secondary: `zinc-900` (#18181b)
- Card: `rgba(24,24,27,0.5)`
- Overlay: `rgba(0,0,0,0.5)`

**Border Colors**:
- Primary: `zinc-800` (#27272a)
- Secondary: `zinc-700` (#3f3f46)
- Subtle: `rgba(39,39,42,0.5)`

**Text Colors**:
- Primary: `white` (#ffffff)
- Secondary: `zinc-100` (#f4f4f5)
- Tertiary: `zinc-200` (#e4e4e7)
- Muted: `zinc-300` (#d4d4d8)
- Disabled: `#9f9fa9` / `#71717b` / `#52525c`

**Accent Colors**:
- Purple (AI): `#a684ff` / `#8e51ff`
- Green (Positive): `#00d492` / `#5ee9b5`
- Red (Negative): `#ff637e`
- Yellow (Warning): `#ffd230`
- Orange (Caution): `#ffb900` / `#fe9a00`

**Status Badge Colors**:
- BUY: Green rgba backgrounds
- HOLD: Orange rgba backgrounds
- SELL: Red rgba backgrounds
- Each with 0.1 opacity background and 0.2 opacity border

### Badge Component
- **Border radius**: 8px
- **Padding**: 3px 9px
- **Font**: Inter Medium, 12px
- **Variants**: BUY, SELL, HOLD, MONITOR
- **States**: Default, Active

### Button Component
- **Primary**: Zinc-800 background, white text
- **Ghost**: No background, gray text
- **Border radius**: 8px
- **Padding**: Varies (typically 8px 16px)
- **States**: Default, Hover, Active
- **Sizes**: Small (height 25px), Medium (32px), Large (40px+)

### Progress Bar Component
- **Container**: 
  - Background: `zinc-800`
  - Height: 6-8px
  - Border radius: Pill (16777216px = full round)
  - Width: 100% of parent
  
- **Fill**:
  - Background: Gradient or solid accent color
  - Height: 100%
  - Width: Percentage-based
  - Transition: Smooth

### Card Component
- **Base styles**:
  - Background: `rgba(24,24,27,0.5)` or `zinc-900`
  - Border: 1px solid `zinc-800`
  - Border radius: 14px
  - Padding: 1px (with inner content padding)
  
- **Variants**:
  - Summary Card (150px height)
  - Stock Card (Variable height)
  - Log Panel (Scrollable)

- **Structure**:
  - Card Header (optional)
  - Card Content
  - Card Footer (optional)

### Status Pill
- **Shape**: Pill (fully rounded)
- **Sizes**: 12px, 26px
- **Colors**: 
  - Gray: `#71717b`
  - Green: Success
  - Yellow: Warning
  - Red: Error

---

## 7. Interaction States

### Hover States
- Cards: Subtle border color change or elevation increase
- Buttons: Background lightens slightly
- Log entries: Background highlight
- Stock cards: Border color change (purple accent)

### Active States
- Navigation buttons: `zinc-800` background
- Selected log entry: Purple accent border

### Loading States
- Agent status: Pulsing animation on status dot
- Log streaming: Fade-in animation for new entries
- Skeleton loaders: For recommendation cards

### Empty States
- No recommendations: Empty state message
- Idle agent: Last run summary shown

---

## 8. Responsive Behavior

### Desktop (1024px+)
- Full layout as designed
- Two-column: Agent Brain (left) + Recommendations (right)
- Fixed header

### Tablet (768px - 1023px)
- Stacked layout
- Full-width sections
- Scrollable panels

### Mobile (Not in current design)
- Would require: Single column, collapsible sections, bottom navigation

---

## 9. Animation Guidelines

### Log Streaming
- **Type**: Fade and slide in from bottom
- **Duration**: 200-300ms
- **Easing**: Ease-out

### Status Changes
- **Type**: Color transition
- **Duration**: 300ms
- **Easing**: Ease-in-out

### Card Interactions
- **Hover**: Transform scale 1.02, duration 200ms
- **Click**: Ripple effect or scale down briefly

### Progress Bars
- **Type**: Width transition
- **Duration**: 500ms
- **Easing**: Ease-in-out

---

## 10. Component Hierarchy Summary

```
App Container
├── Header Navigation
│   ├── Logo
│   ├── Navigation Buttons (Dashboard, Portfolio)
│   ├── Run Agent Analysis Button
│   └── Settings Icon
│
├── Portfolio Summary Section
│   ├── Total Portfolio Value Card
│   ├── Agent Status Card
│   └── Global Confidence Card
│
├── Main Content Area (Two Columns)
│   ├── Agent Brain Panel (Left)
│   │   ├── Header Bar
│   │   └── Log Entry List
│   │       ├── Info Log Entry
│   │       ├── System Log Entry
│   │       ├── Reasoning Log Entry (Purple)
│   │       ├── Success Log Entry (Green)
│   │       ├── Warning Log Entry (Yellow)
│   │       └── Tool Call Log Entry
│   │
│   └── Recommendations Panel (Right)
│       ├── Section Header
│       └── Stock Card List
│           └── Stock Card (Repeatable)
│               ├── Card Header
│               │   ├── Ticker + Badge
│               │   └── Price + Change
│               ├── Card Content
│               │   ├── Confidence Meter
│               │   └── Rationale Box
│               └── Card Footer
│                   ├── Tag Pills
│                   └── Deep Dive Button
```

---

## 11. Key Design Patterns

### Glassmorphism
- Semi-transparent backgrounds: `rgba(24,24,27,0.5)`
- Backdrop blur (implied)
- Layered elevation

### Dark Mode First
- Primary dark background
- High contrast text
- Accent colors for emphasis

### AI-Themed Visual Language
- Purple accent (#a684ff) for AI elements
- Brain/sparkle icons
- Glow effects on reasoning logs

### Terminal-Inspired Log
- Monospace timestamps
- Icon-prefixed entries
- Different colors for different log levels
- Scrollable content area

### Financial Data Visualization
- Green for positive, red for negative (universal convention)
- Bold numeric values
- Percentage changes with directional icons
- Confidence meters as progress bars

---

## 12. Implementation Notes

### Tech Stack Compatibility
This design uses:
- **Layout**: Flexbox (CSS Grid could simplify some layouts)
- **Styling**: TailwindCSS classes (needs conversion to Angular SCSS)
- **Icons**: SVG images (should be converted to icon font or Angular Material icons)
- **Fonts**: Inter (needs to be loaded via Google Fonts or local files)

### Angular Component Mapping
Recommended Angular components to create:
1. `DashboardLayoutComponent` - Main container
2. `HeaderComponent` - Top navigation
3. `PortfolioSummaryComponent` - Three summary cards
4. `AgentBrainComponent` - Log panel
5. `LogEntryComponent` - Individual log entry
6. `RecommendationsListComponent` - Right panel
7. `StockCardComponent` - Individual recommendation card
8. `BadgeComponent` - Reusable badge (BUY/SELL/HOLD)
9. `ProgressBarComponent` - Confidence meter
10. `ButtonComponent` - Reusable button
11. `CardComponent` - Reusable card wrapper

### State Management
- Agent status (idle, analyzing, reflecting)
- Portfolio summary data
- Log entries (stream)
- Recommendations list
- Confidence scores

### API Integration Points
- Portfolio value and change
- Agent status updates
- Log streaming endpoint
- Stock recommendations
- Confidence calculations

---

## Summary

This dashboard design features **11 major UI components** organized into **3 main sections**:
1. **Header/Navigation** (5 elements)
2. **Portfolio Summary** (3 cards)
3. **Main Content** (2 panels: Agent Brain + Recommendations)

The design uses a **dark mode color scheme** with purple AI accents, follows **modern glassmorphism** trends, and prioritizes **transparency and observability** through the prominent Agent Brain log panel.

Key reusable components include **badges**, **cards**, **progress bars**, **buttons**, and **log entries** with multiple style variants.
