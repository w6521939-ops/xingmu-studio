# 星幕工坊 Agent API

这是 Electron 客户端之外的独立 Python 后端基础层，当前提供：

- 健康检查与百炼配置状态（不返回密钥）
- 项目与 Agent 任务的 SQLite 持久化
- 漫剧生产流程规划与 Function Call 工具定义
- 项目级知识片段写入和检索

## 本地运行

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
.\.venv\Scripts\python.exe -m backend.app
```

默认监听 `http://127.0.0.1:8765`，接口文档位于 `/docs`。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

真实百炼调用必须通过环境变量 `DASHSCOPE_API_KEY` 注入；接口响应、SQLite、日志和项目文件都不得保存密钥。
