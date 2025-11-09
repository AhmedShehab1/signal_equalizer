/**
 * Unit tests for customized modes loader
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  assertCustomizedMode, 
  loadCustomizedMode, 
  buildBandSpecsFromSliders, 
  initializeSliderScales,
  validateScale 
} from '../modes';
import { CustomizedMode, SliderSpec } from '../../model/types';

describe('assertCustomizedMode', () => {
  it('should accept valid customized mode schema', () => {
    const validMode: CustomizedMode = {
      name: 'Test Mode',
      description: 'Test description',
      sliders: [
        {
          id: 'test_slider',
          label: 'Test Slider',
          defaultScale: 1.0,
          windows: [{ f_start_hz: 100, f_end_hz: 200 }],
        },
      ],
    };

    expect(() => assertCustomizedMode(validMode)).not.toThrow();
  });

  it('should reject mode with missing name', () => {
    const invalidMode = {
      description: 'Test',
      sliders: [],
    };

    expect(() => assertCustomizedMode(invalidMode)).toThrow('Mode must have a non-empty name');
  });

  it('should reject mode with invalid slider structure', () => {
    const invalidMode = {
      name: 'Test',
      description: 'Test',
      sliders: [
        {
          id: 'test',
          label: 'Test',
          defaultScale: 1.0,
          // Missing windows array
        },
      ],
    };

    expect(() => assertCustomizedMode(invalidMode)).toThrow('Invalid slider');
  });

  it('should reject slider with invalid window structure', () => {
    const invalidMode = {
      name: 'Test',
      description: 'Test',
      sliders: [
        {
          id: 'test',
          label: 'Test',
          defaultScale: 1.0,
          windows: [
            { f_start_hz: 100 }, // Missing f_end_hz
          ],
        },
      ],
    };

    expect(() => assertCustomizedMode(invalidMode)).toThrow('Invalid slider');
  });

  it('should reject slider with invalid defaultScale', () => {
    const invalidMode = {
      name: 'Test',
      description: 'Test',
      sliders: [
        {
          id: 'test',
          label: 'Test',
          defaultScale: -0.5, // Invalid: negative
          windows: [{ f_start_hz: 100, f_end_hz: 200 }],
        },
      ],
    };

    expect(() => assertCustomizedMode(invalidMode)).toThrow('Invalid slider');
  });

  it('should reject slider with defaultScale > 2', () => {
    const invalidMode = {
      name: 'Test',
      description: 'Test',
      sliders: [
        {
          id: 'test',
          label: 'Test',
          defaultScale: 2.5,
          windows: [{ f_start_hz: 100, f_end_hz: 200 }],
        },
      ],
    };

    expect(() => assertCustomizedMode(invalidMode)).toThrow('Invalid slider');
  });
});

describe('buildBandSpecsFromSliders', () => {
  const testSliders: SliderSpec[] = [
    {
      id: 'bass',
      label: 'Bass',
      defaultScale: 1.0,
      windows: [
        { f_start_hz: 20, f_end_hz: 100 },
        { f_start_hz: 100, f_end_hz: 250 },
      ],
    },
    {
      id: 'mid',
      label: 'Mid',
      defaultScale: 1.0,
      windows: [{ f_start_hz: 250, f_end_hz: 2000 }],
    },
  ];

  it('should convert sliders to BandSpec array', () => {
    const scales = new Map([
      ['bass', 1.5],
      ['mid', 0.8],
    ]);

    const bandSpecs = buildBandSpecsFromSliders(testSliders, scales);

    expect(bandSpecs).toHaveLength(2);
    expect(bandSpecs[0]).toEqual({
      scale: 1.5,
      windows: [
        { f_start_hz: 20, f_end_hz: 100 },
        { f_start_hz: 100, f_end_hz: 250 },
      ],
    });
    expect(bandSpecs[1]).toEqual({
      scale: 0.8,
      windows: [{ f_start_hz: 250, f_end_hz: 2000 }],
    });
  });

  it('should use defaultScale when slider not in scales map', () => {
    const scales = new Map([['bass', 1.5]]);
    // 'mid' is missing from scales

    const bandSpecs = buildBandSpecsFromSliders(testSliders, scales);

    expect(bandSpecs[0].scale).toBe(1.5);
    expect(bandSpecs[1].scale).toBe(1.0); // Default
  });

  it('should preserve multi-window structure', () => {
    const scales = new Map([
      ['bass', 1.2],
      ['mid', 1.0],
    ]);

    const bandSpecs = buildBandSpecsFromSliders(testSliders, scales);

    expect(bandSpecs[0].windows).toHaveLength(2);
    expect(bandSpecs[1].windows).toHaveLength(1);
  });
});

describe('initializeSliderScales', () => {
  it('should create map with default scales', () => {
    const sliders: SliderSpec[] = [
      {
        id: 'slider1',
        label: 'Slider 1',
        defaultScale: 1.2,
        windows: [{ f_start_hz: 100, f_end_hz: 200 }],
      },
      {
        id: 'slider2',
        label: 'Slider 2',
        defaultScale: 0.8,
        windows: [{ f_start_hz: 300, f_end_hz: 400 }],
      },
    ];

    const scales = initializeSliderScales(sliders);

    expect(scales.size).toBe(2);
    expect(scales.get('slider1')).toBe(1.2);
    expect(scales.get('slider2')).toBe(0.8);
  });

  it('should handle empty sliders array', () => {
    const scales = initializeSliderScales([]);
    expect(scales.size).toBe(0);
  });
});

describe('validateScale', () => {
  it('should clamp scale to [0, 2] range', () => {
    expect(validateScale(-0.5)).toBe(0);
    expect(validateScale(0)).toBe(0);
    expect(validateScale(1.0)).toBe(1.0);
    expect(validateScale(2.0)).toBe(2.0);
    expect(validateScale(2.5)).toBe(2.0);
  });

  it('should handle edge cases', () => {
    expect(validateScale(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(validateScale(Number.POSITIVE_INFINITY)).toBe(2);
    expect(validateScale(NaN)).toBe(1); // NaN defaults to 1
  });
});

describe('loadCustomizedMode (integration)', () => {
  beforeEach(() => {
    // Clear module cache to reset loadCustomizedMode cache
    vi.resetModules();
  });

  it('should cache loaded modes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    
    const mockMode: CustomizedMode = {
      name: 'Musical Instruments',
      description: 'EQ for instruments',
      sliders: [
        {
          id: 'bass',
          label: 'Bass',
          defaultScale: 1.0,
          windows: [{ f_start_hz: 20, f_end_hz: 250 }],
        },
      ],
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMode,
    } as Response);

    // First call - should fetch
    const mode1 = await loadCustomizedMode('musical_instruments');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mode1.name).toBe('Musical Instruments');

    // Second call - should use cache
    const mode2 = await loadCustomizedMode('musical_instruments');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1, not 2
    expect(mode2).toBe(mode1); // Same object reference

    fetchSpy.mockRestore();
  });

  it('should throw on fetch error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadCustomizedMode('nonexistent')).rejects.toThrow('Failed to load mode');

    fetchSpy.mockRestore();
  });

  it('should validate loaded JSON schema', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    
    const invalidMode = {
      name: 'Invalid',
      // Missing description and sliders
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidMode,
    } as Response);

    await expect(loadCustomizedMode('invalid')).rejects.toThrow('Mode must have a description');

    fetchSpy.mockRestore();
  });
});
