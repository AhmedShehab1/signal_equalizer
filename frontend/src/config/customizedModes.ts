/**
 * Configuration for available customized modes
 * Add new mode identifiers here to make them discoverable
 */

export const AVAILABLE_CUSTOMIZED_MODES = [
  'musical_instruments',
  'human_voices',
] as const;

export type CustomizedModeId = typeof AVAILABLE_CUSTOMIZED_MODES[number];
