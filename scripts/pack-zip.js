import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const staging = path.resolve(root, '.deploy-staging');
const zipOutput = path.resolve(root, 'sapa-deploy.zip');

// Clean staging & old zip
if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
if (fs.existsSync(zipOutput)) fs.rmSync(zipOutput, { force: true });

fs.mkdirSync(staging, { recursive: true });

function copyDir(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(srcPath, entry)) continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('1. Building frontend production bundle (apps/web/dist)...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('2. Staging production files (excluding node_modules, tests, and git)...');
const ignoreUnneeded = (p, entry) => 
  entry.name !== 'node_modules' && 
  entry.name !== '.git' && 
  entry.name !== 'test' && 
  entry.name !== 'tests' && 
  !entry.name.endsWith('.test.js');

copyDir(path.join(root, 'apps', 'api'), path.join(staging, 'apps', 'api'), ignoreUnneeded);
copyDir(path.join(root, 'apps', 'worker'), path.join(staging, 'apps', 'worker'), ignoreUnneeded);
copyDir(path.join(root, 'apps', 'web', 'dist'), path.join(staging, 'apps', 'web', 'dist'));
// Web package.json for workspace resolution without build dependencies
fs.writeFileSync(
  path.join(staging, 'apps', 'web', 'package.json'),
  JSON.stringify({
    name: '@bps/web',
    version: '1.0.0',
    private: true,
    type: 'module'
  }, null, 2)
);

copyDir(path.join(root, 'packages'), path.join(staging, 'packages'), ignoreUnneeded);
copyDir(path.join(root, 'db'), path.join(staging, 'db'));
copyDir(path.join(root, 'scripts'), path.join(staging, 'scripts'));

// Root package.json: strip devDependencies so 'npm install' on server installs only runtime packages
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
delete rootPkg.devDependencies;
rootPkg.engines = { node: '>=18' };
fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify(rootPkg, null, 2));

fs.copyFileSync(path.join(root, '.env.example'), path.join(staging, '.env.example'));

console.log('3. Compressing production package into sapa-deploy.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${staging}/*' -DestinationPath '${zipOutput}' -Force"`, { stdio: 'inherit' });

fs.rmSync(staging, { recursive: true, force: true });
const stats = fs.statSync(zipOutput);
console.log(`\n====================================================`);
console.log(`✅ File ZIP Siap Deploy: sapa-deploy.zip`);
console.log(`📦 Ukuran: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`====================================================`);
