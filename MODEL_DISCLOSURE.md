# Model and retention disclosure

This deployment targets OpenAI's Responses API. Account-level controls and deployment region must still be verified in the OpenAI project before the demo.

| Item                             | Deployment value                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider/legal entity            | OpenAI, L.L.C. (verify against the event account agreement)                                                                                                                  |
| Endpoint/base URL (`AI_API_URL`) | `https://api.openai.com/v1/responses`                                                                                                                                        |
| Model (`AI_MODEL`)               | `gpt-4.1-mini-2025-04-14`                                                                                                                                                    |
| Data sent                        | Synthetic file bytes, MIME type, document type, extraction prompt, and output schema                                                                                         |
| Purpose                          | Structured extraction of the documented field allowlist                                                                                                                      |
| Provider training use            | OpenAI states API data is not used for training unless the organization opts in; verify opt-out in the event project                                                         |
| Provider input/output retention  | `store:false` prevents Responses application-state storage; default abuse-monitoring logs may retain customer content up to 30 days unless approved retention controls apply |
| Application/database retention   | Confirmed/extracted fields persist until verified session deletion; raw files are not stored; backup/log retention remains a deployment disclosure                           |
| Processing/storage regions       | `[regions or unknown]`                                                                                                                                                       |
| Subprocessors                    | `[list/link or unknown]`                                                                                                                                                     |
| Access controls                  | `[roles and audit mechanism]`                                                                                                                                                |
| Incident/privacy contact         | `[contact]`                                                                                                                                                                  |
| Last reviewed                    | `2026-07-19; implementation review`                                                                                                                                          |

If any retention or training term is unknown, disclose it as **unknown** and do not upload real applicant documents. A UI deletion action must not be described as deleting provider copies, logs, or backups unless that behavior has been verified end to end.

Source reviewed 2026-07-19: https://platform.openai.com/docs/guides/your-data
