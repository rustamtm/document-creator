import argparse
import os

import numpy as np
import pyloudnorm as pyln
from pydub import AudioSegment
from TTS.api import TTS


def main():
    parser = argparse.ArgumentParser(description="Run XTTS inference")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--out", required=True, help="Path to output wav file")
    parser.add_argument("--model-path", required=True, help="Path to model checkpoint")
    parser.add_argument("--config-path", required=True, help="Path to model config")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--deesser", action="store_true", help="Apply simple de-esser")
    parser.add_argument("--lufs", type=float, help="Normalize output to target LUFS")
    args = parser.parse_args()

    tts = TTS(model_path=args.model_path, config_path=args.config_path, progress_bar=False)
    tts.tts_to_file(text=args.text, language=args.language, file_path=args.out)

    if args.deesser or args.lufs is not None:
        seg = AudioSegment.from_file(args.out)
        if args.deesser:
            high = seg.high_pass_filter(6000)
            seg = seg.overlay(high, gain_during_overlay=-10)
        if args.lufs is not None:
            samples = np.array(seg.get_array_of_samples()).astype(np.float32)
            if seg.channels > 1:
                samples = samples.reshape((-1, seg.channels)).mean(axis=1)
            meter = pyln.Meter(seg.frame_rate)
            loudness = meter.integrated_loudness(samples / (1 << 15))
            seg = seg.apply_gain(args.lufs - loudness)
        seg.export(args.out, format="wav")


if __name__ == "__main__":
    main()
