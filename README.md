# DeadScan · 一个命令找出项目里不再有人用的代码

> **npm i -g @hayabusa-yl/deadscan && deadscan** — 两分钟，给代码库做一次全身 CT。

支持 JS/TS/Python/Shell/Ruby/Go/Rust/VBS。

---

## 缘起

大肥鱼的项目目录里攒了 675 个脚本，日积月累，谁也说不清哪些还在用、哪些早已失效。手动翻了一遍，揪出 13 个孤儿文件删掉——但删完之后心里没底：删掉的会不会是别的脚本通过动态路径引用的？桥接脚本断了会不会影响上下游？

市面上不缺 lint 工具，缺的是一个**不做类型检查、不做风格纠错、只回答一个问题**的工具——"这个文件还有人用吗？"

DeadScan 就是这么来的。不依赖 webpack，不依赖 TypeScript compiler，一个命令，直接给答案。

---

## 快速开始

```bash
npm i -g @hayabusa-yl/deadscan
deadscan                    # 扫描当前目录，终端输出报告
deadscan --report           # 生成 HTML 可视化报告
```

不用配置文件，不用标注，跑起来就有结果。12 种语言混着放也没问题。

---

## 用法

```bash
deadscan                          # 当前目录
deadscan --dir ~/my-project       # 指定目录
deadscan --json                   # JSON 输出（给 CI/脚本用）
deadscan --report                 # 生成 HTML 健康报告
deadscan --report --output health.html
```

---

## 输出长这样

```
═══════════════════════════════════════
  DeadScan · 代码库健康度报告
═══════════════════════════════════════

  目录: /Users/me/my-project
  文件总数: 156
  有调用方: 142 (91%)
  孤儿: 14
    ├ 动态调用: 5
    ├ 手动工具: 7
    └ 死代码:  2

  健康度: 🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜ 91%

  ══ 死代码 ══
  ✗ scripts/old-migrate.mjs  (2.3 KB)
  ✗ utils/legacy-parser.py   (1.1 KB)

═══════════════════════════════════════
```

---

## 它怎么判断

1. **语法解析** — 解析 import/require/调用语句，构建依赖图
2. **字符串回退** — 动态拼接的引用（模板字符串、spawn 参数）用文件名模糊匹配补一刀
3. **分三类**：
   - **动态调用** — 匹配动态模式（`_` 开头、`patch-` 前缀、`lib/` 目录）→ 不算死代码
   - **手动工具** — 文件名含 manual/probe/bench/inspect/debug 等关键词 → 人手动跑的工具
   - **死代码** — 以上都不是，没有引用 → 该处理了

---

## 配置文件（可选）

项目根目录放 `.deadscanrc.json`：

```json
{
  "skipDirs": ["vendor", "generated"],
  "skipPrefixes": [".", "_", "legacy-"],
  "extensions": [".mjs", ".js", ".ts", ".py"],
  "maxDepth": 30,
  "dynamicPatterns": ["^_", "^patch-.*\\.mjs$"],
  "manualKeywords": ["manual", "probe", "bench"]
}
```

---

## HTML 报告

`--report` 生成独立 HTML 文件，含健康度环形评分、死代码清单（路径/大小/最后修改时间）、活跃文件调用关系、五维统计。

---

## 许可

MIT