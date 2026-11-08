import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { configSchema } from '../src/config/schema.ts';

/** Regenerates `schema.json` so editors can complete and validate `claude-bit.json`. */

const outputPath = join(import.meta.dirname, '..', 'schema.json');

const jsonSchema = {
  ...z.toJSONSchema(configSchema, { io: 'input' }),
  title: 'claude-bit configuration',
};

writeFileSync(outputPath, `${JSON.stringify(jsonSchema, undefined, 2)}\n`);
console.log(`wrote ${outputPath}`);
