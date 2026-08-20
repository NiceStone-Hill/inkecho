import asyncio
import json
import multiprocessing
import socket
import time
import unittest
from pathlib import Path

import uvicorn

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _run_server(port: int) -> None:
    uvicorn.run(
        "main:app",
        app_dir=str(Path(__file__).resolve().parents[1]),
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )


async def _wait_for_server(url: str) -> None:
    import httpx

    deadline = time.time() + 15

    while time.time() < deadline:
        try:
            async with httpx.AsyncClient(timeout=1) as client:
                response = await client.get(url)
            if response.status_code == 200:
                return
        except httpx.HTTPError:
            pass

        await asyncio.sleep(0.2)

    raise RuntimeError(f"server did not start: {url}")


async def _exercise_mcp(base_url: str) -> dict:
    async with streamable_http_client(f"{base_url}/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            tools = await session.list_tools()
            tool_names = [tool.name for tool in tools.tools]

            stages = await session.call_tool("list_reading_stages", {})
            pressure = await session.call_tool(
                "analyze_hypothesis_pressure",
                {
                    "hypothesis_text": "他可能会利用老鼠发现的通道离开牢房。",
                    "confidence": "medium",
                },
            )

            return {
                "tool_names": tool_names,
                "stages": _tool_payload(stages),
                "pressure": _tool_payload(pressure),
            }


def _tool_payload(result) -> dict:
    if result.structuredContent is not None:
        return result.structuredContent

    text = result.content[0].text
    return json.loads(text)


class MCPTransportSmokeTests(unittest.TestCase):
    def test_streamable_http_initialize_tools_list_and_calls(self):
        port = _find_free_port()
        base_url = f"http://127.0.0.1:{port}"

        process = multiprocessing.Process(
            target=_run_server,
            args=(port,),
            daemon=True,
        )
        process.start()

        try:
            asyncio.run(_wait_for_server(f"{base_url}/api/health"))
            result = asyncio.run(_exercise_mcp(base_url))
        finally:
            process.terminate()
            process.join(timeout=5)

        self.assertIn("list_reading_stages", result["tool_names"])
        self.assertIn("get_reading_stage", result["tool_names"])
        self.assertIn("analyze_hypothesis_pressure", result["tool_names"])
        self.assertIn("ask_reading_context_question", result["tool_names"])
        self.assertTrue(result["stages"]["ok"])
        self.assertTrue(result["pressure"]["ok"])


if __name__ == "__main__":
    unittest.main()
