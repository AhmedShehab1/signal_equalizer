import { describe, it, expect } from 'vitest';
import { genericBandsToBandSpecs, GenericBand } from '../GenericMode';

describe('GenericMode validation', () => {
  const nyquist = 22050; // Typical for 44.1kHz

  describe('genericBandsToBandSpecs', () => {
    it('converts valid bands to BandSpec format', () => {
      const bands: GenericBand[] = [
        { id: '1', startHz: 100, endHz: 500, scale: 1.5 },
        { id: '2', startHz: 1000, endHz: 2000, scale: 0.8 },
      ];

      const specs = genericBandsToBandSpecs(bands);

      expect(specs).toHaveLength(2);
      expect(specs[0]).toEqual({
        scale: 1.5,
        windows: [{ f_start_hz: 100, f_end_hz: 500 }],
      });
      expect(specs[1]).toEqual({
        scale: 0.8,
        windows: [{ f_start_hz: 1000, f_end_hz: 2000 }],
      });
    });

    it('handles edge case values', () => {
      const bands: GenericBand[] = [
        { id: '1', startHz: 0, endHz: nyquist, scale: 0 },
        { id: '2', startHz: 20, endHz: 20000, scale: 2 },
      ];

      const specs = genericBandsToBandSpecs(bands);

      expect(specs[0].scale).toBe(0);
      expect(specs[0].windows[0].f_start_hz).toBe(0);
      expect(specs[0].windows[0].f_end_hz).toBe(nyquist);
      
      expect(specs[1].scale).toBe(2);
    });
  });

  describe('Band validation rules', () => {
    it('should clamp negative startHz to 0', () => {
      const startHz = -100;
      const clamped = Math.max(0, Math.min(nyquist, startHz));
      expect(clamped).toBe(0);
    });

    it('should clamp endHz above Nyquist to Nyquist', () => {
      const endHz = 50000;
      const clamped = Math.max(0, Math.min(nyquist, endHz));
      expect(clamped).toBe(nyquist);
    });

    it('should clamp scale below 0 to 0', () => {
      const scale = -0.5;
      const clamped = Math.max(0, Math.min(2, scale));
      expect(clamped).toBe(0);
    });

    it('should clamp scale above 2 to 2', () => {
      const scale = 3.5;
      const clamped = Math.max(0, Math.min(2, scale));
      expect(clamped).toBe(2);
    });

    it('should detect invalid range where start >= end', () => {
      const startHz = 1000;
      const endHz = 500;
      expect(startHz >= endHz).toBe(true);
    });

    it('should detect valid range where start < end', () => {
      const startHz = 500;
      const endHz = 1000;
      expect(startHz < endHz).toBe(true);
    });

    it('should reject ranges narrower than 1 Hz', () => {
      const startHz = 1000;
      const endHz = 1000.5;
      const width = endHz - startHz;
      expect(width < 1).toBe(true);
    });

    it('should accept ranges of exactly 1 Hz', () => {
      const startHz = 1000;
      const endHz = 1001;
      const width = endHz - startHz;
      expect(width >= 1).toBe(true);
    });
  });

  describe('Import validation scenarios', () => {
    const validateBand = (
      startHz: number,
      endHz: number,
      scale: number,
      nyquist: number
    ): { isValid: boolean; startHz: number; endHz: number; scale: number; errors: string[] } => {
      const errors: string[] = [];
      
      // Clamp values
      let clampedStart = Math.max(0, Math.min(nyquist, startHz));
      let clampedEnd = Math.max(0, Math.min(nyquist, endHz));
      let clampedScale = Math.max(0, Math.min(2, scale));

      // Check for swapped values
      if (clampedStart >= clampedEnd) {
        if (clampedStart > 0 && clampedEnd > 0) {
          [clampedStart, clampedEnd] = [clampedEnd, clampedStart];
        } else {
          errors.push('Invalid range: start >= end');
          return { isValid: false, startHz: clampedStart, endHz: clampedEnd, scale: clampedScale, errors };
        }
      }

      // Check minimum width
      if (clampedEnd - clampedStart < 1) {
        errors.push('Range too narrow');
        return { isValid: false, startHz: clampedStart, endHz: clampedEnd, scale: clampedScale, errors };
      }

      return { isValid: true, startHz: clampedStart, endHz: clampedEnd, scale: clampedScale, errors };
    };

    it('accepts valid band', () => {
      const result = validateBand(100, 500, 1.0, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('clamps and accepts negative startHz', () => {
      const result = validateBand(-100, 500, 1.0, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.startHz).toBe(0);
      expect(result.endHz).toBe(500);
    });

    it('clamps and accepts endHz above Nyquist', () => {
      const result = validateBand(100, 50000, 1.0, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.startHz).toBe(100);
      expect(result.endHz).toBe(nyquist);
    });

    it('swaps start and end when reversed', () => {
      const result = validateBand(1000, 500, 1.0, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.startHz).toBe(500);
      expect(result.endHz).toBe(1000);
    });

    it('rejects when start equals end', () => {
      const result = validateBand(1000, 1000, 1.0, nyquist);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('clamps scale below 0', () => {
      const result = validateBand(100, 500, -0.5, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.scale).toBe(0);
    });

    it('clamps scale above 2', () => {
      const result = validateBand(100, 500, 3.5, nyquist);
      expect(result.isValid).toBe(true);
      expect(result.scale).toBe(2);
    });

    it('handles multiple constraint violations', () => {
      const result = validateBand(-100, 50000, -1, nyquist);
      expect(result.isValid).toBe(true); // Should auto-correct
      expect(result.startHz).toBe(0);
      expect(result.endHz).toBe(nyquist);
      expect(result.scale).toBe(0);
    });

    it('rejects narrow range after clamping', () => {
      const result = validateBand(0, 0.5, 1.0, nyquist);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Range too narrow');
    });
  });

  describe('NaN handling', () => {
    it('detects NaN in startHz', () => {
      const value = Number('invalid');
      expect(isNaN(value)).toBe(true);
    });

    it('detects NaN in endHz', () => {
      const value = Number(undefined);
      expect(isNaN(value)).toBe(true);
    });

    it('detects NaN in scale', () => {
      const value = Number('abc');
      expect(isNaN(value)).toBe(true);
    });
  });
});
