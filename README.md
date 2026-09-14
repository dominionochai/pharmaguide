# PharmaGuide

**PharmaGuide is an offline-first AI pharmacist co-pilot that turns a patient's medication and herb list into understandable interaction risks and a practical "tell your doctor" sheet.**

It is a decision-support prototype for patients, clinicians, and community health teams—not a replacement for a qualified pharmacist or doctor.

## What it does

- **Drug interaction analysis:** extracts medication names from free text, compares pairs with a trained interaction-severity model, and returns severity, confidence, and plain-language follow-up notes.
- **Herb detection:** identifies named herbs and checks them against the curated herbal cross-reference database. Optional image-based identification is best-effort and can fall back to a manual name.
- **Self-learning loop:** unknown drug terms are surfaced by extraction and can be added to the local knowledge/cache workflow instead of silently disappearing.
- **Offline capability:** the core text extraction, curated herb checks, fingerprint features, and trained model run locally; network-backed chemistry enrichment is optional with deterministic fallbacks.
- **Trained ML model:** `train.py` trains the interaction classifier from the checked-in examples and writes local artifacts under `models/`.
- **Privacy-aware output:** the API is designed for local use and returns a compact risk summary plus a clinician-ready conversation starter.

## Architecture

PharmaGuide uses a **FastAPI + React/Vite** architecture. The Python backend in `api/` exposes analysis and herb-detection endpoints, loads local model/data artifacts, and enables permissive CORS for the development UI. The Vite frontend is a thin client that sends text or image input to the backend and renders risks, confidence, severity, and next steps.

## Quickstart: backend

Python 3.10+ is recommended.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1

pip install -r requirements.txt
cp .env.example .env  # optional; keep real secrets out of Git
python train.py         # or: python train.py --quick
uvicorn api.main:app --reload --port 8000
```

The API is then available at <http://127.0.0.1:8000>. Interactive documentation is at `/docs`. CORS is intentionally permissive (`*`) for local development; restrict `allow_origins` before production deployment.

## Optional environment keys

The offline path does not require secrets. Copy `.env.example` to `.env` only when using optional enrichment:

```dotenv
FEATHERLESS_API_KEY=
HERB_VISION_API_KEY=
```

`FEATHERLESS_API_KEY` can be used by an optional AI identification/enrichment integration. `HERB_VISION_API_KEY` can be used by an optional herb-vision provider. The local model and curated name-based herb lookup remain usable without either key.

## Frontend

From the React/Vite workspace:

```bash
cd frontend
npm install
npm run dev
```

The Vite development server runs on <http://localhost:5173>. Start the backend on port `8000` first so the UI can call the API.

## API example

`POST /analyze` accepts raw text and extracts medicines and herbs in one request:

```bash
curl -X POST http://127.0.0.1:8000/analyze \\
  -H 'Content-Type: application/json' \\
  -d '{"raw_text":"I take warfarin and aspirin with ginger tea."}'
```

A representative response is:

```json
{
  "matched_drugs": ["warfarin", "aspirin"],
  "matched_herbs": ["ginger"],
  "extraction_method": "local",
  "interactions": [
    {
      "drug_a": "warfarin",
      "drug_b": "aspirin",
      "severity": "major",
      "confidence": 0.77,
      "tell_your_doctor": "Tell your doctor about this combination before changing anything."
    }
  ],
  "herb_flags": [],
  "summary": "1 drug interaction(s), 0 herb flag(s) found",
  "unrecognized": [],
  "learned": false,
  "new_learned": []
}
```

Exact confidence and wording depend on the trained artifact and the input. Treat every result as a prompt to consult a qualified professional.

## Training and project structure

Run `python train.py` to reproduce the local interaction model and label artifacts. The quick mode (`python train.py --quick`) is useful for a fast smoke check. The workflow is deterministic for the checked-in examples and does not require downloading a proprietary dataset.

```text
api/              FastAPI application (`api.main:app`)
data/             chemistry helpers, caches, and graph inputs
models/            locally generated model artifacts (ignored by Git)
pharmaguide/      herb knowledge base and interaction helpers
src/              frontend/source modules
tests/             pytest coverage
train.py          interaction-model training entry point
train_herb_classifier.py  optional herb-image training path
requirements.txt  Python dependencies
.env.example      optional local configuration template
```

## Testing and safety

```bash
pytest -q
```

This prototype can miss brand names, regional products, dosage context, or interactions outside its examples. Do not stop or change a medicine based only on this output; verify every alert with a qualified clinician.
