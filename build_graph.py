"""
Builds data/graph.json — the merged dataset behind the /graph endpoint.

Node metadata (drug class, CYP pathway, half-life) is reused from the curated
reference dataset wherever a drug name overlaps; for pharmaguide-only
drugs it's marked as unavailable rather than fabricated. Edge data
(mechanism/clinical effect/evidence level) is reused from that same curated
reference dataset for overlapping pairs; for pairs unique to pharmaguide's CURATED_PAIRS
training data, this file supplies real, well-documented pharmacology (not
invented) — these are standard textbook interactions.

Run once: python build_graph.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REFERENCE_DATA = ROOT / "curated_interactions.json"
OUT = ROOT / "data" / "graph.json"

LOCAL_NAMES = {
    "warfarin": "Warfarin", "aspirin": "Aspirin", "metformin": "Glucophage",
    "paracetamol": "Panadol", "ibuprofen": "Ibucap", "amlodipine": "Norvasc",
    "simvastatin": "Simvastatin", "digoxin": "Lanoxin", "furosemide": "Lasix",
    "sildenafil": "Sildenafil", "nitroglycerin": "Nitroglycerin", "atorvastatin": "Lipitor",
    "alcohol": "Alcohol", "amiodarone": "Cordarone", "lisinopril": "Zestril",
    "potassium": "Potassium Supplement", "lithium": "Lithium", "grapefruit": "Grapefruit",
    "clopidogrel": "Plavix", "doxazosin": "Doxazosin", "tadalafil": "Tadalafil",
    "ciprofloxacin": "Ciprotab", "theophylline": "Theophylline", "fluoxetine": "Prozac",
    "tramadol": "Tramal", "sertraline": "Zoloft", "linezolid": "Linezolid",
    "clarithromycin": "Klaricid", "colchicine": "Colchicine", "erythromycin": "Erythrocin",
    "hydrochlorothiazide": "Hydrochlorothiazide", "insulin": "Actrapid",
    "levothyroxine": "Levothyroxine", "calcium": "Calcium Supplement", "omeprazole": "Omez",
    "trimethoprim": "Septrin", "rifampicin": "Rifampicin", "contrast media": "Contrast Dye",
    "cimetidine": "Cimetidine", "beta blockers": "Beta Blocker", "loratadine": "Clarityn",
}

BUILTIN_DRUGS = ["aspirin", "warfarin", "metformin", "paracetamol", "ibuprofen", "amlodipine",
    "simvastatin", "digoxin", "furosemide", "sildenafil", "nitroglycerin", "atorvastatin", "alcohol",
    "amiodarone", "lisinopril", "potassium", "lithium", "grapefruit", "clopidogrel", "doxazosin",
    "tadalafil", "ciprofloxacin", "theophylline", "fluoxetine", "tramadol", "sertraline", "linezolid",
    "clarithromycin", "colchicine", "erythromycin", "hydrochlorothiazide", "insulin", "levothyroxine",
    "calcium", "omeprazole", "trimethoprim", "rifampicin", "contrast media", "cimetidine",
    "beta blockers", "loratadine"]

# Real, well-documented pharmacology for CURATED_PAIRS not already in the reference dataset.
AUTHORED_INTERACTIONS = [
    ("ibuprofen", "aspirin", "moderate", "Additive antiplatelet/GI effect",
     "Ibuprofen can block aspirin's irreversible platelet binding if dosed too close together, and both irritate the stomach lining, raising bleeding/ulcer risk.", "established"),
    ("sildenafil", "nitroglycerin", "contraindicated", "Additive nitric-oxide/cGMP pathway effect",
     "Both drugs amplify the same vasodilation pathway; combined use can cause severe, life-threatening hypotension. Absolute contraindication.", "established"),
    ("amlodipine", "simvastatin", "moderate", "CYP3A4 competition raises simvastatin exposure",
     "Amlodipine modestly inhibits simvastatin's clearance, raising drug levels and myopathy risk at higher simvastatin doses (cap at 20 mg/day per FDA guidance).", "established"),
    ("paracetamol", "warfarin", "moderate", "Possible potentiation of anticoagulant effect",
     "Regular high-dose paracetamol use over several days can modestly increase INR in some patients; occasional single doses are not typically an issue.", "probable"),
    ("warfarin", "trimethoprim", "major", "CYP2C9 inhibition raises warfarin levels",
     "Trimethoprim (often as co-trimoxazole/Septrin) inhibits warfarin metabolism and displaces it from protein binding, sharply raising bleeding risk.", "established"),
    ("aspirin", "clopidogrel", "moderate", "Additive antiplatelet effect",
     "Deliberately combined after cardiac stents under close supervision, but outside that context raises bleeding risk without added benefit.", "established"),
    ("metformin", "contrast media", "major", "Risk of contrast-induced lactic acidosis",
     "IV contrast dye can transiently impair kidney function; reduced clearance of metformin raises lactic acidosis risk. Usually held before/after contrast imaging.", "established"),
    ("metformin", "cimetidine", "moderate", "Reduced renal clearance of metformin",
     "Cimetidine competes for the same renal transporter that clears metformin, raising metformin levels.", "established"),
    ("simvastatin", "grapefruit", "major", "CYP3A4 inhibition raises simvastatin exposure",
     "Grapefruit strongly inhibits intestinal CYP3A4, which can multiply simvastatin blood levels and significantly raise myopathy/rhabdomyolysis risk.", "established"),
    ("amlodipine", "lisinopril", "minor", "Complementary antihypertensive combination",
     "Commonly and safely combined for blood pressure control; watch for additive hypotension when starting both together.", "established"),
    ("sildenafil", "doxazosin", "moderate", "Additive alpha-blocker/vasodilator hypotension",
     "Both lower blood pressure through different vasodilatory mechanisms; combined use raises symptomatic hypotension risk, especially on standing.", "established"),
    ("nitroglycerin", "tadalafil", "contraindicated", "Additive nitric-oxide/cGMP pathway effect",
     "Same mechanism as sildenafil + nitrates: severe, potentially fatal hypotension. Absolute contraindication.", "established"),
    ("fluoxetine", "tramadol", "major", "Serotonin syndrome risk",
     "Both raise synaptic serotonin; combined use can precipitate serotonin syndrome (agitation, fever, tremor, in severe cases life-threatening).", "established"),
    ("sertraline", "linezolid", "contraindicated", "Serotonin syndrome risk",
     "Linezolid is a weak MAOI; combined with an SSRI it carries a serious, well-documented serotonin syndrome risk.", "established"),
    ("clarithromycin", "colchicine", "major", "CYP3A4/P-glycoprotein inhibition raises colchicine levels",
     "Clarithromycin blocks colchicine's clearance pathways, and colchicine has a narrow safety margin — toxicity (including fatal cases) has been reported.", "established"),
    ("erythromycin", "warfarin", "major", "CYP3A4 inhibition potentiates warfarin",
     "Erythromycin inhibits warfarin's metabolism, raising INR and bleeding risk.", "established"),
    ("lisinopril", "potassium", "moderate", "Additive hyperkalemia risk",
     "ACE inhibitors already reduce potassium excretion; adding a potassium supplement can push levels dangerously high, especially with reduced kidney function.", "established"),
    ("hydrochlorothiazide", "lithium", "major", "Reduced renal clearance of lithium",
     "Thiazide diuretics reduce lithium excretion, which has a narrow safety margin — this combination frequently causes lithium toxicity if not dose-adjusted and monitored.", "established"),
    ("insulin", "beta blockers", "moderate", "Masked hypoglycemia symptoms",
     "Beta blockers blunt the adrenaline-driven warning signs of low blood sugar (tremor, palpitations), so hypoglycemia can go unnoticed longer.", "established"),
    ("levothyroxine", "calcium", "minor", "Reduced levothyroxine absorption",
     "Calcium binds levothyroxine in the gut if taken together, reducing absorption — usually managed by spacing doses 4 hours apart.", "established"),
    ("loratadine", "alcohol", "minor", "Mild additive sedation",
     "Loratadine is non-sedating for most people, but a minority still experience added drowsiness with alcohol.", "probable"),
]

def main():
    dataset = json.loads(REFERENCE_DATA.read_text())
    drugs_by_name = {d["name"]: d for d in dataset["drugs"]}
    interaction_pairs = {frozenset([x["drug_a"], x["drug_b"]]): x for x in dataset["interactions"]}

    from pharmaguide.herbs_db import HERBS_DB

    nodes = []
    for name in BUILTIN_DRUGS:
        drug_info = drugs_by_name.get(name)
        nodes.append({
            "id": name, "name": name,
            "local_name": LOCAL_NAMES.get(name, name.capitalize()),
            "generic_name": drug_info["generic_name"] if drug_info else name.capitalize(),
            "drug_class": drug_info["drug_class"] if drug_info else None,
            "cyp_pathway": drug_info["cyp_pathway"] if drug_info else [],
            "half_life_hours": drug_info["half_life_hours"] if drug_info else None,
            "node_type": "drug",
        })

    for key, herb in HERBS_DB.items():
        nodes.append({
            "id": key, "name": key,
            "local_name": herb.get("common_name", key.replace("_", " ").title()),
            "generic_name": herb.get("scientific_name", ""),
            "drug_class": "herbal remedy",
            "cyp_pathway": [],
            "half_life_hours": None,
            "node_type": "herb",
        })

    links = []
    seen = set()
    for a, b, severity_label, mechanism, effect, evidence in AUTHORED_INTERACTIONS:
        key = frozenset([a, b])
        if key in seen:
            continue
        seen.add(key)
        sev_num = {"minor": 2, "moderate": 3, "major": 4, "contraindicated": 5}[severity_label]
        links.append({"source": a, "target": b, "severity": sev_num, "mechanism": mechanism,
                      "clinical_effect": effect, "evidence_level": evidence})

    curated_names = {n for pair in [(x[0], x[1]) for x in AUTHORED_INTERACTIONS] for n in pair}
    for pair_key, drug_info in interaction_pairs.items():
        names = list(pair_key)
        if len(names) == 2 and all(n in BUILTIN_DRUGS for n in names):
            key = frozenset(names)
            if key in seen:
                continue
            seen.add(key)
            links.append({"source": names[0], "target": names[1], "severity": drug_info["severity"],
                          "mechanism": drug_info["mechanism"], "clinical_effect": drug_info["clinical_effect"],
                          "evidence_level": drug_info["evidence_level"]})

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"nodes": nodes, "links": links}, indent=2))
    print(f"Wrote {len(nodes)} nodes, {len(links)} links to {OUT}")

if __name__ == "__main__":
    main()
