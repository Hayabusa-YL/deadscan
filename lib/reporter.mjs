// 报告生成器：输出终端文本报告和 HTML 可视化报告
import { writeFileSync } from 'node:fs'
import { relative } from 'node:path'

export function terminalReport(classified, rootDir) {
  const { totalFiles, called, orphan, dynamic, manual, dead, healthScore, items } = classified

  const lines = [
    '',
    '═══════════════════════════════════════',
    '  DeadScan · 代码库健康度报告',
    '═══════════════════════════════════════',
    '',
    `  目录: ${rootDir}`,
    `  文件总数: ${totalFiles}`,
    `  有调用方: ${called} (${healthScore}%)`,
    `  孤儿: ${orphan}`,
    `    ├ 动态调用: ${dynamic}`,
    `    ├ 手动工具: ${manual}`,
    `    └ 死代码:  ${dead}`,
    '',
    `  健康度: ${healthBar(healthScore)} ${healthScore}%`,
    '',
  ]

  if (dead > 0) {
    lines.push('  ══ 死代码 ══')
    for (const d of items.dead) {
      lines.push(`  ✗ ${d.file.relative}  (${formatSize(d.file.size)})`)
    }
    lines.push('')
  }

  if (manual > 0 && dead === 0) {
    lines.push('  ══ 手动工具（无自动调用方） ══')
    for (const m of items.manual.slice(0, 10)) {
      lines.push(`  ○ ${m.file.relative}`)
    }
    if (items.manual.length > 10) {
      lines.push(`  ... 另有 ${items.manual.length - 10} 个`)
    }
    lines.push('')
  }

  lines.push('═══════════════════════════════════════')
  return lines.join('\n')
}

export function htmlReport(classified, rootDir, outputPath) {
  const { totalFiles, called, dead, orphan, dynamic, manual, healthScore, items } = classified
  const root = rootDir.replace(/\\/g, '/')

  const deadRows = items.dead.map((d) => `
    <tr>
      <td class="dead">✗</td>
      <td>${escape(d.file.relative)}</td>
      <td>${formatSize(d.file.size)}</td>
      <td>${new Date(d.file.mtime).toLocaleDateString()}</td>
      <td>${d.reason}</td>
    </tr>`).join('')

  const calledRows = items.called.slice(0, 10).map((c) => `
    <tr>
      <td class="ok">✓</td>
      <td>${escape(c.file.relative)}</td>
      <td>${c.refCount}</td>
      <td>${escape(c.callers.slice(0, 2).map((p) => relative(rootDir, p)).join(', '))}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DeadScan · ${root.split('/').pop() || 'Codebase'} 健康度报告</title>
<style>
  * { box-sizing:border-box;margin:0;padding:0 }
  body { font:14px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a1a;background:#f5f5f5;padding:24px }
  .card { max-width:900px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:32px }
  h1 { font-size:22px;margin-bottom:4px }
  h1 span { font-weight:400;color:#666 }
  .meta { color:#888;margin-bottom:24px }
  .score { display:flex;align-items:center;gap:16px;margin:24px 0;padding:24px;background:#f8f9fa;border-radius:8px }
  .score-num { font-size:48px;font-weight:700 }
  .score-bar { flex:1;height:12px;background:#e0e0e0;border-radius:6px;overflow:hidden }
  .score-bar div { height:100%;border-radius:6px;transition:width .5s }
  .stats { display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:24px 0 }
  .stat { text-align:center;padding:16px;background:#f8f9fa;border-radius:6px }
  .stat-num { font-size:24px;font-weight:700 }
  .stat-label { font-size:12px;color:#666;margin-top:4px }
  table { width:100%;border-collapse:collapse;margin:16px 0 }
  th { text-align:left;padding:8px 12px;border-bottom:2px solid #e0e0e0;font-size:12px;text-transform:uppercase;color:#666 }
  td { padding:8px 12px;border-bottom:1px solid #eee;font-size:13px }
  .ok { color:#22c55e;font-weight:700 }
  .dead { color:#ef4444;font-weight:700 }
  .section { margin-top:32px }
  .section h2 { font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee }
  .empty { color:#888;font-style:italic;padding:16px }
  .footer { text-align:center;color:#aaa;font-size:12px;margin-top:32px }
</style>
</head>
<body>
<div class="card">
  <h1>DeadScan <span>代码库健康度报告</span></h1>
  <div class="meta">${root} · ${new Date().toLocaleString()}</div>

  <div class="score">
    <div class="score-num" style="color:${scoreColor(healthScore)}">${healthScore}%</div>
    <div class="score-bar"><div style="width:${healthScore}%;background:${scoreColor(healthScore)}"></div></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-num">${totalFiles}</div><div class="stat-label">总文件</div></div>
    <div class="stat"><div class="stat-num" style="color:#22c55e">${called}</div><div class="stat-label">有调用</div></div>
    <div class="stat"><div class="stat-num" style="color:#f59e0b">${dynamic}</div><div class="stat-label">动态调用</div></div>
    <div class="stat"><div class="stat-num" style="color:#3b82f6">${manual}</div><div class="stat-label">手动工具</div></div>
    <div class="stat"><div class="stat-num" style="color:#ef4444">${dead}</div><div class="stat-label">死代码</div></div>
  </div>

  ${dead > 0 ? `
  <div class="section">
    <h2>死代码 (${dead})</h2>
    <table>
      <thead><tr><th></th><th>文件</th><th>大小</th><th>最后修改</th><th>原因</th></tr></thead>
      <tbody>${deadRows}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <h2>活跃文件 (前 10 个)</h2>
    ${called > 0 ? `
    <table>
      <thead><tr><th></th><th>文件</th><th>被引用</th><th>调用方</th></tr></thead>
      <tbody>${calledRows}</tbody>
    </table>
    ${items.called.length > 10 ? `<div class="empty">... 另有 ${items.called.length - 10} 个活跃文件</div>` : ''}
    ` : '<div class="empty">没有发现活跃文件</div>'}
  </div>

  <div class="footer">Generated by DeadScan · ${new Date().toISOString()}</div>
</div>
</body>
</html>`

  writeFileSync(outputPath, html, 'utf8')
  return outputPath
}

function healthBar(score) {
  const bars = ['🟥', '🟧', '🟨', '🟩', '🟩', '🟩']
  const filled = Math.round(score / 100 * 10)
  return '🟩'.repeat(Math.min(filled, 10)) + '⬜'.repeat(Math.max(0, 10 - filled))
}

function scoreColor(score) {
  if (score >= 90) return '#22c55e'
  if (score >= 70) return '#f59e0b'
  return '#ef4444'
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}