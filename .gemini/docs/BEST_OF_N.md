# Best-of-N comparison (Gemini CLI + Cursor)

Best-of-N means generating **N** answers to the same prompt, then choosing the best (you or a judge model). In Cursor, use **`/best-of-n`** in Chat or Composer to compare model outputs in parallel, then pick the winner.

## Steps in Cursor

1. Open **Chat** or **Composer**.
2. Run **`/best-of-n`** (available when your client supports it).
3. Select the models you want to compare.
4. Read outputs side by side and keep the one that is most accurate, safe, and on-spec.

## Local simulation

[simulate_best_of_n.py](../scripts/simulate_best_of_n.py) prints a small demo of N samples and a notional “winner” for scripting or docs.

From the **repository root**:

```bash
python .gemini/scripts/simulate_best_of_n.py "your prompt"
```

## Regenerating the skills manifest

If you add or remove skill folders, refresh the registry:

```bash
python .gemini/scripts/gen_skills_manifest.py
```
