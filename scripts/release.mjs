import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: rootDir, encoding: 'utf8', ...options });
}

// 1. 检查工作区是否干净，避免漏提交代码
const status = run('git status --porcelain').trim();
if (status) {
  console.error('❌ 当前 git 工作区还有未提交的改动，请先 commit 并推送代码后再执行 pnpm release：');
  console.error(status);
  process.exit(1);
}

// 2. 先在本地执行完整校验与打包（确保零报错再打标签）
console.log(`==> 正在校验并预打包 ${tag}...`);
execSync('pnpm package', { cwd: rootDir, stdio: 'inherit' });

// 3. 检查本地和远程是否已存在该标签
const localTags = run('git tag -l').split('\n').map((t) => t.trim());
if (localTags.includes(tag)) {
  console.error(`❌ 本地已存在标签 ${tag}。如需发新版本，请先更新 package.json 中的 version。`);
  process.exit(1);
}

// 4. 创建附注标签并推送到 origin，触发 GitHub Actions 自动发版
console.log(`==> 创建标签 ${tag} 并推送到 origin...`);
execSync(`git tag -a "${tag}" -m "Release ${tag}"`, { cwd: rootDir, stdio: 'inherit' });
execSync(`git push origin "${tag}"`, { cwd: rootDir, stdio: 'inherit' });

console.log(`\n🚀 已推送标签 ${tag}，GitHub Actions 正在自动构建并发布 GitHub Release！`);
console.log('   查看发布进度：https://github.com/kirktools/google-ai-hub/actions');
console.log('   查看正式版本：https://github.com/kirktools/google-ai-hub/releases\n');
