"""Plain-language tell-your-doctor sheet snippets."""
from __future__ import annotations


def tell_your_doctor_sheet(drug_a: str, drug_b: str, severity: str) -> str:
    """Render one flag in English and simple Pidgin for a clinic conversation.

    Kept deliberately generic about mechanism — this layer only knows the
    severity label, not *why* a pair is risky, so it never invents a specific
    clinical reason (e.g. claiming a bleeding-risk pair affects heart rhythm).
    """
    urgent = severity in {"major", "contraindicated"}

    if urgent:
        english = (
            f"Please tell your doctor or pharmacist, before your next dose, that you are "
            f"taking both {drug_a} and {drug_b} together. This combination has a {severity} "
            f"interaction risk and should be reviewed."
        )
        pidgin = (
            f"Oga doctor, I dey take {drug_a} and {drug_b} together — dem talk say e fit "
            f"dangerous well well. Abeg check am quick quick before I take the next dose."
        )
    else:
        english = (
            f"You are taking both {drug_a} and {drug_b}. This is a {severity} interaction — "
            f"worth mentioning at your next visit, but not urgent."
        )
        pidgin = (
            f"Oga doctor, I dey take {drug_a} and {drug_b} together — abeg check if e dey okay "
            f"when you get time."
        )

    return f"English: {english}\nSimple pidgin: {pidgin}"
