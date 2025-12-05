/**
 * Brand Icons
 * 
 * Centralized custom SVG icons for brand identity and application branding.
 * These icons are used across authentication pages, navigation, and other branded areas.
 * 
 * All icons use currentColor for easy theming.
 */

/**
 * Trending arrow icon
 * Used in authentication pages (login, signup)
 * Represents growth and upward movement
 */
export const BRAND_ICON_ARROW_TREND = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 17L17 7M17 7H10M17 7V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/**
 * Bar chart with axes icon
 * Used in top navigation bar
 * Represents portfolio analytics and data visualization
 */
export const BRAND_ICON_CHART_BARS = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 20V4M3 20H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="7" y="13" width="3" height="7" fill="currentColor" rx="0.5"/>
  <rect x="12" y="9" width="3" height="11" fill="currentColor" rx="0.5"/>
  <rect x="17" y="6" width="3" height="14" fill="currentColor" rx="0.5"/>
</svg>`;

/**
 * Brand icon names type for type safety
 */
export type BrandIconName = 'arrow-trend' | 'chart-bars';

/**
 * Get brand icon SVG by name
 * @param name - The brand icon name
 * @returns The SVG string for the icon
 */
export function getBrandIcon(name: BrandIconName): string {
  const icons: Record<BrandIconName, string> = {
    'arrow-trend': BRAND_ICON_ARROW_TREND,
    'chart-bars': BRAND_ICON_CHART_BARS,
  };
  
  return icons[name];
}
