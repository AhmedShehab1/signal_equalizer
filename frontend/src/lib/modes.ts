/**
 * Mode loader and validator for customized multi-window modes
 */

import { CustomizedMode, SliderSpec, BandSpec, BandWindow } from '../model/types';

// Cache for loaded modes
const modeCache = new Map<string, CustomizedMode>();

/**
 * Type guard to check if value is a valid BandWindow
 */
function isBandWindow(value: unknown): value is BandWindow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'f_start_hz' in value &&
    'f_end_hz' in value &&
    typeof (value as any).f_start_hz === 'number' &&
    typeof (value as any).f_end_hz === 'number' &&
    (value as any).f_start_hz >= 0 &&
    (value as any).f_end_hz > (value as any).f_start_hz
  );
}

/**
 * Type guard to check if value is a valid SliderSpec
 */
function isSliderSpec(value: unknown): value is SliderSpec {
  if (typeof value !== 'object' || value === null) return false;
  
  const spec = value as any;
  return (
    typeof spec.id === 'string' &&
    spec.id.length > 0 &&
    typeof spec.label === 'string' &&
    spec.label.length > 0 &&
    typeof spec.defaultScale === 'number' &&
    spec.defaultScale >= 0 &&
    spec.defaultScale <= 2 &&
    Array.isArray(spec.windows) &&
    spec.windows.length > 0 &&
    spec.windows.every(isBandWindow)
  );
}

/**
 * Assert that value is a valid CustomizedMode
 * @throws Error if validation fails
 */
export function assertCustomizedMode(schema: unknown): asserts schema is CustomizedMode {
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Schema must be an object');
  }

  const mode = schema as any;

  if (typeof mode.name !== 'string' || mode.name.length === 0) {
    throw new Error('Mode must have a non-empty name');
  }

  if (typeof mode.description !== 'string') {
    throw new Error('Mode must have a description');
  }

  if (!Array.isArray(mode.sliders) || mode.sliders.length === 0) {
    throw new Error('Mode must have at least one slider');
  }

  mode.sliders.forEach((slider: unknown, idx: number) => {
    if (!isSliderSpec(slider)) {
      throw new Error(`Invalid slider at index ${idx}: ${JSON.stringify(slider)}`);
    }
  });

  // Check for duplicate slider IDs
  const ids = new Set<string>();
  mode.sliders.forEach((slider: SliderSpec) => {
    if (ids.has(slider.id)) {
      throw new Error(`Duplicate slider ID: ${slider.id}`);
    }
    ids.add(slider.id);
  });
}

/**
 * Load and validate a customized mode from JSON
 * @param modeName - Name of the mode file (without .json extension)
 * @returns Validated CustomizedMode
 */
export async function loadCustomizedMode(modeName: string): Promise<CustomizedMode> {
  // Check cache first
  if (modeCache.has(modeName)) {
    return modeCache.get(modeName)!;
  }

  try {
    const response = await fetch(`/modes/${modeName}.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to load mode "${modeName}": ${response.statusText}`);
    }

    const schema = await response.json();
    
    // Validate schema
    assertCustomizedMode(schema);
    
    // Cache the validated mode
    modeCache.set(modeName, schema);
    
    return schema;
  } catch (error) {
    throw new Error(
      `Error loading customized mode "${modeName}": ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Convert slider specifications with current scales to BandSpec array
 * @param sliders - Slider specifications from mode
 * @param currentScales - Map of slider ID to current scale value
 * @returns Array of BandSpec for STFT processing
 */
export function buildBandSpecsFromSliders(
  sliders: SliderSpec[],
  currentScales: Map<string, number>
): BandSpec[] {
  return sliders.map(slider => ({
    scale: currentScales.get(slider.id) ?? slider.defaultScale,
    windows: slider.windows,
  }));
}

/**
 * Initialize slider scales map with default values
 * @param sliders - Slider specifications from mode
 * @returns Map of slider ID to default scale
 */
export function initializeSliderScales(sliders: SliderSpec[]): Map<string, number> {
  const scales = new Map<string, number>();
  sliders.forEach(slider => {
    scales.set(slider.id, slider.defaultScale);
  });
  return scales;
}

/**
 * Validate and clamp a scale value
 * @param scale - Scale value to validate
 * @returns Clamped scale in range [0, 2]
 */
export function validateScale(scale: number): number {
  if (isNaN(scale)) return 1.0;
  return Math.max(0, Math.min(2, scale));
}

/**
 * Clear mode cache (useful for testing)
 */
export function clearModeCache(): void {
  modeCache.clear();
}
