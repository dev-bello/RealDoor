# Risk note

## Threat model

- **Prompt injection:** uploaded documents may contain instructions intended for the model.
- **Extraction error:** OCR/model output may omit, transpose, or invent values; confidence is not proof.
- **Sensitive-data exposure:** files and extracted fields may pass through browser, application server, model provider, logs, and database.
- **Authorization/session failure:** weak session boundaries could expose or alter another user's records.
- **Stale or misapplied rules:** geography, effective date, AMI band, household treatment, or property requirements may differ.
- **Decision laundering:** a threshold or checklist result could be mistaken for eligibility, approval, priority, or legal advice.
- **Export injection:** untrusted confirmed strings included in HTML exports require safe handling before production use.

## Controls and limitations

The design restricts extraction to a purpose allowlist, treats document text and model output as untrusted, requires confirmation, and keeps math/checklist operations deterministic. The UI repeatedly states the no-eligibility boundary and exposes corpus metadata.

These controls do not prove extraction accuracy, corpus authenticity, export safety, tenant isolation, deletion completeness, provider retention, legal compliance, or WCAG conformance of unowned feature code. Use only synthetic challenge documents until security, privacy, accessibility, and legal reviews are complete. Verify the frozen corpus against current official publications and current property instructions.

## Pack status

The bundled starter pack says **DRAFT - organizer approval required** and **not yet licensed for external distribution**. Its data, documents, gold labels, and other assets must not be redistributed or treated as production-authorized until the organizer supplies approvals and a license. This repository does not grant rights to third-party source material.
