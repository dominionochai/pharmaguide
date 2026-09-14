"""
Free-text extraction of medication and herb names for the /analyze endpoint.

Regex matching is deliberately attempted first. If it is incomplete and a
FEATHERLESS_API_KEY is configured, the original text is sent to Featherless
for a second pass; failures leave the deterministic regex result intact.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import requests

from data.chem import BUILTIN_SMILES, ALIASES as DRUG_ALIASES
from pharmaguide.herbs_db import HERBS_DB, ALIASES as HERB_ALIASES

FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions"
FEATHERLESS_MODEL = os.getenv("FEATHERLESS_TEXT_MODEL", "Qwen/Qwen2.5-7B-Instruct")
LEARNED_DRUGS_PATH = Path(__file__).resolve().parents[1] / "data" / "learned_drugs.json"
MAX_LEARNED_DRUGS = 128

KNOWN_DRUGS = sorted(set(BUILTIN_SMILES.keys()) | set(DRUG_ALIASES.keys()))
KNOWN_HERBS = sorted(set(HERBS_DB.keys()) | set(HERB_ALIASES.keys()))

# Ordinary prose words should not be reported as unidentified medicines.
_STOP_WORDS = {
    "a", "about", "after", "also", "am", "and", "any", "are", "as", "at",
    "be", "been", "before", "but", "can", "could", "day", "days", "do",
    "does", "for", "from", "get", "got", "have", "has", "had", "he", "her",
    "here", "his", "how", "i", "if", "in", "into", "is", "it", "like",
    "me", "mg", "my", "need", "no", "not", "of", "on", "or", "our", "please",
    "take", "takes", "taking", "that", "the", "their", "them", "there", "this",
    "to", "use", "was", "we", "what", "when", "with", "you", "your",
    "medicine", "medicines", "medication", "medications", "drug", "drugs",
}


def _load_learned_drugs() -> dict[str, str]:
    """Load learned raw-name -> canonical mappings without ever breaking extraction."""
    try:
        value = json.loads(LEARNED_DRUGS_PATH.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(value, dict):
        return {}
    learned: dict[str, str] = {}
    for raw_name, canonical in value.items():
        if not isinstance(raw_name, str) or not isinstance(canonical, str):
            continue
        raw_key = " ".join(raw_name.strip().lower().split())
        canonical_name = " ".join(canonical.strip().split())
        if raw_key and canonical_name:
            learned[raw_key] = canonical_name
    return learned


def _save_learned_drugs(learned: dict[str, str]) -> None:
    """Persist a normalized, bounded mapping; persistence failures are non-fatal."""
    normalized: dict[str, str] = {}
    for raw_name, canonical in learned.items():
        raw_key = " ".join(str(raw_name).strip().lower().split())
        canonical_name = " ".join(str(canonical).strip().split())
        if raw_key and canonical_name:
            normalized[raw_key] = canonical_name
    bounded = dict(sorted(normalized.items())[:MAX_LEARNED_DRUGS])
    try:
        LEARNED_DRUGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        LEARNED_DRUGS_PATH.write_text(
            json.dumps(bounded, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    except OSError:
        pass


def _canonical_medication(value: str, learned: dict[str, str] | None = None) -> str | None:
    """Resolve a model response or alias to a known or learned canonical medication."""
    candidate = value.strip().lower()
    if not candidate:
        return None
    for canonical in BUILTIN_SMILES:
        if candidate == canonical.lower():
            return canonical
    for alias, canonical in DRUG_ALIASES.items():
        if candidate == alias.lower():
            return canonical
    for raw_name, canonical in (learned or {}).items():
        if candidate == raw_name.lower():
            return canonical
    return None


def _unrecognized_tokens(raw_text: str, learned: dict[str, str] | None = None) -> list[str]:
    """Return plausible name-like tokens left after masking known names and aliases."""
    remaining = raw_text.lower()
    known_terms = list(set(KNOWN_DRUGS) | set(KNOWN_HERBS))
    if learned:
        known_terms.extend(learned.keys())
        known_terms.extend(learned.values())
    for term in sorted(set(known_terms), key=len, reverse=True):
        remaining = re.sub(rf"\b{re.escape(term.lower())}\b", " ", remaining)
    tokens = re.findall(r"\b[A-Za-z][A-Za-z0-9'/-]*\b", remaining)
    return sorted({token for token in tokens if len(token) > 2 and token not in _STOP_WORDS})


def _regex_extract(raw_text: str, learned: dict[str, str] | None = None) -> dict[str, Any]:
    """Deterministic fallback: word-boundary match known names and aliases."""
    learned = _load_learned_drugs() if learned is None else learned
    text = raw_text.lower()
    drugs, herbs = set(), set()

    aliases = dict(DRUG_ALIASES)
    aliases.update(learned)
    for alias, canonical in sorted(aliases.items(), key=lambda kv: -len(kv[0])):
        if re.search(rf"\b{re.escape(alias.lower())}\b", text):
            drugs.add(canonical)
    for name in set(BUILTIN_SMILES) | set(learned.values()):
        if re.search(rf"\b{re.escape(name.lower())}\b", text):
            drugs.add(name)

    for alias, canonical in sorted(HERB_ALIASES.items(), key=lambda kv: -len(kv[0])):
        if re.search(rf"\b{re.escape(alias.lower())}\b", text):
            herbs.add(canonical)
    for name in HERBS_DB:
        if name != "unknown herb" and re.search(rf"\b{re.escape(name.lower())}\b", text):
            herbs.add(name)

    return {
        "medications": sorted(drugs),
        "herbs": sorted(herbs),
        "method": "regex",
        "unrecognized": _unrecognized_tokens(raw_text, learned),
        "learned": False,
        "new_learned": [],
    }


def _llm_extract(raw_text: str, learned: dict[str, str] | None = None) -> dict[str, Any] | None:
    """Ask Featherless for medication names and optional raw-name mappings."""
    learned = _load_learned_drugs() if learned is None else learned
    api_key = os.getenv("FEATHERLESS_API_KEY")
    if not api_key:
        return None

    known_drug_list = ", ".join(
        sorted(set(BUILTIN_SMILES) | set(learned.values()))
    )
    learned_aliases = json.dumps(learned, sort_keys=True)
    prompt = (
        "Extract every medication name mentioned in the text below. Return ONLY a "
        "JSON list of objects with raw_name and canonical_name. Map each brand, "
        "alias, spelling variant, or newly encountered drug to its closest canonical "
        f"name. Known canonical drugs: [{known_drug_list}]. Learned aliases: "
        f"{learned_aliases}. Do not invent names or return herbs.\n\nText: {raw_text}"
    )

    try:
        response = requests.post(
            FEATHERLESS_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": FEATHERLESS_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 300,
            },
            timeout=12,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.I).strip()
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            parsed = parsed.get("medications", parsed.get("medication_names", []))
        if not isinstance(parsed, list):
            return None

        medications: set[str] = set()
        discovered: dict[str, str] = {}
        for item in parsed:
            if isinstance(item, str):
                canonical = _canonical_medication(item, learned)
                if canonical:
                    medications.add(canonical)
                continue
            if not isinstance(item, dict):
                continue
            raw_name = item.get("raw_name") or item.get("raw") or item.get("name")
            canonical_value = item.get("canonical_name") or item.get("canonical")
            if not isinstance(canonical_value, str):
                continue
            canonical = (
                _canonical_medication(canonical_value, learned)
                or " ".join(canonical_value.strip().split())
            )
            if not canonical:
                continue
            medications.add(canonical)
            if isinstance(raw_name, str):
                raw_key = " ".join(raw_name.strip().lower().split())
                if raw_key and raw_key != canonical.lower() and len(raw_key) > 2:
                    discovered[raw_key] = canonical

        updated = _load_learned_drugs()
        new_learned: list[dict[str, str]] = []
        for raw_name, canonical in discovered.items():
            if updated.get(raw_name) != canonical:
                new_learned.append({"raw_name": raw_name, "canonical_name": canonical})
            updated[raw_name] = canonical
        if discovered:
            _save_learned_drugs(updated)
        return {
            "medications": sorted(medications),
            "method": "featherless",
            "new_learned": new_learned,
            "learned": bool(new_learned),
        }
    except Exception:
        # A network, JSON, or provider error must never break regex extraction.
        return None


def extract(raw_text: str) -> dict[str, Any]:
    """Extract medications and herbs, using regex first and an optional LLM fallback."""
    learned = _load_learned_drugs()
    regex_result = _regex_extract(raw_text, learned)
    needs_fallback = (
        len(regex_result["medications"]) < 2 or bool(regex_result["unrecognized"])
    )
    if not needs_fallback or not os.getenv("FEATHERLESS_API_KEY"):
        return regex_result

    llm_result = _llm_extract(raw_text, learned)
    if llm_result is None:
        return regex_result

    medications = sorted(
        set(regex_result["medications"]) | set(llm_result["medications"])
    )
    matched_canonicals = {
        _canonical_medication(token, learned) for token in regex_result["unrecognized"]
    }
    matched_canonicals.discard(None)
    unrecognized = [
        token
        for token in regex_result["unrecognized"]
        if _canonical_medication(token, learned) not in medications
    ]
    return {
        "medications": medications,
        "herbs": regex_result["herbs"],
        "method": "featherless",
        "unrecognized": unrecognized,
        "learned": bool(llm_result.get("learned", False)),
        "new_learned": llm_result.get("new_learned", []),
    }
