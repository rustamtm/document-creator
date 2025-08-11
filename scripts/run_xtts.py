import argparse
import os

from TTS.api import TTS


def main():
    parser = argparse.ArgumentParser(description="Run XTTS inference")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--out", required=True, help="Path to output wav file")
    parser.add_argument("--model-path", required=True, help="Path to model checkpoint")
    parser.add_argument("--config-path", required=True, help="Path to model config")
    parser.add_argument("--language", default="en", help="Language code")
    args = parser.parse_args()

    tts = TTS(model_path=args.model_path, config_path=args.config_path, progress_bar=False)
    tts.tts_to_file(text=args.text, language=args.language, file_path=args.out)


if __name__ == "__main__":
    main()
