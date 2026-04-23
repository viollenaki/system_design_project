import shutil
import subprocess
import sys
from pathlib import Path

_LIB = Path(__file__).resolve().parent.parent / "lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))
import hook_io  # noqa: E402

FORMATTED_SUFFIXES = (
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".yml",
    ".yaml",
)


def main() -> None:
    try:
        input_data = hook_io.read_stdin_json()
        tool_name = input_data.get("tool_name")
        tool_input = input_data.get("tool_input") or {}
        if not isinstance(tool_input, dict):
            tool_input = {}
        if tool_name not in ("write_file", "replace"):
            hook_io.allow()
            return
        file_path = tool_input.get("file_path") or tool_input.get("path")
        if not file_path:
            hook_io.allow()
            return
        raw = Path(file_path)
        path = (raw if raw.is_absolute() else Path.cwd() / raw).resolve()
        if not str(path).lower().endswith(FORMATTED_SUFFIXES):
            hook_io.allow()
            return
        if not path.is_file():
            hook_io.log_error(f"prettier hook: no file, skip: {file_path}")
            hook_io.allow()
            return
        npx = shutil.which("npx")
        if not npx:
            hook_io.log_error("prettier hook: npx not in PATH, skip")
            hook_io.allow()
            return
        proc = subprocess.run(
            [npx, "prettier", "--write", str(path)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if proc.returncode != 0:
            hook_io.log_error(
                f"prettier: exit {proc.returncode} stderr={proc.stderr!r}"
            )
        hook_io.allow(
            additional_context="Formatted with Prettier after write/replace."
        )
    except FileNotFoundError as e:
        hook_io.log_error(f"prettier hook: npx/prettier not found: {e}")
        hook_io.allow()
    except Exception as e:
        hook_io.log_error(f"Error in after-tool-prettier: {e}")
        hook_io.allow()


if __name__ == "__main__":
    main()
