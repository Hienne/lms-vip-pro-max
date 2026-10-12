/** CLI: `build-spec <output-file>` writes the document from `buildSpec()`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildSpec } from './openapi';

const outFile = process.argv[2];
if (!outFile) {
  throw new Error('Usage: build-spec <output-file>');
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(buildSpec(), null, 2)}\n`);
console.log(`OpenAPI written to ${outFile}`);
