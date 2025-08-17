import wave
from pathlib import Path
import sys
import pytest

pydub = pytest.importorskip('pydub')
AudioSegment = pydub.AudioSegment

sys.path.append(str(Path(__file__).resolve().parents[1]))
from scripts.prep_xtts_data import save_audio


def test_save_audio_respects_sample_rate(tmp_path):
    seg = AudioSegment.silent(duration=1000, frame_rate=48000)
    out = tmp_path / 'clip.wav'
    save_audio(seg, out, sample_rate=16000)
    with wave.open(str(out), 'rb') as f:
        assert f.getframerate() == 16000
        assert f.getnchannels() == 1
