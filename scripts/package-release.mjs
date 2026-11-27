import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const manifestPath = resolve(rootDir, 'public/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const version = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`无效版本号: ${version}`);
  process.exit(1);
}

// 1. 校验 package.json 与 manifest.json 版本号一致
if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`已同步 public/manifest.json 版本号为 ${version}`);
}

// 2. 执行严格类型检查与生产构建
console.log('==> 运行类型检查与构建 (pnpm check)...');
execSync('pnpm check', { cwd: rootDir, stdio: 'inherit' });

// 3. 打包 dist/ 为可直接解压加载的 Chrome 扩展 ZIP
const releaseDir = resolve(rootDir, 'release');
rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const versionedZip = `google-ai-hub-v${version}.zip`;
const fixedZip = 'google-ai-hub-chrome.zip';
const versionedZipPath = resolve(releaseDir, versionedZip);
const fixedZipPath = resolve(releaseDir, fixedZip);

console.log(`==> 打包扩展压缩包: release/${versionedZip}`);
execSync(`zip -r -X -q "${versionedZipPath}" .`, {
  cwd: resolve(rootDir, 'dist'),
  stdio: 'inherit',
});
execSync(`cp "${versionedZipPath}" "${fixedZipPath}"`, { stdio: 'inherit' });

// 4. 生成 SHA256 校验文件
const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const checksums = [
  `${sha256(versionedZipPath)}  ${versionedZip}`,
  `${sha256(fixedZipPath)}  ${fixedZip}`,
].join('\n');

writeFileSync(resolve(releaseDir, 'SHA256SUMS.txt'), `${checksums}\n`, 'utf8');

console.log('\n✅ 发布包已生成：');
console.log(`   - release/${versionedZip}`);
console.log(`   - release/${fixedZip}`);
console.log('   - release/SHA256SUMS.txt\n');
console.log('如需触发 GitHub 自动发版（GitHub Release + 官网部署），推送代码后执行：');
console.log(`   git tag v${version} && git push origin v${version}\n`);
