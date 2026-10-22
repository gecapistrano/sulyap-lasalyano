"""
Static security checks for this repo (no runtime): secret patterns, unsafe React, CSRF markers, Vercel headers.

Run via `npm run security:lint` from the repository root or `python backend/scripts/security_lint.py`.
"""
from pathlib import Path
import json
import re
import sys


ROOT = Path(__file__).resolve().parents[2]
CHECK_PATHS = [
    ROOT / "backend" / "app",
    ROOT / "frontend" / "src",
]

HARD_CODED_SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|secret|password)\s*=\s*['\"][^'\"]+['\"]"),
    re.compile(r"(?i)jwt[_-]?secret[_-]?key\s*=\s*['\"][^'\"]+['\"]"),
]
UNSAFE_RENDER_PATTERN = re.compile(r"dangerouslySetInnerHTML")
RAW_SQL_PATTERN = re.compile(r"(?i)\bexecute\(\s*f?['\"].*SELECT .*{")

REQUIRED_TEXT_MARKERS: dict[Path, list[str]] = {
    ROOT / "backend" / "app" / "deps.py": [
        "def verify_csrf_token(",
        "X-CSRF-Token",
        "csrf_token",
    ],
    ROOT / "backend" / "app" / "routers" / "artifacts.py": [
        "Depends(verify_csrf_token)",
        "ensure_resource_owner_or_admin",
    ],
    ROOT / "backend" / "app" / "routers" / "admin.py": [
        "Depends(verify_csrf_token)",
        "require_roles(UserRole.admin)",
    ],
    ROOT / "backend" / "app" / "routers" / "auth.py": [
        "httponly\": True",
        "key=\"csrf_token\"",
        "secure=settings.cookie_secure",
    ],
    ROOT / "backend" / "app" / "main.py": [
        "allow_origins=settings.allowed_origins",
        "allow_headers=[",
        "X-CSRF-Token",
        "Strict-Transport-Security",
        "frame-ancestors 'none'",
    ],
    ROOT / "frontend" / "src" / "lib" / "secureApi.js": [
        "credentials: 'include'",
        "'X-CSRF-Token'",
    ],
}

FORBIDDEN_TEXT_MARKERS: dict[Path, list[str]] = {
    ROOT / "backend" / "app" / "main.py": ['allow_origins=["*"]', "allow_origins = ['*']"],
}

REQUIRED_VERCEL_HEADERS = {
    "Strict-Transport-Security",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Content-Security-Policy",
}


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    text = path.read_text(encoding="utf-8")

    for pattern in HARD_CODED_SECRET_PATTERNS:
        if pattern.search(text):
            findings.append(f"Hardcoded secret-like value in {path}")
            break

    if UNSAFE_RENDER_PATTERN.search(text):
        findings.append(f"Unsafe HTML rendering found in {path}")

    if RAW_SQL_PATTERN.search(text):
        findings.append(f"Potential SQL injection pattern in {path}")

    return findings


def scan_policy_markers() -> list[str]:
    findings: list[str] = []

    for file_path, required_markers in REQUIRED_TEXT_MARKERS.items():
        if not file_path.exists():
            findings.append(f"Missing required security file: {file_path}")
            continue
        content = file_path.read_text(encoding="utf-8")
        for marker in required_markers:
            if marker not in content:
                findings.append(f"Missing required security marker '{marker}' in {file_path}")

    for file_path, forbidden_markers in FORBIDDEN_TEXT_MARKERS.items():
        if not file_path.exists():
            continue
        content = file_path.read_text(encoding="utf-8")
        for marker in forbidden_markers:
            if marker in content:
                findings.append(f"Forbidden security marker '{marker}' found in {file_path}")

    # Single source of truth: frontend deploy config lives under frontend/
    for vercel_path in [ROOT / "frontend" / "vercel.json"]:
        if not vercel_path.exists():
            findings.append(f"Missing Vercel security config: {vercel_path}")
            continue
        try:
            data = json.loads(vercel_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            findings.append(f"Invalid JSON in {vercel_path}")
            continue

        header_keys: set[str] = set()
        for rule in data.get("headers", []):
            for header in rule.get("headers", []):
                key = header.get("key")
                if isinstance(key, str):
                    header_keys.add(key)

        missing_headers = REQUIRED_VERCEL_HEADERS.difference(header_keys)
        for header in sorted(missing_headers):
            findings.append(f"Missing required Vercel header '{header}' in {vercel_path}")

    return findings


def main() -> int:
    findings: list[str] = []
    for base_path in CHECK_PATHS:
        if not base_path.exists():
            continue
        for file_path in base_path.rglob("*"):
            if file_path.suffix not in {".py", ".js", ".jsx", ".ts", ".tsx"}:
                continue
            findings.extend(scan_file(file_path))
    findings.extend(scan_policy_markers())

    if findings:
        print("Security lint failed:")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("Security lint passed: no critical anti-patterns found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
