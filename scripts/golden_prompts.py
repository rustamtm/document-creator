import argparse
from pathlib import Path
from typing import List

from TTS.api import TTS

DEFAULT_PROMPTS = [
    "Hello world.",
    "The quick brown fox jumps over the lazy dog.",
    "How are you today?",
    "This is a test of the golden prompts evaluator.",
    "The rain in Spain stays mainly in the plain.",
    "She sells seashells by the seashore.",
    "To be or not to be, that is the question.",
    "OpenAI creates powerful language models.",
    "Sphinx of black quartz, judge my vow.",
    "Pack my box with five dozen liquor jugs."
]


def load_prompts(path: Path | None) -> List[str]:
    if path is None:
        return DEFAULT_PROMPTS
    with path.open("r", encoding="utf-8") as f:
        return [l.strip() for l in f if l.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize golden prompts")
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--config-path", required=True)
    parser.add_argument("--run-dir", required=True, help="Run directory (e.g. runs/house_en_xtts)")
    parser.add_argument("--step", type=int, required=True, help="Training step number")
    parser.add_argument("--language", default="en")
    parser.add_argument("--prompts-file", help="Optional file with prompts")
    args = parser.parse_args()

    prompts = load_prompts(Path(args.prompts_file) if args.prompts_file else None)
    out_dir = Path(args.run_dir) / "golden_prompts"
    out_dir.mkdir(parents=True, exist_ok=True)

    tts = TTS(model_path=args.model_path, config_path=args.config_path, progress_bar=False)
    for i, line in enumerate(prompts, 1):
        out_path = out_dir / f"{args.step:06d}_{i:02d}.wav"
        tts.tts_to_file(text=line, language=args.language, file_path=str(out_path))


if __name__ == "__main__":
    main()
