import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pkgPath = resolve(rootDir, 'package.json');
const manifestPath = resolve(rootDir, 'public/manifest.json');

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: rootDir, encoding: 'utf8', ...options });
}

function bumpVersion(current, mode) {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`当前版本号格式不合法: ${current}`);
  }
  const [major, minor, patch] = parts;

  if (mode === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (mode === 'minor') return `${major}.${minor + 1}.0`;
  if (mode === 'major') return `${major + 1}.0.0`;
  if (mode === 'current') return current;
  if (/^\d+\.\d+\.\d+$/.test(mode)) return mode;

  throw new Error(
    `不支持的版本参数: "${mode}"。可选：patch（默认）、minor、major、current 或具体版本号（如 1.0.0）`
  );
}

// 1. 解析参数：支持 --dry-run 以及 patch（默认）/ minor / major / current / x.y.z
const args = process.argv.slice(2).filter((a) => a !== '--');
const isDryRun = args.includes('--dry-run') || args.includes('-n');
const modeArg = args.find((a) => !a.startsWith('-')) ?? 'patch';

const origPkgText = readFileSync(pkgPath, 'utf8');
const origManifestText = readFileSync(manifestPath, 'utf8');
const pkg = JSON.parse(origPkgText);
const manifest = JSON.parse(origManifestText);

const nextVersion = bumpVersion(pkg.version, modeArg);
const tag = `v${nextVersion}`;
const versionChanged = pkg.version !== nextVersion || manifest.version !== nextVersion;

// 2. 检查工作区与标签状态
const status = run('git status --porcelain').trim();
const localTags = run('git tag -l')
  .split('\n')
  .map((t) => t.trim());
const tagExists = localTags.includes(tag);

if (isDryRun) {
  console.log('🧪 [DRY RUN] 预演模式（不会修改文件、不会 commit、不会打标签或推送）');
  console.log(`   当前版本: ${pkg.version}`);
  console.log(`   目标版本: ${nextVersion}（模式: ${modeArg}）`);
  console.log(`   目标标签: ${tag}${tagExists ? '  ⚠️ 本地已存在同名标签' : ''}`);
  console.log(`   工作区状态: ${status ? '⚠️ 存在未提交改动' : '✅ 干净'}`);
  console.log('\n将按顺序执行：');
  if (versionChanged) {
    console.log(`   1. 更新 package.json 与 public/manifest.json 版本号 -> ${nextVersion}`);
  }
  console.log('   2. 运行 pnpm package（类型检查 + 生产构建 + 生成 release/*.zip 与 SHA256SUMS.txt）');
  if (versionChanged) {
    console.log(`   3. git add package.json public/manifest.json && git commit -m "chore: release ${tag}"`);
  }
  console.log('   4. git push origin HEAD');
  console.log(`   5. git tag -a "${tag}" -m "Release ${tag}" && git push origin "${tag}"\n`);
  process.exit(0);
}

if (status) {
  console.error('❌ 当前 git 工作区还有未提交的改动，请先 commit 后再执行 pnpm release：');
  console.error(status);
  process.exit(1);
}

if (tagExists) {
  console.error(`❌ 本地已存在标签 ${tag}，请更换版本递增方式或指定新版本号。`);
  process.exit(1);
}

try {
  // 3. 更新 package.json 与 public/manifest.json 版本号
  if (versionChanged) {
    pkg.version = nextVersion;
    manifest.version = nextVersion;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`==> 版本号已更新为 ${nextVersion}`);
  }

  // 4. 本地校验、构建并打包 ZIP（失败则回滚版本号）
  console.log(`==> 正在校验并预打包 ${tag}...`);
  execSync('pnpm package', { cwd: rootDir, stdio: 'inherit' });

  // 5. 提交版本号改动并推送当前分支 + 标签
  if (versionChanged) {
    execSync('git add package.json public/manifest.json', { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "chore: release ${tag}"`, { cwd: rootDir, stdio: 'inherit' });
  }

  console.log(`==> 推送代码与标签 ${tag} 到 origin...`);
  execSync('git push origin HEAD', { cwd: rootDir, stdio: 'inherit' });
  execSync(`git tag -a "${tag}" -m "Release ${tag}"`, { cwd: rootDir, stdio: 'inherit' });
  execSync(`git push origin "${tag}"`, { cwd: rootDir, stdio: 'inherit' });

  console.log(`\n🚀 已发布 ${tag}！GitHub Actions 正在自动构建并发布 GitHub Release：`);
  console.log('   查看构建进度：https://github.com/kirktools/google-ai-hub/actions');
  console.log('   查看正式版本：https://github.com/kirktools/google-ai-hub/releases\n');
} catch {
  writeFileSync(pkgPath, origPkgText, 'utf8');
  writeFileSync(manifestPath, origManifestText, 'utf8');
  console.error('\n❌ 发布中断，已回滚版本号文件。');
  process.exit(1);
}
