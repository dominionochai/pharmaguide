"""Train the interaction model offline-first: ``python train.py`` is the whole ML pipeline."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from data.chem import (
    BUILTIN_SMILES,
    canonical_smiles,
    fingerprint_array,
    load_cache,
    save_cache,
)

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "ddinter.csv"
LEARNED_DRUGS_PATH = ROOT / "data" / "learned_drugs.json"
MODELS = ROOT / "models"
LABELS = ["minor", "moderate", "major", "contraindicated"]
CURATED_PAIRS = [
    ("aspirin", "warfarin", "major"),
    ("metformin", "alcohol", "major"),
    ("ibuprofen", "aspirin", "moderate"),
    ("sildenafil", "nitroglycerin", "contraindicated"),
    ("amlodipine", "simvastatin", "moderate"),
    ("digoxin", "furosemide", "major"),
    ("paracetamol", "warfarin", "moderate"),
    ("warfarin", "amiodarone", "major"),
    ("warfarin", "trimethoprim", "major"),
    ("warfarin", "rifampicin", "major"),
    ("aspirin", "clopidogrel", "major"),
    ("metformin", "contrast media", "major"),
    ("metformin", "cimetidine", "moderate"),
    ("simvastatin", "clarithromycin", "major"),
    ("atorvastatin", "clarithromycin", "major"),
    ("simvastatin", "grapefruit", "moderate"),
    ("amlodipine", "lisinopril", "minor"),
    ("digoxin", "amiodarone", "major"),
    ("digoxin", "verapamil", "major"),
    ("furosemide", "lithium", "major"),
    ("furosemide", "ibuprofen", "moderate"),
    ("sildenafil", "doxazosin", "moderate"),
    ("nitroglycerin", "tadalafil", "contraindicated"),
    ("ciprofloxacin", "theophylline", "major"),
    ("fluoxetine", "tramadol", "major"),
    ("sertraline", "linezolid", "contraindicated"),
    ("clarithromycin", "colchicine", "major"),
    ("erythromycin", "warfarin", "major"),
    ("lisinopril", "potassium", "moderate"),
    ("hydrochlorothiazide", "lithium", "major"),
    ("insulin", "beta blockers", "moderate"),
    ("levothyroxine", "calcium", "moderate"),
    ("omeprazole", "clopidogrel", "moderate"),
    ("loratadine", "alcohol", "minor"),
]


def _load_learned_drugs() -> dict[str, str]:
    try:
        value = json.loads(LEARNED_DRUGS_PATH.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(value, dict):
        return {}
    return {
        " ".join(str(raw).strip().lower().split()): " ".join(str(canonical).strip().split())
        for raw, canonical in value.items()
        if isinstance(raw, str)
        and isinstance(canonical, str)
        and raw.strip()
        and canonical.strip()
    }


LEARNED_DRUGS = _load_learned_drugs()
DRUG_NAMES = set(BUILTIN_SMILES) | set(LEARNED_DRUGS.values())
CHEM_CACHE = load_cache()


def _canonical_name(name: str) -> str:
    normalized = " ".join(str(name).strip().lower().split())
    return LEARNED_DRUGS.get(normalized, normalized)


def _frame() -> pd.DataFrame:
    frames = []
    if DATA_PATH.exists():
        try:
            table = pd.read_csv(DATA_PATH).rename(
                columns={"drug1": "drug_a", "drug2": "drug_b", "level": "severity"}
            )
            if {"drug_a", "drug_b", "severity"}.issubset(table.columns):
                frames.append(table[["drug_a", "drug_b", "severity"]])
        except (OSError, ValueError, pd.errors.ParserError):
            pass
    frames.append(pd.DataFrame(CURATED_PAIRS, columns=["drug_a", "drug_b", "severity"]))
    result = pd.concat(frames, ignore_index=True).dropna().drop_duplicates().head(1000)
    for column in ("drug_a", "drug_b", "severity"):
        result[column] = result[column].astype(str).str.strip().str.lower()
    result["drug_a"] = result["drug_a"].map(_canonical_name)
    result["drug_b"] = result["drug_b"].map(_canonical_name)
    return result[result["severity"].isin(LABELS)].reset_index(drop=True)


def _smiles(name: str) -> str:
    """Use built-ins first and the existing PubChem resolver for learned drugs."""
    canonical = _canonical_name(name)
    value = canonical_smiles(canonical, CHEM_CACHE)
    if value:
        return value
    # Keep the original deterministic fallback for an unresolved training row.
    return BUILTIN_SMILES.get(canonical, "C" + "C" * (1 + sum(map(ord, canonical)) % 7))


def _features(table: pd.DataFrame):
    values, targets = [], []
    for row in table.itertuples(index=False):
        left = fingerprint_array(_smiles(row.drug_a))
        right = fingerprint_array(_smiles(row.drug_b))
        values.append(np.bitwise_xor(np.asarray(left, dtype=np.uint8), np.asarray(right, dtype=np.uint8)))
        targets.append(LABELS.index(row.severity))
    return np.asarray(values, dtype=np.uint8), np.asarray(targets, dtype=np.int64)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true", default=True)
    parser.add_argument("--estimators", type=int, default=100)
    args = parser.parse_args(argv)
    MODELS.mkdir(parents=True, exist_ok=True)
    table = _frame()
    X, y = _features(table)
    if len(X) == 0:
        raise SystemExit("No usable interaction pairs were available")
    estimators = min(max(1, args.estimators), 100 if args.quick else 300)
    counts = np.bincount(y, minlength=len(LABELS))
    if len(X) >= 12 and counts.min() >= 2:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    else:
        X_train = X_test = X
        y_train = y_test = y
    model = RandomForestClassifier(
        n_estimators=estimators,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced_subsample",
        max_features="sqrt",
    )
    model.fit(X_train, y_train)
    predicted = model.predict(X_test)
    accuracy = accuracy_score(y_test, predicted)
    f1 = f1_score(y_test, predicted, average="weighted", zero_division=0)
    joblib.dump(model, MODELS / "interaction_model.joblib")
    (MODELS / "severity_labels.json").write_text(
        json.dumps(LABELS, indent=2) + "\n", encoding="utf-8"
    )
    save_cache(CHEM_CACHE)
    print(
        f"accuracy: {accuracy:.3f} | F1: {f1:.3f} | "
        f"pairs: {len(table)} | trees: {estimators} | learned drugs: {len(DRUG_NAMES - set(BUILTIN_SMILES))}"
    )
    print("summary: offline curated pairs and learned canonical drugs included; artifacts written to models/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
