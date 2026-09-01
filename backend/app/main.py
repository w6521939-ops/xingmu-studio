from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException

from .config import Settings
from .database import Database
from .schemas import AgentPlanRequest, KnowledgeChunkCreate, KnowledgeSearchRequest, ProjectCreate
from .workflow import build_production_plan, get_agent_tools


def create_app(database_path: str | Path | None = None) -> FastAPI:
    settings = Settings.from_environment(database_path)
    database = Database(settings.database_path)
    database.initialize()

    app = FastAPI(title="星幕工坊 Agent API", version="0.1.0")
    app.state.settings = settings
    app.state.database = database

    @app.get("/api/v1/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "service": "xingmu-agent-api",
            "database": "sqlite",
            "provider": settings.provider_status(),
        }

    @app.post("/api/v1/projects", status_code=201)
    def create_project(payload: ProjectCreate) -> dict[str, object]:
        return database.create_project(payload.name.strip(), payload.description.strip())

    @app.get("/api/v1/projects/{project_id}")
    def get_project(project_id: str) -> dict[str, object]:
        project = database.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        return project

    @app.get("/api/v1/agent/tools")
    def agent_tools() -> dict[str, object]:
        return {"tools": get_agent_tools()}

    @app.post("/api/v1/agent/plans", status_code=201)
    def create_agent_plan(payload: AgentPlanRequest) -> dict[str, object]:
        if payload.project_id and not database.get_project(payload.project_id):
            raise HTTPException(status_code=404, detail="项目不存在")
        return database.create_agent_run(
            payload.project_id,
            payload.goal.strip(),
            build_production_plan(payload.goal.strip()),
        )

    @app.get("/api/v1/agent/plans/{run_id}")
    def get_agent_plan(run_id: str) -> dict[str, object]:
        run = database.get_agent_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Agent 任务不存在")
        return run

    @app.post("/api/v1/knowledge/chunks", status_code=201)
    def add_knowledge_chunk(payload: KnowledgeChunkCreate) -> dict[str, object]:
        if not database.get_project(payload.project_id):
            raise HTTPException(status_code=404, detail="项目不存在")
        return database.add_knowledge_chunk(
            payload.project_id,
            payload.source.strip(),
            payload.content.strip(),
            payload.metadata,
        )

    @app.post("/api/v1/knowledge/search")
    def search_knowledge(payload: KnowledgeSearchRequest) -> dict[str, object]:
        if not database.get_project(payload.project_id):
            raise HTTPException(status_code=404, detail="项目不存在")
        results = database.search_knowledge(payload.project_id, payload.query, payload.limit)
        return {"query": payload.query, "count": len(results), "results": results}

    return app


app = create_app()
