# PharmaGuide — submission summary

PharmaGuide addresses a public-health problem that is easy to miss: self-medication often combines prescriptions, over-the-counter products, and local herbal remedies without one clinician seeing the complete list. In many communities, that gap can delay care, hide contraindications, and turn a familiar herb or painkiller into a serious interaction risk. PharmaGuide is an offline-first pharmacist co-pilot that makes the first safety conversation easier without pretending to replace a clinician.

A user enters free text such as a medication list or a message about what they take. The FastAPI backend extracts medicines and herbs, checks drug pairs and curated herb cross-references, and returns risks with severity, confidence, and a plain-language “tell your doctor” sheet. This gives a patient something concrete to take to a clinic or pharmacy. The React/Vite interface is designed to make the result understandable rather than burying it in technical terms. The project also includes a self-learning loop: unidentified drug terms are surfaced for review and can be added to the local knowledge/cache workflow, improving future extraction instead of silently discarding new names.

Privacy and access are central design choices. The core analysis, trained interaction model, and curated herb checks can run locally, which supports intermittent connectivity and keeps sensitive medication lists off a third-party service. Optional AI enrichment is explicitly opt-in through environment keys. The system is still a prototype: users should never stop or change treatment from an automated result, and every alert needs professional confirmation.

**Team:** Dominion Ochai (dominionchukwuonwe@gmail.com)

**AI tools disclosure:** scikit-learn is used to train the interaction model; Featherless LLM enrichment is optional; a herb vision API is optional. The local path remains useful without either external key.

**Run pointer:** follow the setup, training, API example, and frontend instructions in [README.md](README.md).
