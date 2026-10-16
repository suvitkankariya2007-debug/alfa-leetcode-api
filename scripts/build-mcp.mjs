/**
 * Isolated per-file MCP emitter. Avoids the upstream MCP SDK's generics
 * exhausting CI memory during whole-program TypeScript analysis.
 *
 * IMPORTANT: transpileModule checks syntax only; it does NOT typecheck the MCP.
 * Original REST remains typechecked by npm run build. Run runtime/SDK smoke tests
 * and restore real MCP typechecking before production.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  sourceMap: false,
};
async function walk(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'tests') continue;
      files.push(...await walk(join(folder, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.ts') &&
               !entry.name.endsWith('.d.ts') &&
               !entry.name.endsWith('.test.ts')) {
      files.push(join(folder, entry.name));
    }
  }
  return files;
}
const files = [...await walk(resolve(root, 'src')), ...await walk(resolve(root, 'mcp'))];
let outputCount = 0;
for (const input of files) {
  const source = await readFile(input, 'utf8');
  const emitted = ts.transpileModule(source, { fileName: input, compilerOptions, reportDiagnostics: true });
  const errors = (emitted.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    console.error('MCP transpile syntax error in ' + relative(root,input));
    for (const error of errors) console.error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
    process.exitCode = 1;
    continue;
  }
  const output = resolve(root, 'dist', relative(root, input).replace(/\.ts$/, '.js'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, emitted.outputText, 'utf8');
  outputCount++;
}
if (!process.exitCode) console.log('MCP compilation: emitted ' + outputCount + ' files (transpilation-only)');
