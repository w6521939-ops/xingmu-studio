from __future__ import annotations

from copy import deepcopy


AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "structure_script",
            "description": "把故事整理为剧集、场景、角色和镜头结构。",
            "parameters": {
                "type": "object",
                "properties": {"projectId": {"type": "string"}, "goal": {"type": "string"}},
                "required": ["projectId", "goal"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_visual_asset",
            "description": "生成角色卡、道具卡、场景卡或分镜画面。",
            "parameters": {
                "type": "object",
                "properties": {
                    "projectId": {"type": "string"},
                    "assetType": {"type": "string", "enum": ["character", "prop", "scene", "shot"]},
                    "assetId": {"type": "string"},
                },
                "required": ["projectId", "assetType", "assetId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "synthesize_voice",
            "description": "按角色音色生成单句配音。",
            "parameters": {
                "type": "object",
                "properties": {"projectId": {"type": "string"}, "lineId": {"type": "string"}},
                "required": ["projectId", "lineId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_shot_video",
            "description": "使用已确认的首帧或首尾帧生成单镜头视频。",
            "parameters": {
                "type": "object",
                "properties": {"projectId": {"type": "string"}, "shotId": {"type": "string"}},
                "required": ["projectId", "shotId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assemble_episode",
            "description": "用本地 FFmpeg 合成视频、配音、字幕和音轨。",
            "parameters": {
                "type": "object",
                "properties": {"projectId": {"type": "string"}, "episodeId": {"type": "string"}},
                "required": ["projectId", "episodeId"],
            },
        },
    },
]


def build_production_plan(goal: str) -> list[dict[str, object]]:
    stages = [
        ("script", "structure_script", "解析剧本并确认角色、道具、场景与分镜"),
        ("visuals", "generate_visual_asset", "按固定参考顺序准备视觉资产"),
        ("voice", "synthesize_voice", "生成并校验台词配音"),
        ("video", "generate_shot_video", "按镜头顺序生成并托管视频"),
        ("assembly", "assemble_episode", "本地合成分集成片"),
    ]
    return [
        {
            "order": index,
            "stage": stage,
            "tool": tool,
            "summary": summary,
            "status": "pending",
            "requiresConfirmation": stage in {"visuals", "voice", "video"},
            "goal": goal,
        }
        for index, (stage, tool, summary) in enumerate(stages, start=1)
    ]


def get_agent_tools() -> list[dict[str, object]]:
    return deepcopy(AGENT_TOOLS)
