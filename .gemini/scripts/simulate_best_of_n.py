import sys


def simulate_best_of_n(prompt: str, n: int = 3) -> None:
    print(f"Prompt: {prompt}")
    print(f"Generating {n} samples (demo)...\n")

    samples = [
        f"Output A: Detailed, structured response for: {prompt!r}",
        f"Output B: Concise, direct response for: {prompt!r}",
        f"Output C: More exploratory take on: {prompt!r}",
    ][:n]

    for i, sample in enumerate(samples, start=1):
        print(f"--- Sample {i} ---")
        print(sample)
        print()

    print("--- Evaluation (demo) ---")
    print("A human or judge would score accuracy, tone, and constraints.")
    print("Winner: Sample 1 — most complete for this (fake) run.")


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else "Write a Python function to group a list by key."
    simulate_best_of_n(p)
