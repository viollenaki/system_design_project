"""
Regenerate .gemini/manifest/skills.json from directories under .gemini/skills/
that contain SKILL.md. Run from repository root:
  python .gemini/scripts/gen_skills_manifest.py
"""
import json
import os
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    skills_root = root / ".gemini" / "skills"
    if not skills_root.is_dir():
        print(f"Missing: {skills_root}", file=sys.stderr)
        return 1
    skills = []
    for d in sorted(skills_root.iterdir()):
        if d.is_dir() and (d / "SKILL.md").is_file():
            rel = d.relative_to(root)
            rel_posix = str(rel).replace(os.sep, "/")
            skills.append(
                {
                    "id": d.name,
                    "path": rel_posix,
                    "entry": "SKILL.md",
                }
            )
    out = {
        "version": 1,
        "skills": skills,
    }
    manifest = root / ".gemini" / "manifest" / "skills.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(
        json.dumps(out, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {manifest} ({len(skills)} skills).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
