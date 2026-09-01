from fastapi.testclient import TestClient

from backend.app import create_app


def make_client(tmp_path):
    return TestClient(create_app(tmp_path / "test.db"))


def create_project(client):
    response = client.post(
        "/api/v1/projects",
        json={"name": "灯塔回响", "description": "悬疑漫剧测试项目"},
    )
    assert response.status_code == 201
    return response.json()


def test_health_reports_database_models_and_safe_key_state(tmp_path, monkeypatch):
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    response = make_client(tmp_path).get("/api/v1/health")
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["database"] == "sqlite"
    assert body["provider"]["configured"] is False
    assert body["provider"]["models"]["video"] == "wan2.7-i2v-2026-04-25"
    assert "apiKey" not in body["provider"]


def test_project_is_persisted_and_can_be_loaded(tmp_path):
    client = make_client(tmp_path)
    project = create_project(client)

    loaded = client.get(f"/api/v1/projects/{project['id']}")

    assert loaded.status_code == 200
    assert loaded.json()["name"] == "灯塔回响"


def test_agent_plan_uses_ordered_function_call_tools_and_is_persisted(tmp_path):
    client = make_client(tmp_path)
    project = create_project(client)
    response = client.post(
        "/api/v1/agent/plans",
        json={"projectId": project["id"], "goal": "完成第一集漫剧"},
    )
    body = response.json()

    assert response.status_code == 201
    assert body["status"] == "planned"
    assert [step["tool"] for step in body["plan"]] == [
        "structure_script",
        "generate_visual_asset",
        "synthesize_voice",
        "generate_shot_video",
        "assemble_episode",
    ]
    assert body["plan"][1]["requiresConfirmation"] is True

    loaded = client.get(f"/api/v1/agent/plans/{body['id']}")
    assert loaded.status_code == 200
    assert loaded.json()["plan"] == body["plan"]

    tools = client.get("/api/v1/agent/tools").json()["tools"]
    assert len(tools) == 5
    assert all(tool["type"] == "function" for tool in tools)


def test_agent_plan_rejects_unknown_project(tmp_path):
    response = make_client(tmp_path).post(
        "/api/v1/agent/plans",
        json={"projectId": "missing", "goal": "生成漫剧"},
    )
    assert response.status_code == 404


def test_project_scoped_knowledge_can_be_added_and_searched(tmp_path):
    client = make_client(tmp_path)
    project = create_project(client)
    created = client.post(
        "/api/v1/knowledge/chunks",
        json={
            "projectId": project["id"],
            "source": "角色卡/林晚",
            "content": "林晚总是穿深色防水工装，右手携带强光手电。",
            "metadata": {"kind": "character"},
        },
    )
    assert created.status_code == 201

    found = client.post(
        "/api/v1/knowledge/search",
        json={"projectId": project["id"], "query": "强光手电", "limit": 5},
    )
    missing = client.post(
        "/api/v1/knowledge/search",
        json={"projectId": project["id"], "query": "红色雨伞", "limit": 5},
    )

    assert found.status_code == 200
    assert found.json()["count"] == 1
    assert found.json()["results"][0]["metadata"]["kind"] == "character"
    assert missing.json()["count"] == 0
