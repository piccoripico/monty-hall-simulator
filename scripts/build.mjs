import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const katexDistDir = path.join(rootDir, 'node_modules', 'katex', 'dist');
const xlsxDistDir = path.join(rootDir, 'node_modules', 'xlsx', 'dist');
const vendorKatexDir = path.join(distDir, 'vendor', 'katex');
const vendorXlsxDir = path.join(distDir, 'vendor', 'xlsx');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(srcDir, distDir, { recursive: true });
await mkdir(vendorKatexDir, { recursive: true });
await cp(path.join(katexDistDir, 'katex.mjs'), path.join(vendorKatexDir, 'katex.mjs'));
await cp(path.join(katexDistDir, 'katex.min.css'), path.join(vendorKatexDir, 'katex.min.css'));
await cp(path.join(katexDistDir, 'fonts'), path.join(vendorKatexDir, 'fonts'), { recursive: true });
await mkdir(vendorXlsxDir, { recursive: true });
await cp(path.join(xlsxDistDir, 'xlsx.mini.min.js'), path.join(vendorXlsxDir, 'xlsx.mini.min.js'));
await writeFile(path.join(distDir, '.nojekyll'), '');
