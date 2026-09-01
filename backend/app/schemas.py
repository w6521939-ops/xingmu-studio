from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ProjectCreate(ApiModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)


class ProjectResponse(ApiModel):
    id: str
    name: str
    description: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class AgentPlanRequest(ApiModel):
    goal: str = Field(min_length=1, max_length=2000)
    project_id: str | None = Field(default=None, alias="projectId")


class KnowledgeChunkCreate(ApiModel):
    project_id: str = Field(alias="projectId")
    source: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=20000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class KnowledgeSearchRequest(ApiModel):
    project_id: str = Field(alias="projectId")
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)
