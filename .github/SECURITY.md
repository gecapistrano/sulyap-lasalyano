# Security policy — Sulyap Lasalyano (sulyap-lasalyano)

Thank you for helping keep **Sulyap Lasalyano** and its users safe. This document explains how to report security vulnerabilities responsibly.

## Supported versions

We prioritize fixes on the **default branch** (`main`) and the **latest production deployment** (e.g. Vercel frontend / Render API). Older commits or forks may not receive backports unless agreed with maintainers.

## How to report a vulnerability

**Please do not** open a public GitHub issue for undisclosed security bugs (that can expose users before a fix exists).

### Preferred: GitHub private reporting

If **Private vulnerability reporting** is enabled for this repository:

1. Open the repository on GitHub.
2. Go to **Security** → **Report a vulnerability** (or use the **Security** tab and follow the guided flow).

That keeps details private while we investigate and prepare a fix.

### Alternative: email

If private reporting is unavailable or you need to attach encrypted details, contact the maintainers at:
archive.clr3@gmail.com

Use **“Sulyap Lasalyano security”** in the subject line.

## What to include

- Description of the issue and its **impact** (confidentiality, integrity, availability, privacy).
- **Steps to reproduce** (requests, URLs, roles if auth/RBAC applies).
- **Affected component** (e.g. `frontend/`, `backend/`, deployment config) and version/commit if known.
- Whether you believe it is **actively exploited** (if you know).
- Your **preferred credit** name (or request anonymity).

## Scope (examples)

**In scope**

- Authentication, session, or CSRF weaknesses in the API or web app.
- Broken access control (IDOR), privilege escalation, or unsafe data exposure.
- Injection, unsafe deserialization, or misconfiguration that affects production security.
- Dependency or supply-chain issues with a clear exploit path.

**Generally out of scope**

- Theoretical issues with no practical attack path.
- Social engineering or physical access to devices.
- Denial-of-service requiring huge resources, unless clearly actionable.
- Findings in third-party services **only** — please report those to the vendor; you may still notify us if our integration is wrong.

We may adjust scope case by case.

## Our commitment

- We will **acknowledge** receipt when we can (typically within several business days).
- We will **investigate** and work toward a **coordinated disclosure** (fix, then advisory or release notes as appropriate).
- We will **not** pursue legal action against researchers who follow this policy in good faith.

*This statement does not constitute a legal contract; it reflects our intent.*

## Safe harbor

If you make a good-faith effort to avoid privacy violations, data destruction, and service disruption—and you give us reasonable time to fix the issue before public disclosure—we appreciate responsible handling and coordinated release.

## Project context (for reporters)

- **Frontend:** React (Vite), deployed separately from the API in typical setups.
- **Backend:** FastAPI (Python); mutating endpoints are expected to enforce authentication and CSRF where applicable.
- **Data:** Treat any user or museum content as sensitive; do not exfiltrate real data when demonstrating a bug.

---

*Last updated: confirm private reporting is enabled, and review this text periodically.*


