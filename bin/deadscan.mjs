#!/usr/bin/env node
// DeadScan · 代码库死代码与孤儿脚本检测 CLI
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { scan } from '../lib/scanner.mjs'
import { analyze } from '../lib/analyzer.mjs'
import { classify } from '../lib/classifier.mjs'
import { terminalReport, htmlReport } from '../lib/reporter.mjs'

const args = process.argv.slice(2)
const flags = {
  dir: null,
  json: args.includes('--json') || args.includes('-j'),
  report: args.includes('--report') || args.includes('-r'),
  output: null,
  help: args.includes('--help') || args.includes('-h'),
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' || args[i] === '-d') flags.dir = args[++i]
  if (args[i] === '--output' || args[i] === '-o') flags.output = args[++i]
}

if (flags.help) {
  console.log(`
DeadScan · 代码库死代码与孤儿脚本检测

用法:
  deadscan [目录]                   默认扫描当前目录
  deadscan --dir <path>             指定目录
  deadscan --json                   输出 JSON
  deadscan --report                 生成 HTML 健康报告
  deadscan --output <path>          指定报告输出路径

示例:
  deadscan .
  deadscan --dir ~/my-project --json
  deadscan --dir ~/repo --report --output report.html
`)
  process.exit(0)
}

const rootDir = resolve(flags.dir || args.find((a) => !a.startsWith('-')) || '.')
if (!existsSync(rootDir)) {
  console.error(`目录不存在: ${rootDir}`)
  process.exit(1)
}

// 读配置
let config = {}
const configPath = resolve(rootDir, '.deadscanrc.json')
if (existsSync(configPath)) {
  try { config = JSON.parse(readFileSync(configPath, 'utf8')) } catch {}
}

// 执行扫描
const files = scan(rootDir, config)
const analyzed = analyze(files, rootDir)
const classified = classify(analyzed, config)

if (flags.json) {
  console.log(JSON.stringify({
    root: rootDir,
    ...classified,
    items: {
      dead: classified.items.dead.map((d) => ({ path: d.file.relative, size: d.file.size, reason: d.reason })),
      manual: classified.items.manual.map((m) => ({ path: m.file.relative, reason: m.reason })),
    },
  }, null, 2))
} else {
  console.log(terminalReport(classified, rootDir))
}

if (flags.report) {
  const outPath = flags.output || resolve(rootDir, 'deadscan-report.html')
  htmlReport(classified, rootDir, outPath)
  console.log(`\n  HTML 报告已生成: ${outPath}`)
}

// 有死代码 → 非零退出
if (classified.dead > 0) process.exitCode = 1