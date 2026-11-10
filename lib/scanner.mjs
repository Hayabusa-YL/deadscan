// 文件扫描器：遍历目录，识别脚本文件
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DEFAULT_SCRIPT_EXTS = ['.mjs', '.js', '.ts', '.ps1', '.py', '.rb', '.go', '.rs', '.bat', '.cmd', '.sh', '.vbs']
const DEFAULT_SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.next', '.nuxt', 'coverage', '.cache', 'tmp', 'temp',
  '.DS_Store'
])
const DEFAULT_SKIP_PREFIXES = ['.', '_']

export function scan(rootDir, opts = {}) {
  const skipDirs = new Set([...DEFAULT_SKIP_DIRS, ...(opts.skipDirs || [])])
  const skipPrefixes = [...DEFAULT_SKIP_PREFIXES, ...(opts.skipPrefixes || [])]
  const exts = opts.extensions || DEFAULT_SCRIPT_EXTS
  const maxDepth = opts.maxDepth || 50

  const files = []

  function walk(dir, depth) {
    if (depth > maxDepth) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) }
    catch { return }

    for (const e of entries) {
      const name = e.name
      if (e.isDirectory()) {
        if (skipDirs.has(name)) continue
        if (skipPrefixes.some((p) => name.startsWith(p))) continue
        walk(join(dir, name), depth + 1)
      } else if (e.isFile()) {
        if (exts.includes(extname(name).toLowerCase())) {
          try {
            const stat = statSync(join(dir, name))
            files.push({
              path: join(dir, name),
              name,
              relative: join(dir, name).slice(rootDir.length + 1),
              size: stat.size,
              mtime: stat.mtimeMs,
            })
          } catch {}
        }
      }
    }
  }

  walk(rootDir, 0)
  return files
}