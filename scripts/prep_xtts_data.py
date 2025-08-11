"""Prepare dataset for XTTS fine-tuning.

This script normalizes audio loudness, optionally segments long files
using VAD from Whisper, and writes a metadata.csv file in the
format required by Coqui TTS:

    wavs/0001.wav|Some text here.|spk1|en

Usage:
    python scripts/prep_xtts_data.py --input-dir raw_audio \
        --transcript-file transcripts.tsv --output-dir data/house_en

The transcript file should contain lines of the form:
    filename.wav\tThis is the spoken text.
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable, List, Tuple

from pydub import AudioSegment

try:
    import whisper
except ImportError:  # pragma: no cover - optional dependency
    whisper = None


def load_transcripts(path: Path) -> List[Tuple[str, str]]:
    entries = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, text = line.split("\t", 1)
            entries.append((name, text))
    return entries


def normalize(segment: AudioSegment, target_dbfs: float = -20.0) -> AudioSegment:
    change = target_dbfs - segment.dBFS
    return segment.apply_gain(change)


TARGET_SAMPLE_RATE = 22050


def save_audio(segment: AudioSegment, path: Path) -> None:
    segment = (
        segment.set_frame_rate(TARGET_SAMPLE_RATE)
        .set_channels(1)
        .set_sample_width(2)
    )
    segment.export(path, format="wav")


def maybe_split(
    path: Path, max_len: float, model, fallback_text: str
) -> Iterable[Tuple[AudioSegment, str]]:
    segment = AudioSegment.from_file(path)
    if model is None:
        yield segment, fallback_text
        return

    result = model.transcribe(str(path))
    segments = result.get("segments", [])
    if not segments:
        yield segment, result.get("text", fallback_text).strip()
        return
    for s in segments:
        start = int(s["start"] * 1000)
        end = int(s["end"] * 1000)
        if (end - start) / 1000 <= max_len + 0.1:
            yield segment[start:end], s["text"].strip()


def main(args: argparse.Namespace) -> None:
    input_dir = Path(args.input_dir)
    out_dir = Path(args.output_dir)
    wav_dir = out_dir / "wavs"
    wav_dir.mkdir(parents=True, exist_ok=True)

    transcripts = load_transcripts(Path(args.transcript_file))

    model = None
    if args.vad and whisper is not None:
        model = whisper.load_model("base")

    metadata_path = out_dir / "metadata.csv"
    with metadata_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="|")
        index = 1
        for name, text in transcripts:
            audio_path = input_dir / name
            if not audio_path.exists():
                print(f"Warning: missing {audio_path}")
                continue
            for chunk, chunk_text in maybe_split(audio_path, args.max_len, model, text):
                chunk = normalize(chunk)
                out_path = wav_dir / f"{index:04d}.wav"
                save_audio(chunk, out_path)
                writer.writerow([f"wavs/{out_path.name}", chunk_text or text, args.speaker, args.language])
                index += 1
    print(f"Wrote {index-1} clips to {metadata_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare XTTS dataset")
    parser.add_argument("--input-dir", required=True, help="Directory with source audio files")
    parser.add_argument("--transcript-file", required=True, help="TSV file with filename and text")
    parser.add_argument("--output-dir", required=True, help="Output dataset directory")
    parser.add_argument("--speaker", default="spk1", help="Speaker id")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--max-len", type=float, default=15.0, help="Max clip length in seconds")
    parser.add_argument("--vad", action="store_true", help="Use VAD to split long files")
    main(parser.parse_args())
