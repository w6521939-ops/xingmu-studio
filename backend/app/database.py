from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS agent_runs (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    goal TEXT NOT NULL,
                    status TEXT NOT NULL,
                    plan_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS knowledge_chunks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_agent_runs_project ON agent_runs(project_id);
                CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_chunks(project_id);
                """
            )

    def create_project(self, name: str, description: str) -> dict[str, str]:
        project_id = str(uuid4())
        timestamp = utc_now()
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO projects(id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (project_id, name, description, timestamp, timestamp),
            )
        return self.get_project(project_id)

    def get_project(self, project_id: str) -> dict[str, str] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        return dict(row) if row else None

    def create_agent_run(self, project_id: str | None, goal: str, plan: list[dict[str, object]]) -> dict[str, object]:
        run_id = str(uuid4())
        timestamp = utc_now()
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO agent_runs(id, project_id, goal, status, plan_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (run_id, project_id, goal, "planned", json.dumps(plan, ensure_ascii=False), timestamp),
            )
        return self.get_agent_run(run_id)

    def get_agent_run(self, run_id: str) -> dict[str, object] | None:
        with self.connect() as connection:
            row = connection.execute("SELECT * FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
        if not row:
            return None
        result = dict(row)
        result["plan"] = json.loads(result.pop("plan_json"))
        return result

    def add_knowledge_chunk(
        self,
        project_id: str,
        source: str,
        content: str,
        metadata: dict[str, object],
    ) -> dict[str, object]:
        chunk_id = str(uuid4())
        timestamp = utc_now()
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO knowledge_chunks(id, project_id, source, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (chunk_id, project_id, source, content, json.dumps(metadata, ensure_ascii=False), timestamp),
            )
        return {
            "id": chunk_id,
            "projectId": project_id,
            "source": source,
            "content": content,
            "metadata": metadata,
            "createdAt": timestamp,
        }

    def search_knowledge(self, project_id: str, query: str, limit: int) -> list[dict[str, object]]:
        pattern = f"%{query.strip()}%"
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM knowledge_chunks
                WHERE project_id = ? AND (content LIKE ? OR source LIKE ?)
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (project_id, pattern, pattern, limit),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "projectId": row["project_id"],
                "source": row["source"],
                "content": row["content"],
                "metadata": json.loads(row["metadata_json"]),
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
