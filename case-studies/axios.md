# 实战案例：扫描 axios

> DeadScan v1.0.0 · 2026-11-10

## 目标

[axios](https://github.com/axios/axios) — 最流行的 HTTP 客户端库之一，57M+ 周下载量，10 年历史。

## 扫描结果

| 指标 | 数值 |
|------|------|
| 文件总数 | 254 |
| 有调用方 | 97 (38%) |
| 孤儿文件 | 157 |
| 动态调用 | 1 |
| 手动工具 | 141 |
| 死代码 | 15 |
| 健康度 | 🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜ 38% |

## 死代码清单（15 个文件）

大部分是构建配置和测试辅助文件——它们不被源码 import，但确实有用途：

- `rollup.config.js` — Rollup 打包配置，由 CLI 调用
- `webpack.config.js` — Webpack 配置
- `gulpfile.js` — Gulp 任务文件
- `eslint.config.js` — ESLint 配置
- `index.d.ts` — 类型声明（25KB），被 package.json 的 types 字段引用
- `docs/blog/posts.data.ts` — VitePress 博客数据加载器
- `docs/scripts/process-sponsors.js` — 赞助商数据处理脚本
- `examples/network_enhanced.js` — 示例代码
- `sandbox/client.js` — 沙箱测试客户端
- `tests/module/cjs/tests/helpers/*.ts` — CJS 类型测试辅助（5 个文件）

## 分析

axios 的 38% 健康度看似低，但仔细看：157 个孤儿中 141 个被归类为"手动工具"——构建脚本、测试辅助、文档生成器。这些文件不被源码 import，但确实被人或 CI 手动使用。

真正值得关注的死代码只有 `sandbox/client.js`（414B），看起来是早期开发遗留的沙箱测试，目前已无引用。

**结论**：axios 的代码库健康状况良好，DeadScan 正确识别了构建工具链文件并单独归类，避免了误报。
