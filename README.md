# RealDoor

RealDoor is a research prototype for application-readiness support. It proposes structured fields from synthetic documents, requires human confirmation, performs deterministic threshold calculations against a frozen corpus, and compares uploads with a frozen checklist. It does not determine eligibility, approval, priority, availability, rent, or waitlist status.

## Run locally

```sh
npm install
npm run dev
```

Provider and database variables are deployment-specific. See `MODEL_DISCLOSURE.md` before configuring `AI_API_KEY`, `AI_API_URL`, `AI_MODEL`, and the Supabase variables used by the application. Never commit credentials or use real applicant documents in the demo.

## Demo

1. Open the Rules page and identify the corpus version, effective-date metadata, geography, and verification warning.
2. Open Workflow, upload an organizer-provided synthetic pay stub, and review the proposed allowlisted fields against the source.
3. Correct a value and confirm it. Explain that only the confirmed record flows downstream.
4. Use Understand to show the plain-code annualization and frozen table lookup. State that the output is only a threshold comparison.
5. Use Prepare to show checklist gaps and export a draft packet. State that property requirements may differ and a qualified human makes all decisions.
6. Delete the demo session, then explain that actual storage and model-provider retention depend on the deployed configuration and verified provider terms.

## Documentation

- `ARCHITECTURE.md`: components, purpose allowlist, and data flow
- `RISK_NOTE.md`: threat model, safeguards, limitations, and pack status
- `MODEL_DISCLOSURE.md`: provider configuration and retention disclosure template

The bundled starter pack is marked **DRAFT** and not yet licensed for external distribution. Do not redistribute pack assets until organizer approval and an applicable license are confirmed.

# RealDoor
