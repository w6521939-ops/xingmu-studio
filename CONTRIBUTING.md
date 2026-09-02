# 贡献指南 | Contributing Guide

感谢你对星幕工坊的兴趣！本文档说明如何参与贡献。

## 快速开始

```bash
git clone https://github.com/w6521939-ops/xingmu-studio.git
cd xingmu-studio
npm install
npm run dev
```

## 开发环境

| 依赖 | 版本要求 |
|------|---------|
| Node.js | >= 18 |
| Python | >= 3.10（后端服务） |
| FFmpeg | >= 6.0 |

## 项目结构

```
src/                          # React 前端
├── services/providers/       # Provider 抽象层（核心引擎）
├── services/pipelineDefs/     # 管线定义（核心引擎）
├── components/                # UI 组件
electron/                     # Electron 主进程
remotion-composer/            # Remotion 渲染引擎（核心引擎）
services/basic_video_server/  # Python 后端
```

## 贡献流程

1. **Fork 仓库** → 创建分支 `feat/your-feature` 或 `fix/your-fix`
2. **编码** → 遵循现有代码风格，添加必要测试
3. **提交** → 使用 Conventional Commits 格式：
   - `feat:` 新功能
   - `fix:` 修复
   - `docs:` 文档
   - `refactor:` 重构
   - `test:` 测试
4. **测试** → 确保 `npm run build` 通过
5. **PR** → 填写 PR 模板，关联 Issue

## 代码规范

- JavaScript：ES2022+，ESM 模块
- TypeScript：Remotion 组件使用 `.tsx`，启用严格模式
- CSS：BEM 命名，CSS 变量统一主题
- Python：Black 格式化，类型注解

## 安全红线

- **禁止**在源码中硬编码任何 API Key
- **禁止**在提交中包含 `.env` 文件
- **禁止**在日志中输出用户的 API Key 或生成内容
- 所有 API Key 通过环境变量注入

## 新增 Provider

1. 在 `src/services/providers/implementations/` 下新建文件
2. 继承 `BaseProvider`，实现 `probe()` / `dryRun()` / `generate()` / `estimateCost()`
3. 在 `index.js` 中注册
4. 在 `costTable.js` 中添加定价
5. 在 `ProviderSettings.jsx` 中自动展示

## 新增管线

1. 在 `src/services/pipelineDefs/` 下新建管线定义文件
2. 定义阶段（stages）、依赖关系（dependsOn）、审批门（humanApproval）
3. 复用现有 Provider 和工具
4. 在 `pipelineDefs/index.js` 中导出

## Issue 指南

- **Bug 报告**：使用 Bug 模板，附复现步骤、环境信息
- **功能建议**：使用 Feature 模板，说明场景和预期效果
- **安全问题**：**不要**提 Issue，请私发邮件

## 许可证

提交的代码默认以 MIT 许可证发布。
