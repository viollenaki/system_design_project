"""Shared JSON stdin/stdout helpers for Gemini (and compatible) CLI hooks.

Run with repository root as cwd so paths in settings.json match.
"""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional, TextIO


def read_stdin_json() -> Dict[str, Any]:
    return json.load(sys.stdin)


def write_hook_result(data: Dict[str, Any], stream: TextIO = sys.stdout) -> None:
    print(json.dumps(data), file=stream, flush=True)


def allow(*, additional_context: Optional[str] = None) -> None:
    out: Dict[str, Any] = {"decision": "allow"}
    if additional_context is not None:
        out["additionalContext"] = additional_context
    write_hook_result(out)


def deny(*, reason: str) -> None:
    write_hook_result({"decision": "deny", "reason": reason})


def log_error(message: str) -> None:
    print(message, file=sys.stderr, flush=True)
