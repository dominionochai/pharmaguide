"""Offline-first chemistry helpers with cached PubChem enrichment."""
from __future__ import annotations
import hashlib, json
import numpy as np
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import quote
try:
    import requests
except ImportError:
    requests = None
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, DataStructs
    RDKIT_AVAILABLE = True
except ImportError:
    Chem = AllChem = DataStructs = None
    RDKIT_AVAILABLE = False

ROOT = Path(__file__).resolve().parents[1]
CACHE_PATH = ROOT / "data" / "smiles_cache.json"
PUBCHEM_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{}/property/CanonicalSMILES/JSON"
BUILTIN_SMILES: Dict[str, str] = {
    "aspirin": "CC(=O)Oc1ccccc1C(=O)O",
    "warfarin": "CC(C(=O)CC(c1ccccc1)c2ccccc2)O",
    "metformin": "CN(C)C(=N)NC(=N)N",
    "paracetamol": "CC(=O)NC1=CC=C(C=C1)O",
    "acetaminophen": "CC(=O)NC1=CC=C(C=C1)O",
    "ibuprofen": "CC(C)C1=CC=C(C=C1)[C@@H](C)C(=O)O",
    "amlodipine": "CCOC(=O)C1=C(NC(=C1C2=CC=CC=C2Cl)C(=O)OC)C",
    "simvastatin": "CCC(C)(C)C(=O)O[C@H]1C[C@H](C)C2=CC=CC=C2C(=O)O1",
    "digoxin": "CC1OC2C(C(C(C(O2)C3C(C(C(C(O3)CO)O)O)O)O)O)OC4C(C(C(C(O4)C)O)O)O",
    "furosemide": "C1=CC(=CC(=C1)C(=O)NCC2=CC(=CC=C2)S(=O)(=O)N)Cl",
    "sildenafil": "CC1=NN(C(=O)C2=C1C=CC(=C2)N3CCN(CC3)C)C4=CC=CC=C4C5=NC=CN5",
    "nitroglycerin": "C(C(C(=O)O[N+](=O)[O-])O[N+](=O)[O-])O[N+](=O)[O-]",
    "atorvastatin": "CC(C)c1n(c(c(c(=O)n1C)C)C(=O)N[C@@H](C(C)C)C(=O)O)C2=CC=CC=C2",
    "alcohol": "CCO",
    "amiodarone": "CCCCc1oc2ccccc2c1C(=O)c1ccc(I)cc1",
    "lisinopril": "C1CCN(CC1)C(=O)C(CC2=CC=CC=C2)N",
    "potassium": "[K+]",
    "lithium": "[Li+]",
    "grapefruit": "CC(C)C1=CC(=O)C(=CC1=O)O",
    "artemether": "COC1C2CC3C(C(C2(OC1C)OO3)OC)C",
    "lumefantrine": "CCCCCCNCC(C1=C(C=CC(=C1)Cl)Cl)C2=C(C(=CC(=C2)Cl)Cl)O",
    "riboflavin": "CC1=C(C=C(C2=C1C(=O)C3=C(C(=O)N2)N(C=N3)C)C)CO",
    "diclofenac": "C1=CC=C(C(=C1)C(C2=C(C=CC=C2Cl)Cl)N)C(=O)O",
    "amoxicillin": "CC1(C(N2C(S1)C(C2=O)NC(=O)C(C3=CC=CC=C3)N)C(=O)O)O",
    "ciprofloxacin": "C1CC1N2C=C(C(=O)C3=C2C=C(C=C3F)N4CCNCC4)C(=O)O",
    "metronidazole": "CC1=NC=C(N1CCO)[N+](=O)[O-]",
    "omeprazole": "COC1=NC=NC(=C1OC)S(=O)C2=NC=CC(=C2)C",
    "prednisolone": "CC12CCC3C(C1CCC2=O)C(O)CC4=CC(=O)C=CC34C",
    "glibenclamide": "COC1=C(C=CC(=C1)C(=O)NCCC2=CC=C(C=C2)S(=O)(=O)NC(=O)NC3CCCCC3)Cl",
    "chloroquine": "CCN(CC)CCCC(C)NC1=NC=CC(=C1)Cl",
    "quinine": "COC1=CC=CC2=C1C(=CN2)[C@H]3C[C@H]4CN3CC=C4",
    "doxycycline": "CC1C2C(C(C3C(C1(O)C(=O)C4=C(C3=CC(=C4)O)N(C)C)O)N(C)C)O",
    "tramadol": "CN(C)CC1CCC(C(C2=CC=CC(=C2)OC)O)CC1",
    "codeine": "CN1CCC23C4=C5OCOC5=CC4=CC[C@]2([C@H]1CC=C3)O",
    "diazepam": "CN1C(=O)CN=C(C2=CC=CC=C2Cl)C1=O",
}
ALIASES = {
    "asa": "aspirin", "etoh": "alcohol", "acetaminophen": "paracetamol",
    "artemether/lumefantrine": ("artemether", "lumefantrine"),
    "lumefantrine/artemether": ("artemether", "lumefantrine"),
    "coartem": ("artemether", "lumefantrine"),
    "artemether-lumefantrine": ("artemether", "lumefantrine"),
    "lumenfantrin": "lumefantrine", "vitamin b2": "riboflavin",
}

def load_cache(path: Path = CACHE_PATH) -> Dict[str, Optional[str]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}

def save_cache(cache: Dict[str, Optional[str]], path: Path = CACHE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def canonical_smiles(name: str, cache: Optional[Dict[str, Optional[str]]] = None) -> Optional[str]:
    """Resolve a name locally first; PubChem is best effort only."""
    cache = cache if cache is not None else load_cache()
    alias_target = ALIASES.get(str(name).strip().lower(), str(name).strip().lower())
    # Combination aliases have two targets; this scalar API returns the first
    # available target while retaining both targets in the alias definition.
    key = alias_target[0] if isinstance(alias_target, tuple) else alias_target
    if cache.get(key):
        return cache[key]
    if key in BUILTIN_SMILES:
        cache[key] = BUILTIN_SMILES[key]
        return cache[key]
    if requests is not None:
        try:
            response = requests.get(PUBCHEM_URL.format(quote(key)), timeout=3)
            response.raise_for_status()
            value = response.json()["PropertyTable"]["Properties"][0]["ConnectivitySMILES"]
            cache[key] = value
            return value
        except Exception:
            pass
    cache[key] = None
    return None

def _hashed_fingerprint(smiles: str, n_bits: int = 1024) -> list[int]:
    bits = [0] * n_bits
    for width in (1, 2, 3):
        for index in range(max(0, len(smiles) - width + 1)):
            digest = hashlib.blake2b(smiles[index:index + width].encode(), digest_size=4).digest()
            bits[int.from_bytes(digest, "little") % n_bits] = 1
    return bits

def fingerprint_array(smiles: str) -> list[int]:
    if RDKIT_AVAILABLE:
        molecule = Chem.MolFromSmiles(smiles)
        if molecule is not None:
            vector = np.zeros(1024, dtype=np.uint8)
            DataStructs.ConvertToNumpyArray(AllChem.GetMorganFingerprintAsBitVect(molecule, 2, nBits=1024), vector)
            return [int(value) for value in vector]
    return _hashed_fingerprint(smiles)

def fingerprint(smiles: str) -> list[int]:
    return fingerprint_array(smiles)

def rdkit_status() -> bool:
    return RDKIT_AVAILABLE
