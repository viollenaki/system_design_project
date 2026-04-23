import sys
from pathlib import Path

# Allow `import hook_io` when this file is run as a script
_LIB = Path(__file__).resolve().parent.parent / "lib"
if str(_LIB) not in sys.path:
    sys.path.insert(0, str(_LIB))
import hook_io  # noqa: E402


def main() -> None:
    try:
        data = hook_io.read_stdin_json()
        tool_input = str(data.get("tool_input", ""))
        if ".env" in tool_input:
            hook_io.deny(reason="Security Policy: Access to .env files is blocked.")
        else:
            hook_io.allow()
    except Exception as e:
        hook_io.log_error(f"Error in before-tool-block-env: {e}")
        hook_io.allow()


if __name__ == "__main__":
    main()
