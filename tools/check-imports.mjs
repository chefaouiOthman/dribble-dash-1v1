// Static sanity check: every named import must exist as an export in the target
// module. Cheap safety net before running the game in a browser.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const srcDir = resolve('src');
const files = readdirSync(srcDir).filter((file) => file.endsWith('.js'));

function exportsOf(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    match[1].split(',').forEach((part) => {
      const cleaned = part.trim();
      if (!cleaned) return;
      const alias = cleaned.split(/\s+as\s+/);
      names.add((alias[1] || alias[0]).trim());
    });
  }
  if (/export\s+default/.test(source)) names.add('default');
  return names;
}

const table = new Map();
for (const file of files) {
  table.set(file, exportsOf(readFileSync(join(srcDir, file), 'utf8')));
}

let problems = 0;
for (const file of files) {
  const source = readFileSync(join(srcDir, file), 'utf8');
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g)) {
    const target = match[2];
    const exported = table.get(target);
    if (!exported) {
      console.log(`MISSING MODULE  ${file} -> ${target}`);
      problems += 1;
      continue;
    }
    match[1].split(',').forEach((part) => {
      const cleaned = part.trim();
      if (!cleaned) return;
      const original = cleaned.split(/\s+as\s+/)[0].trim();
      if (!exported.has(original)) {
        console.log(`MISSING EXPORT  ${file}: ${original} <- ${target}`);
        problems += 1;
      }
    });
  }
  for (const match of source.matchAll(/import\s+\*\s+as\s+[A-Za-z0-9_$]+\s+from\s*['"]\.\/([^'"]+)['"]/g)) {
    if (!table.has(match[1])) {
      console.log(`MISSING MODULE  ${file} -> ${match[1]}`);
      problems += 1;
    }
  }
}

console.log(problems === 0 ? `OK: ${files.length} modules, no unresolved imports.` : `${problems} problem(s).`);
process.exitCode = problems === 0 ? 0 : 1;
