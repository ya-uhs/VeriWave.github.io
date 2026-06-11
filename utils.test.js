import { describe, it, expect } from 'vitest';
import { wavedromRunLength, convertSignalToWaveDrom, formatSvValue, calculateGridStep } from './utils.js';

describe('wavedromRunLength', () => {
  it('encodes consecutive identical chars as dots', () => {
    expect(wavedromRunLength(['1', '1', '1', '0', '0'])).toBe('1..0.');
  });

  it('leaves alternating values unchanged', () => {
    expect(wavedromRunLength(['0', '1', '0', '1'])).toBe('0101');
  });

  it('returns empty string for empty input', () => {
    expect(wavedromRunLength([])).toBe('');
  });

  it('handles single character', () => {
    expect(wavedromRunLength(['1'])).toBe('1');
  });
});

describe('convertSignalToWaveDrom', () => {
  it('encodes binary signal with run-length compression', () => {
    const sig = { name: 'rst', type: 'binary', wave: [0, 0, 0, 1, 1] };
    expect(convertSignalToWaveDrom(sig)).toEqual({ name: 'rst', wave: '0..1.' });
  });

  it('maps null values to x', () => {
    const sig = { name: 'sig', type: 'binary', wave: [null, null, 1] };
    expect(convertSignalToWaveDrom(sig)).toEqual({ name: 'sig', wave: 'x.1' });
  });

  it('encodes bus signal with data array', () => {
    const sig = { name: 'data', type: 'bus', data: ['0xAB', '0xAB', '0xCD', ''] };
    const result = convertSignalToWaveDrom(sig);
    expect(result.wave).toBe('2.2x');
    expect(result.data).toEqual(['0xAB', '0xCD']);
  });

  it('encodes clock signal with run-length compression', () => {
    const sig = { name: 'clk', type: 'clk', wave: [0, 1, 0, 1, 0, 1] };
    expect(convertSignalToWaveDrom(sig)).toEqual({ name: 'clk', wave: '010101' });
  });
});

describe('formatSvValue', () => {
  it('returns plain value for 1-bit signals', () => {
    expect(formatSvValue(1, 1)).toBe('1');
    expect(formatSvValue(0, 1)).toBe('0');
  });

  it('formats hex values', () => {
    expect(formatSvValue('0xAB', 8)).toBe("8'hab");
  });

  it('formats binary values', () => {
    expect(formatSvValue('0b1010', 4)).toBe("4'b1010");
  });

  it('formats decimal values', () => {
    expect(formatSvValue('42', 8)).toBe("8'd42");
  });
});

describe('calculateGridStep', () => {
  it('returns a value within the allowed range', () => {
    for (const steps of [10, 50, 100, 200]) {
      const result = calculateGridStep(steps);
      expect(result).toBeGreaterThanOrEqual(20);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it('returns larger steps for fewer time steps', () => {
    expect(calculateGridStep(10)).toBeGreaterThan(calculateGridStep(100));
  });
});
