/**
 * Custom SVG Icons for Portfolio Manager
 * 
 * These icons are custom-designed for the application and complement Material Icons.
 * SVG strings are stored here for use in the IconComponent.
 * 
 * TODO: Extract actual SVGs from Figma design
 * For now, using placeholder SVGs that can be replaced with Figma exports.
 * 
 * How to add icons from Figma:
 * 1. Select icon in Figma
 * 2. Right-click → Copy as SVG
 * 3. Paste SVG code below
 * 4. Optimize with SVGO if needed
 * 5. Remove width/height attributes (let CSS control size)
 */

/**
 * Agent and AI-related icons
 */
export const AGENT_ICONS = {
  // Brain/CPU icon for agent reasoning
  brain: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C10.3431 2 9 3.34315 9 5C9 5.55228 8.55228 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10C8.55228 10 9 10.4477 9 11V13C9 13.5523 8.55228 14 8 14C6.89543 14 6 14.8954 6 16C6 17.1046 6.89543 18 8 18C8.55228 18 9 18.4477 9 19C9 20.6569 10.3431 22 12 22C13.6569 22 15 20.6569 15 19C15 18.4477 15.4477 18 16 18C17.1046 18 18 17.1046 18 16C18 14.8954 17.1046 14 16 14C15.4477 14 15 13.5523 15 13V11C15 10.4477 15.4477 10 16 10C17.1046 10 18 9.10457 18 8C18 6.89543 17.1046 6 16 6C15.4477 6 15 5.55228 15 5C15 3.34315 13.6569 2 12 2Z" fill="currentColor"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>`,
  
  // Sparkle icon for AI features
  sparkle: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
    <path d="M19 3L19.5 4.5L21 5L19.5 5.5L19 7L18.5 5.5L17 5L18.5 4.5L19 3Z" fill="currentColor"/>
    <path d="M19 17L19.5 18.5L21 19L19.5 19.5L19 21L18.5 19.5L17 19L18.5 18.5L19 17Z" fill="currentColor"/>
  </svg>`,
  
  // CPU/Processor icon
  cpu: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor"/>
    <rect x="9" y="9" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M9 2V5M12 2V5M15 2V5M9 19V22M12 19V22M15 19V22M2 9H5M2 12H5M2 15H5M19 9H22M19 12H22M19 15H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
} as const;

/**
 * Chart and technical analysis icons
 */
export const CHART_ICONS = {
  // Candlestick chart
  candlestick: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 4V7M6 17V20M6 7H8V17H6V7Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 2V6M12 14V22M12 6H14V14H12V6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M18 8V12M18 18V22M18 12H20V18H18V12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  // Line chart with trend
  lineChart: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17L6 13L10 15L14 8L18 11L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="3" cy="17" r="1.5" fill="currentColor"/>
    <circle cx="6" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="10" cy="15" r="1.5" fill="currentColor"/>
    <circle cx="14" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="18" cy="11" r="1.5" fill="currentColor"/>
    <circle cx="21" cy="7" r="1.5" fill="currentColor"/>
  </svg>`,
  
  // Technical indicator icon
  indicator: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H21" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
    <path d="M3 18H21" stroke="currentColor" stroke-width="1.5"/>
    <path d="M3 6H21" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 3L8 9M16 15L16 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
} as const;

/**
 * News and sentiment icons
 */
export const NEWS_ICONS = {
  // Newspaper icon
  news: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="14" height="16" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M17 8H19C19.5523 8 20 8.44772 20 9V19C20 19.5523 19.5523 20 19 20H17" stroke="currentColor" stroke-width="1.5"/>
    <line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="6" y1="16" x2="11" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  // Sentiment positive
  sentimentPositive: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="9" cy="10" r="1" fill="currentColor"/>
    <circle cx="15" cy="10" r="1" fill="currentColor"/>
  </svg>`,
  
  // Sentiment negative
  sentimentNegative: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 17C8 17 9.5 15 12 15C14.5 15 16 17 16 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="9" cy="10" r="1" fill="currentColor"/>
    <circle cx="15" cy="10" r="1" fill="currentColor"/>
  </svg>`,
} as const;

/**
 * Risk and security icons
 */
export const RISK_ICONS = {
  // Shield with check
  shield: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L4 6V11C4 15.5 7.03 19.57 12 21C16.97 19.57 20 15.5 20 11V6L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  // Warning triangle
  warningTriangle: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 20H22L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M12 9V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  </svg>`,
  
  // Risk gauge
  riskGauge: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 14.3472 20.0855 16.4736 18.5924 18.0369" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 12L15 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>`,
} as const;

/**
 * Action and control icons
 */
export const CONTROL_ICONS = {
  // Play/Run icon
  play: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
  </svg>`,
  
  // Pause icon
  pause: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
  </svg>`,
  
  // Refresh/Reload icon
  refresh: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C9.47766 20 7.22099 18.7561 5.81622 16.8438" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M4 17L5.5 15.5L7 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
} as const;

/**
 * Arrow and direction icons
 */
export const ARROW_ICONS = {
  // Arrow right
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  // Chevron right
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  // Trending up
  trendingUp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17L9 11L13 15L21 7M21 7H15M21 7V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  // Trending down
  trendingDown: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7L9 13L13 9L21 17M21 17H15M21 17V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
} as const;

/**
 * Status indicator icons
 */
export const STATUS_INDICATOR_ICONS = {
  // Checkmark
  check: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  
  // Info circle
  info: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12 8V8.01M12 11V16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  
  // Warning circle
  warning: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12 7V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="17" r="1" fill="currentColor"/>
  </svg>`,
  
  // Error/Close circle
  error: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
    <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
} as const;

/**
 * UI element icons
 */
export const UI_ICONS = {
  // Settings gear
  settings: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12 4V2M12 22V20M20 12H22M2 12H4M17.6569 17.6569L19.0711 19.0711M4.92893 4.92893L6.34315 6.34315M17.6569 6.34315L19.0711 4.92893M4.92893 19.0711L6.34315 17.6569" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  
  // Dashboard/Grid
  dashboard: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,
  
  // Portfolio/Wallet
  portfolio: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
    <path d="M7 6V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V6" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="12" cy="13" r="2" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,
} as const;

/**
 * All custom icons grouped by category
 */
export const CUSTOM_ICONS = {
  AGENT: AGENT_ICONS,
  CHART: CHART_ICONS,
  NEWS: NEWS_ICONS,
  RISK: RISK_ICONS,
  CONTROL: CONTROL_ICONS,
  ARROW: ARROW_ICONS,
  STATUS: STATUS_INDICATOR_ICONS,
  UI: UI_ICONS,
} as const;

/**
 * Type for all custom icon names
 */
export type CustomIconName =
  | keyof typeof AGENT_ICONS
  | keyof typeof CHART_ICONS
  | keyof typeof NEWS_ICONS
  | keyof typeof RISK_ICONS
  | keyof typeof CONTROL_ICONS
  | keyof typeof ARROW_ICONS
  | keyof typeof STATUS_INDICATOR_ICONS
  | keyof typeof UI_ICONS;

/**
 * Helper to get an icon by name
 */
export function getCustomIcon(name: CustomIconName): string {
  // Search through all categories
  for (const category of Object.values(CUSTOM_ICONS)) {
    if (name in category) {
      return (category as Record<string, string>)[name];
    }
  }
  throw new Error(`Icon "${name}" not found in custom icons`);
}
