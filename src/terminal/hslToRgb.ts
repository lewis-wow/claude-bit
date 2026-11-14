import { ColorChannel } from './colorChannel.ts';

export type Rgb = Record<ColorChannel, number>;

const DEGREES_IN_TURN = 360;
const DEGREES_PER_SECTOR = 60;
const SECTORS = 6;
const CHANNEL_MAXIMUM = 255;

const sectorChannels = (sector: number, chroma: number, blend: number): [number, number, number] => {
  if (sector === 0) return [chroma, blend, 0];
  if (sector === 1) return [blend, chroma, 0];
  if (sector === 2) return [0, chroma, blend];
  if (sector === 3) return [0, blend, chroma];
  if (sector === 4) return [blend, 0, chroma];

  return [chroma, 0, blend];
};

export const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
  const turned = ((hue % DEGREES_IN_TURN) + DEGREES_IN_TURN) % DEGREES_IN_TURN;
  const position = turned / DEGREES_PER_SECTOR;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const blend = chroma * (1 - Math.abs((position % 2) - 1));
  const floor = lightness - chroma / 2;

  const [red, green, blue] = sectorChannels(Math.floor(position) % SECTORS, chroma, blend);
  const scale = (channel: number) => Math.round((channel + floor) * CHANNEL_MAXIMUM);

  return {
    [ColorChannel.Red]: scale(red),
    [ColorChannel.Green]: scale(green),
    [ColorChannel.Blue]: scale(blue),
  };
};
