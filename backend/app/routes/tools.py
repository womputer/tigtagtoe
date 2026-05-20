"""Routes for the tool catalog and mock tool execution."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.agent.mocks import execute_mock
from app.agent.tools import TOOLS, TOOL_NAMES
from app.schemas import ToolExecuteRequest, ToolExecuteResponse

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("")
def list_tools() -> dict:
    """Return the tool catalog so the UI can render labels and help text."""
    catalog = []
    for tool in TOOLS:
        catalog.append(
            {
                "name": tool["name"],
                "description": tool["description"],
                "required_arguments": [
                    k for k in tool["input_schema"].get("required", []) if k != "rationale"
                ],
            }
        )
    return {"tools": catalog}


@router.post("/{tool_name}/execute", response_model=ToolExecuteResponse)
def execute_tool(tool_name: str, payload: ToolExecuteRequest) -> ToolExecuteResponse:
    if tool_name not in TOOL_NAMES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown tool: {tool_name}",
        )
    result = execute_mock(tool_name, payload.arguments)
    return ToolExecuteResponse(
        tool=tool_name,
        arguments=payload.arguments,
        result=result,
    )
