import re
import sys

# Golden messages: two match Conventional Commits; one is intentionally non-compliant (docs case).
# Eval passes when the subject line matches the required pattern for that change type.
TEST_CASES = [
    {
        "name": "Feature Change",
        "expected_pattern": r"^feat\(ui\): .+",
        "candidate": "feat(ui): add NewButton component",
    },
    {
        "name": "Bug Fix",
        "expected_pattern": r"^fix\(auth\): .+",
        "candidate": "fix(auth): use secure password comparison",
    },
    {
        "name": "Documentation Update",
        "expected_pattern": r"^docs: .+",
        "candidate": "update readme",
    },
]


def run_evals() -> int:
    results = []
    for tc in TEST_CASES:
        pattern = tc["expected_pattern"]
        msg = tc["candidate"]
        if re.match(pattern, msg):
            results.append(
                {
                    "name": tc["name"],
                    "status": "PASS",
                    "output": msg,
                }
            )
        else:
            reason = f"Subject does not match {pattern!r} (got {msg!r})"
            results.append(
                {
                    "name": tc["name"],
                    "status": "FAIL",
                    "output": msg,
                    "reason": reason,
                }
            )

    print("Running 3 evals for commit-message skill (regex vs. golden messages)...")
    for res in results:
        print(f"[{res['status']}] {res['name']}: {res.get('output', '')}")
        if res["status"] == "FAIL":
            print(f"    Reason: {res['reason']}")

    passed = sum(1 for r in results if r["status"] == "PASS")
    print(f"\nFinal Result: {passed}/3 passed")
    return 0 if passed >= 2 else 1


if __name__ == "__main__":
    sys.exit(run_evals())
