# InkEcho Lightweight MCP

This backend exposes a Streamable HTTP MCP endpoint at:

```text
http://127.0.0.1:8000/mcp
```

The MCP layer is a thin wrapper over the existing Python services. It does not
call the local REST API over HTTP and does not expose OCR or solution-reveal
tools in the lightweight version.

## Tools

- `list_reading_stages`: list stage ids, titles, order, and checkpoint markers.
- `get_reading_stage`: return one stage's visible text, evidence, and checkpoint.
- `analyze_hypothesis_pressure`: run the existing CP2 pressure-test agent.
- `ask_reading_context_question`: run the existing spoiler-safe reading QA agent.

## Local Run

```bash
cd backend
python -m pip install -r requirements-lightweight.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

If `OPENAI_API_KEY` is not configured, `analyze_hypothesis_pressure` and
`ask_reading_context_question` return the same fallback behavior as the REST API.
Do not hard-code API keys; configure them with environment variables.

## Local MCP Smoke Test

```bash
cd backend
python tests/test_mcp_smoke.py
```

The smoke test starts the ASGI app through the MCP Streamable HTTP client,
initializes a session, checks `tools/list`, and calls core tools.

## Docker

```bash
cd backend
docker build -t inkecho-mcp-lightweight .
docker run --rm -p 8000:8000 --env PORT=8000 inkecho-mcp-lightweight
```

Then connect an MCP client or Inspector to:

```text
http://127.0.0.1:8000/mcp
```

## Public Competition URL Checklist

The submitted URL must be a public HTTPS Streamable HTTP MCP URL:

```text
https://your-domain.example/mcp
```

Before submitting, verify:

- `initialize` succeeds.
- `tools/list` returns the four lightweight tools within 15 seconds.
- At least one core tool call returns `ok: true`.
- The URL is not localhost, an internal IP, a temporary tunnel, or a web page.
- The service stays online and tool names and schemas remain stable during judging.
