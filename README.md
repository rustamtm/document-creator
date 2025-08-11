# document-creator

Web interface for converting DOCX and Markdown files. This repository also contains helper scripts for training and running a custom Coqui XTTS voice.

## TTS utilities

- `scripts/prep_xtts_data.py` – prepare and normalize audio data and create metadata CSVs.
- `configs/xtts_house_en.json` – sample configuration for fine-tuning XTTS v2 on an English speaker.
- `scripts/run_xtts.py` – small inference runner used by the `/api/tts` server route.
- `scripts/split_metadata.py` – split a `metadata.csv` file into train/val/test subsets.
- `scripts/golden_prompts.py` – synthesize a fixed set of prompts to monitor training progress.

### `/api/tts` endpoint

The server exposes `POST /api/tts` which expects JSON like `{ "text": "Hello" }` and returns `{ "audio": "media/tts_123.wav" }`. It spawns the Python executable specified by `COQUI_PY` and uses `XTTS_MODEL_PATH` and `XTTS_CONFIG_PATH` to locate the fine-tuned model.
If `TTS_DEESSER=1` is set, a simple de-esser is applied. Set `TTS_LUFS=-16` (or another value) to normalize loudness.

### Environment setup

To recreate the training environment:

```bash
pip install -r requirements-train.txt
```

For inference:

```bash
pip install -r requirements-infer.txt
```

These files were generated with `pip freeze` and lock down exact package versions.
