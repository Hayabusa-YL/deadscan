// 分类器：将孤儿脚本分为死代码、手动工具、动态调用
import { basename } from 'node:path'

export function classify(analyzed, opts = {}) {
  const { calledBy, fileMap, totalFiles } = analyzed

  const dynamicPatterns = opts.dynamicPatterns || [
    /^_/,                           // 下划线开头 = 一次性探针
    /^patch-.*\.(mjs|js|ps1)$/,     // 补丁脚本
    /^lib[\\/].*\.(mjs|js)$/,      // 库模块，动态 import
    /^hide-.*\.(vbs|ps1)$/,        // 隐藏启动脚本
    /^watchdog-.*\.(vbs|ps1)$/,     // 看门狗
  ]

  const manualKeywords = opts.manualKeywords || [
    'manual', 'hand', 'probe', 'bench',
    'inspect', 'debug', 'check', 'audit',
    'test', 'demo', 'exp', 'backup'
  ]

  const orphan = []
  const called = []
  const dynamic = []
  const manual = []
  const dead = []

  for (const [path, callers] of calledBy) {
    const f = fileMap.get(path)
    if (!f) continue

    const name = basename(path)
    const count = callers.length

    if (count > 0) {
      called.push({ file: f, refCount: count, callers: callers.slice(0, 10) })
      continue
    }

    orphan.push({ file: f, callers: [] })

    // 判动态
    if (dynamicPatterns.some((re) => re.test(name) || re.test(f.relative))) {
      dynamic.push({ file: f, reason: 'matched dynamic pattern' })
      continue
    }

    // 判手动（文件名含关键词 + 没有调用方 = 大概率是手动工具）
    const nameLower = name.toLowerCase()
    if (manualKeywords.some((kw) => nameLower.includes(kw))) {
      manual.push({ file: f, reason: 'likely manual (keyword match)' })
      continue
    }

    // 没有任何引用 → 死代码
    dead.push({ file: f, reason: 'no callers found' })
  }

  const healthScore = totalFiles > 0
    ? Math.round((called.length / totalFiles) * 100)
    : 100

  return {
    totalFiles,
    called: called.length,
    orphan: orphan.length,
    dynamic: dynamic.length,
    manual: manual.length,
    dead: dead.length,
    healthScore,
    items: { called, dynamic, manual, dead },
  }
}