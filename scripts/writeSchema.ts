import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { configSchema } from '../src/config/schema.ts';

const outputPath = join(import.meta.dirname, '..', 'schema.json');

const SCHEMA_ID = 'https://lewis-wow.github.io/claude-bit/schema.json';

const { $schema, ...generated } = z.toJSONSchema(configSchema, { io: 'input' });

const jsonSchema = {
  $schema,
  $id: SCHEMA_ID,
  title: 'claude-bit configuration',
  ...generated,
};

writeFileSync(outputPath, `${JSON.stringify(jsonSchema, undefined, 2)}\n`);
console.log(`wrote ${outputPath}`);
