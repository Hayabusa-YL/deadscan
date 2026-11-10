// 依赖分析器：解析脚本引用关系，构建依赖图
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve, extname } from 'node:path'

// 解析各类脚本中的引用模式
const PARSERS = {
  '.mjs': parseJSModule,
  '.js': parseJSModule,
  '.ts': parseJSModule,
  '.py': parsePython,
  '.ps1': parsePowerShell,
  '.bat': parseBatch,
  '.cmd': parseBatch,
  '.sh': parseShell,
  '.rb': parseRuby,
  '.go': parseGo,
  '.rs': parseRust,
  '.vbs': parseVBScript,
}

function parseJSModule(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  // import ... from './foo.mjs'
  const importRe = /(?:import|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g
  let m
  while ((m = importRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  // dynamic import('./foo.mjs')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dynRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  // child_process.spawn/fork('node', ['tools/foo.mjs'])
  const spawnRe = /['"]([^'"]+\.(?:mjs|js|ps1|py|bat|cmd|sh))['"](?:\s*[,)])/g
  while ((m = spawnRe.exec(content)) !== null) {
    const ref = resolveRef(m[1], dir)
    if (ref !== filePath) refs.push(ref)
  }

  // $/path/to/script
  const shellRe = /`([^`]+\.(?:mjs|js|ps1|py|bat|cmd|sh))`/g
  while ((m = shellRe.exec(content)) !== null) {
    const ref = resolveRef(m[1], dir)
    if (ref !== filePath) refs.push(ref)
  }

  return [...new Set(refs)]
}

function parsePython(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  // import foo / from foo import bar
  const importRe = /(?:import|from)\s+['"]?([^'"\s]+)['"]?/g
  let m
  while ((m = importRe.exec(content)) !== null) {
    const mod = m[1].replace(/\./g, '/') + '.py'
    refs.push(resolveRef(mod, dir))
  }

  // subprocess.run(['python', 'script.py'])
  const subRe = /['"]([^'"]+\.py)['"]/g
  while ((m = subRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  return [...new Set(refs)]
}

function parsePowerShell(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  // .\script.ps1 / & "path\to\script.ps1"
  const callRe = /(?:\.\s*\\|&\s*['"]?)([^'"\s;|&]+\.(?:ps1|psm1|bat|cmd|mjs|js|py|vbs))/gi
  let m
  while ((m = callRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  // -File "path/to/script.ps1"
  const fileRe = /-File\s+['"]([^'"]+)['"]/gi
  while ((m = fileRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  return [...new Set(refs)]
}

function parseBatch(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  // call script.bat / node script.js
  const callRe = /(?:call\s+|node\s+|python\s+|pwsh\s+.*-File\s+)?['"]?([^'"\s]+\.(?:bat|cmd|mjs|js|py|ps1|vbs))['"]?/gi
  let m
  while ((m = callRe.exec(content)) !== null) {
    const ref = resolveRef(m[1], dir)
    if (ref !== filePath) refs.push(ref)
  }

  return [...new Set(refs)]
}

function parseShell(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  const callRe = /(?:\.\/|node\s+|python\s+|bash\s+)?['"]?([^'"\s]+\.(?:sh|mjs|js|py|rb))/g
  let m
  while ((m = callRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  return [...new Set(refs)]
}

function parseRuby(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  const requireRe = /require\s+['"]([^'"]+)['"]/g
  let m
  while ((m = requireRe.exec(content)) !== null) {
    let ref = m[1]
    if (!ref.endsWith('.rb')) ref += '.rb'
    refs.push(resolveRef(ref, dir))
  }

  return [...new Set(refs)]
}

function parseGo(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  // import "package/path"
  const importRe = /import\s+(?:[_a-zA-Z]+\s+)?['"]([^'"]+)['"]/g
  let m
  while ((m = importRe.exec(content)) !== null) {
    // Go imports are module-level, not file-level - skip for file-dep analysis
    // But nested relative imports matter
    if (m[1].startsWith('.')) {
      const ref = m[1].endsWith('.go') ? m[1] : m[1] + '.go'
      refs.push(resolveRef(ref, dir))
    }
  }
  return refs
}

function parseRust(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  const modRe = /(?:mod|use)\s+([a-zA-Z_][a-zA-Z0-9_:]*)/g
  let m
  while ((m = modRe.exec(content)) !== null) {
    const ref = m[1].replace(/::/g, '/') + '.rs'
    refs.push(resolveRef(ref, dir))
  }

  return [...new Set(refs)]
}

function parseVBScript(content, filePath) {
  const refs = []
  const dir = dirname(filePath)

  const runRe = /['"]([^'"]+\.(?:vbs|bat|cmd|ps1|mjs|js|py))['"]/gi
  let m
  while ((m = runRe.exec(content)) !== null) {
    refs.push(resolveRef(m[1], dir))
  }

  return [...new Set(refs)]
}

function resolveRef(ref, dir) {
  if (ref.startsWith('.')) return resolve(dir, ref).replace(/\\/g, '/')
  return ref
}

export function analyze(files, rootDir) {
  const root = rootDir.replace(/\\/g, '/')
  const fileMap = new Map()
  const refMap = new Map()    // file -> [refs]
  const calledBy = new Map()  // file -> [callers]

  for (const f of files) {
    const rel = f.path.replace(/\\/g, '/')
    fileMap.set(rel, f)
    refMap.set(rel, [])
    calledBy.set(rel, [])
  }

  for (const f of files) {
    const ext = extname(f.path).toLowerCase()
    const parser = PARSERS[ext] || PARSERS['.js']
    let content
    try { content = readFileSync(f.path, 'utf8') } catch { continue }

    const refs = parser(content, f.path)
    const resolved = []

    for (const ref of refs) {
      // 尝试匹配已知文件
      let found = null
      const refAbs = ref.startsWith('/') ? ref : null

      for (const [path] of fileMap) {
        if (path === ref) { found = path; break }
        if (path.endsWith('/' + ref)) { found = path; break }
        if (path.endsWith(ref)) { found = path; break }
        if (refAbs && path === refAbs) { found = path; break }
        // 无扩展名匹配
        if (!ref.includes('.') && path.includes('/' + ref + '.')) { found = path; break }
      }

      if (found) {
        resolved.push(found)
        const callers = calledBy.get(found) || []
        if (!callers.includes(f.path)) callers.push(f.path)
        calledBy.set(found, callers)
      }
    }

    refMap.set(f.path.replace(/\\/g, '/'), [...new Set(resolved)])
  }

  // 补一刀：字符串匹配（兼容旧 tools-audit 的模糊命中逻辑）
  const sources = []
  for (const f of files) {
    try { sources.push({ path: f.path.replace(/\\/g, '/'), text: readFileSync(f.path, 'utf8') }) } catch {}
  }

  for (const f of files) {
    const fRel = f.path.replace(/\\/g, '/')
    const fName = basename(f.path)
    const existingCallers = calledBy.get(fRel) || []

    for (const s of sources) {
      if (s.path === fRel) continue
      if (s.text.includes(fName) || s.text.includes(f.relative)) {
        if (!existingCallers.includes(s.path)) {
          existingCallers.push(s.path)
        }
      }
    }
    calledBy.set(fRel, existingCallers)
  }

  return {
    fileMap,
    refMap,
    calledBy,
    totalFiles: files.length,
  }
}