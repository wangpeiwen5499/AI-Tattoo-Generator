import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

// Preserve the original template's findings explicitly, without disabling rules for new code.
const baseline = JSON.parse(
  readFileSync(new URL('../eslint-baseline.json', import.meta.url), 'utf8')
);
const known = new Set(
  baseline.map((entry) => `${entry.file}|${entry.rule}|${entry.source}`)
);
const eslint = new ESLint();
const results = await eslint.lintFiles(['.']);
let inherited = 0;
let newErrors = 0;
const changed = results.map((result) => {
  const file = path
    .relative(process.cwd(), result.filePath)
    .replaceAll('\\', '/');
  const lines = readFileSync(result.filePath, 'utf8').split(/\r?\n/);
  const messages = result.messages.filter((message) => {
    if (message.severity !== 2) return false;
    const hash = createHash('sha256')
      .update((lines[message.line - 1] || '').trim())
      .digest('hex');
    if (known.has(`${file}|${message.ruleId}|${hash}`)) {
      inherited++;
      return false;
    }
    newErrors++;
    return true;
  });
  return { ...result, messages, errorCount: messages.length, warningCount: 0 };
});
if (newErrors)
  console.log((await eslint.loadFormatter('stylish')).format(changed));
const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
console.log(
  `Lint: ${newErrors} new errors; ${inherited} recorded template errors; ${warnings} warnings. Run npm run lint:strict to see all legacy findings.`
);
process.exitCode = newErrors ? 1 : 0;
