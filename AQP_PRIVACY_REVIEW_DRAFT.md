# AQP privacy review — technical draft

## Status and purpose

This document records what can be established from the current application and identifies decisions requiring institutional privacy, security, records-management, or program ownership. It is a technical preparation package, not legal advice or institutional approval.

## Current operating model

AQP is a client-side static application. Uploaded files are parsed in the browser. The current application does not send exam files, student responses, feedback comments, or generated reports to an AQP server.

The browser session can temporarily hold names, identifiers, responses, course/stream codes, answer keys, feedback text, coordinator decisions, and report content in memory while an analysis is open.

## Data inventory

| Data | Why AQP uses it | Current handling | Sensitivity consideration |
| --- | --- | --- | --- |
| Student names and identifiers | Match and inspect uploaded records | Processed in browser memory; excluded from browser drafts and Reopenable AQP backups | Directly identifiable student information |
| Item responses and scores | Calculate item statistics and reports | Processed in browser memory; derived analysis may be saved | Assessment record and potentially identifiable when combined with source files |
| Language/course stream | Produce bilingual summaries and DIF comparisons | Processed and retained in analysis state | May support group comparison and requires purpose/role controls |
| Answer keys and item identifiers | Reconstruct scoring and match questions | Processed in memory; analysis state retains what is needed to reopen work | Confidential assessment content |
| Student feedback comments | Categorize and map feedback | Processed in memory; edits may be retained in a saved session | Free text can contain names or other personal information |
| Coordinator decisions and notes | Preserve exceptions, mapping, review, and sign-off | May be retained in browser draft, Reopenable AQP backup, and downloaded reports | May become an institutional record |
| Source filenames and hashes | Audit reproducibility | Retained in audit metadata | Filenames may themselves contain personal or confidential information |
| Theme preference | Restore appearance | Stored locally when selected | Low sensitivity |

## Storage and movement

1. The user selects local QuestionMark, Scantron, feedback, or session files.
2. The browser reads the files locally and creates an in-memory analysis state.
3. AQP may save a privacy-reduced browser draft for recovery. Names and institutional identifiers are excluded.
4. A user may download reports, structured exports, or a Reopenable AQP backup. Those files leave AQP's control and inherit the protections of the destination device or institutional storage location.
5. The visible Clear Local Data control can remove the saved browser draft and, separately, non-sensitive preferences. It cannot remove files already downloaded or copies stored elsewhere.

## Existing technical controls

- Client-side processing with no AQP application server
- Student names and institutional identifiers excluded from browser drafts and Reopenable AQP backups
- Strict Reopenable AQP backup file type, schema, size, and field validation
- Confirmation before replacing an existing browser draft
- Visible controls to clear saved drafts and optional preferences
- Local-data explanations in the application
- Deterministic calculations and categorization
- Audit metadata for source interpretation, thresholds, exceptions, review decisions, and report generation
- Demonstration mode that does not require real student data
- Automated upload, session, report, malformed-file, and accessibility regression tests

## Risks requiring institutional treatment

| Risk | Current mitigation | Remaining decision or control |
| --- | --- | --- |
| Shared or unattended workstation | Local-data controls and privacy-reduced drafts | Decide whether browser drafts are permitted; define sign-out, clearing, and workstation rules |
| Downloaded reports/backups copied outside approved storage | AQP explains that it cannot delete downloads | Define approved storage locations, encryption expectations, sharing restrictions, and disposal |
| Identifiable or inappropriate text inside feedback/comments | Local processing; no automatic external transfer | Define reviewer responsibilities and whether redaction guidance is required |
| Sensitive filenames retained in audit metadata | Supports reproducibility | Establish filename conventions or remove/transform filenames if institutional policy requires it |
| Public CDN dependencies | No student data is intentionally transmitted to the libraries | IT must choose bundled, institution-hosted, or approved pinned dependencies and a Content Security Policy |
| No production authentication or role enforcement | Current sign-in is explicitly a preview | Define authorized roles and connect institutional authentication before multi-user deployment |
| Browser/device compromise | Outside the application's direct control | Apply managed-device, browser-update, endpoint-protection, and access-control requirements |
| Retention of reports and coordinator decisions | Manual downloads and local work | Define official record status, retention period, owner, approved repository, and destruction process |
| Incident or suspected disclosure | No application-specific institutional process yet | Assign reporting contact, containment steps, investigation owner, and notification rules |

## Decisions required from the institution

1. Who may upload student-level files and generate reports?
2. Are browser recovery drafts permitted on managed devices, shared devices, both, or neither?
3. Which storage location is approved for reports and Reopenable AQP backups?
4. Which outputs are official records, and how long must each be retained?
5. Are filenames allowed to contain student, course, or exam identifiers?
6. Is language-stream DIF within the approved educational and privacy purpose, and who may view it?
7. Who approves privacy, security, records management, accessibility, and academic methodology?
8. What authentication, authorization, inactivity timeout, and audit-log requirements apply at launch?
9. What is the incident-response route if files or reports are sent to the wrong recipient or device?
10. Must the application work fully offline, and may it use public CDNs in any institutional environment?

## Recommended pre-launch actions

1. Review this inventory with institutional privacy, information security, records management, accessibility, and the academic program owner.
2. Decide the approved device and storage model before connecting authentication or collaboration.
3. Bundle or institutionally host third-party dependencies if required by IT.
4. Publish short user guidance covering authorized use, approved storage, shared workstations, downloaded files, and incident reporting.
5. Run a privacy-safe user-acceptance exercise using demonstration data before any operational exam.
6. Record decisions, owners, approval dates, and any required code changes in the final privacy assessment.

## Known limits of this draft

The code can show what AQP currently stores and exports. It cannot determine institutional legal authority, retention schedules, approved repositories, authorized roles, collective-agreement implications, or the final production architecture. Those items remain deliberately marked for institutional decision.
