/**
 * Material Icons Constants
 * 
 * Centralized icon name definitions for type safety and discoverability.
 * All icon names correspond to Material Icons font.
 * 
 * @see https://fonts.google.com/icons
 */

/**
 * Common action icons
 */
export const ACTION_ICONS = {
  ADD: 'add',
  EDIT: 'edit',
  DELETE: 'delete',
  SAVE: 'save',
  CANCEL: 'cancel',
  CLOSE: 'close',
  REFRESH: 'refresh',
  SEARCH: 'search',
  FILTER: 'filter_list',
  SORT: 'sort',
  MORE: 'more_vert',
  MORE_HORIZ: 'more_horiz',
  SETTINGS: 'settings',
  HELP: 'help',
  INFO: 'info',
} as const;

/**
 * Navigation icons
 */
export const NAVIGATION_ICONS = {
  HOME: 'home',
  DASHBOARD: 'dashboard',
  MENU: 'menu',
  ARROW_BACK: 'arrow_back',
  ARROW_FORWARD: 'arrow_forward',
  ARROW_UP: 'arrow_upward',
  ARROW_DOWN: 'arrow_downward',
  EXPAND_MORE: 'expand_more',
  EXPAND_LESS: 'expand_less',
  CHEVRON_LEFT: 'chevron_left',
  CHEVRON_RIGHT: 'chevron_right',
} as const;

/**
 * Status and indicator icons
 */
export const STATUS_ICONS = {
  CHECK: 'check',
  CHECK_CIRCLE: 'check_circle',
  ERROR: 'error',
  WARNING: 'warning',
  SUCCESS: 'check_circle',
  PENDING: 'schedule',
  LOCK: 'lock',
  LOCK_OPEN: 'lock_open',
  VISIBILITY: 'visibility',
  VISIBILITY_OFF: 'visibility_off',
} as const;

/**
 * Portfolio and finance icons
 */
export const PORTFOLIO_ICONS = {
  WALLET: 'account_balance_wallet',
  BALANCE: 'account_balance',
  TRENDING_UP: 'trending_up',
  TRENDING_DOWN: 'trending_down',
  CHART: 'show_chart',
  PIE_CHART: 'pie_chart',
  BAR_CHART: 'bar_chart',
  ATTACH_MONEY: 'attach_money',
  PAID: 'paid',
  RECEIPT: 'receipt',
} as const;

/**
 * User and auth icons
 */
export const USER_ICONS = {
  PERSON: 'person',
  ACCOUNT: 'account_circle',
  LOGIN: 'login',
  LOGOUT: 'logout',
  PERSON_ADD: 'person_add',
  GROUP: 'group',
} as const;

/**
 * File and document icons
 */
export const DOCUMENT_ICONS = {
  DESCRIPTION: 'description',
  FOLDER: 'folder',
  FOLDER_OPEN: 'folder_open',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  ATTACHMENT: 'attachment',
  CLOUD: 'cloud',
  CLOUD_UPLOAD: 'cloud_upload',
  CLOUD_DOWNLOAD: 'cloud_download',
} as const;

/**
 * Communication icons
 */
export const COMMUNICATION_ICONS = {
  EMAIL: 'email',
  PHONE: 'phone',
  CHAT: 'chat',
  NOTIFICATIONS: 'notifications',
  NOTIFICATIONS_ACTIVE: 'notifications_active',
  NOTIFICATIONS_OFF: 'notifications_off',
  SHARE: 'share',
} as const;

/**
 * All available Material Icons grouped by category
 */
export const MATERIAL_ICONS = {
  ACTION: ACTION_ICONS,
  NAVIGATION: NAVIGATION_ICONS,
  STATUS: STATUS_ICONS,
  PORTFOLIO: PORTFOLIO_ICONS,
  USER: USER_ICONS,
  DOCUMENT: DOCUMENT_ICONS,
  COMMUNICATION: COMMUNICATION_ICONS,
} as const;

/**
 * Type for all available icon names
 */
export type MaterialIconName = 
  | typeof ACTION_ICONS[keyof typeof ACTION_ICONS]
  | typeof NAVIGATION_ICONS[keyof typeof NAVIGATION_ICONS]
  | typeof STATUS_ICONS[keyof typeof STATUS_ICONS]
  | typeof PORTFOLIO_ICONS[keyof typeof PORTFOLIO_ICONS]
  | typeof USER_ICONS[keyof typeof USER_ICONS]
  | typeof DOCUMENT_ICONS[keyof typeof DOCUMENT_ICONS]
  | typeof COMMUNICATION_ICONS[keyof typeof COMMUNICATION_ICONS];

