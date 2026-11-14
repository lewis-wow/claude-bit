import { describe, expect, it } from 'vitest';

import { hslToRgb } from './hslToRgb.ts';

describe('hslToRgb', () => {
  it('turns the primaries into their corners of the cube', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual({ red: 255, green: 0, blue: 0 });
    expect(hslToRgb(120, 1, 0.5)).toEqual({ red: 0, green: 255, blue: 0 });
    expect(hslToRgb(240, 1, 0.5)).toEqual({ red: 0, green: 0, blue: 255 });
  });

  it('drains the colour out at zero saturation', () => {
    expect(hslToRgb(200, 0, 0.5)).toEqual({ red: 128, green: 128, blue: 128 });
  });

  it('reaches black and white at the ends of lightness', () => {
    expect(hslToRgb(200, 1, 0)).toEqual({ red: 0, green: 0, blue: 0 });
    expect(hslToRgb(200, 1, 1)).toEqual({ red: 255, green: 255, blue: 255 });
  });

  it('wraps a hue that has gone round the circle', () => {
    expect(hslToRgb(390, 0.7, 0.6)).toEqual(hslToRgb(30, 0.7, 0.6));
    expect(hslToRgb(-30, 0.7, 0.6)).toEqual(hslToRgb(330, 0.7, 0.6));
  });

  it('keeps every channel inside a byte', () => {
    for (let hue = 0; hue < 360; hue += 1) {
      for (const channel of Object.values(hslToRgb(hue, 0.68, 0.62))) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});
