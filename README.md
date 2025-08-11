# document-creator

Web interface for converting DOCX and Markdown files. This repository also contains helper scripts for training and running a custom Coqui XTTS voice.

## TTS utilities

- `scripts/prep_xtts_data.py` – prepare and normalize audio data and create metadata CSVs.
- `configs/xtts_house_en.json` – sample configuration for fine-tuning XTTS v2 on an English speaker.
- `scripts/run_xtts.py` – small inference runner used by the `/api/tts` server route.

### `/api/tts` endpoint

The server exposes `POST /api/tts` which expects JSON like `{ "text": "Hello" }` and returns `{ "audio": "media/tts_123.wav" }`. It spawns the Python executable specified by `COQUI_PY` and uses `XTTS_MODEL_PATH` and `XTTS_CONFIG_PATH` to locate the fine-tuned model.
