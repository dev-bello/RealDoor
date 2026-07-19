# Architecture

## Components

- TanStack Start/React presents the four routes and the three-stage workflow.
- The extraction server function sends an uploaded synthetic document to the configured model endpoint and validates structured output.
- Supabase stores session-scoped extraction and confirmation records as configured by the deployment.
- `src/lib/corpus.ts` supplies the frozen rule metadata, threshold table, checklist, annualization, and lookup helpers.
- React Query moves confirmed records between Profile, Understand, and Prepare. Plain code performs calculations and checklist status checks.

## Field purpose allowlist

| Field                                | Purpose                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Person name                          | Reconcile independently documented synthetic income sources                          |
| Household size                       | Select the exact frozen threshold row after confirmation                             |
| Address                              | Let the renter verify the synthetic application-summary identity; never used in math |
| Application date                     | Apply the frozen evidence-recency convention                                         |
| Pay date and pay-period dates        | Select the newest recurring wage evidence and show its period                        |
| Pay or benefit frequency             | Select the deterministic annualization multiplier                                    |
| Regular/weekly hours and hourly rate | Reconcile displayed wage totals and identify conflicts                               |
| Gross pay                            | Document the displayed recurring wage amount                                         |
| Net pay                              | Evidence review only; never used in threshold math                                   |
| Document date                        | Apply the frozen 60-day evidence-recency convention                                  |
| Monthly benefit                      | Add an independently documented recurring benefit source                             |
| Statement month                      | Date the organizer gig-income fixture                                                |
| Gross receipts                       | Add the documented recurring gig source under the challenge convention               |
| Platform fees                        | Evidence review and conflict context; never silently deducted                        |
| Confidence                           | Signal review urgency; never an applicant score                                      |
| Page and source box                  | Preserve traceability from every material value to evidence                          |

Do not add protected characteristics, immigration status, disability or health data, inferred relationships, or free-form applicant profiling. The allowlist supports evidence review and readiness only.

## Data flow

1. The browser reads an explicitly selected synthetic file and sends its encoded content and declared document type to the server function.
2. The server calls the configured model endpoint. Document text is untrusted data, not instructions.
3. Structured suggestions are shown to the user. They can be wrong or incomplete.
4. The user verifies or corrects fields; the confirmed record is stored for the session.
5. Deterministic code annualizes confirmed gross pay and looks up the frozen household-size row. No model makes the calculation or an eligibility decision.
6. Deterministic code compares confirmed document types and dates with the frozen checklist.
7. The browser generates structured JSON and an escaped printable packet. Material evidence citations cannot be omitted. Nothing in the packet is an approval or denial.
