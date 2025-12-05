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
