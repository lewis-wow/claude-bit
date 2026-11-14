import { ChangeType } from '../changeType.ts';
import { hslToRgb } from './hslToRgb.ts';
import type { Rgb } from './hslToRgb.ts';

export type SessionColor = Rgb;

const LIGHTNESS = 0.72;

const TYPE_SATURATION = 0.8;
const FREE_SATURATION = 0.3;

const TYPE_HUES: Record<ChangeType, number> = {
  [ChangeType.Fix]: 35,
  [ChangeType.Test]: 60,
  [ChangeType.Feat]: 130,
  [ChangeType.Ci]: 162,
  [ChangeType.Docs]: 192,
  [ChangeType.Chore]: 228,
  [ChangeType.Refactor]: 272,
  [ChangeType.Perf]: 312,
};

const FIRST_FREE_HUE = 30;
const FREE_HUE_SPAN = 300;
const FREE_HUE_COUNT = 12;
const FREE_HUE_STEP = FREE_HUE_SPAN / FREE_HUE_COUNT;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

const fingerprint = (value: string) => {
  let hash = FNV_OFFSET_BASIS;

  for (const character of value) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME);
  }

  return hash >>> 0;
};

const freeHueFor = (name: string) => FIRST_FREE_HUE + (fingerprint(name) % FREE_HUE_COUNT) * FREE_HUE_STEP;

export const sessionColorFor = (name: string, type: ChangeType | undefined): SessionColor =>
  type === undefined
    ? hslToRgb(freeHueFor(name), FREE_SATURATION, LIGHTNESS)
    : hslToRgb(TYPE_HUES[type], TYPE_SATURATION, LIGHTNESS);
