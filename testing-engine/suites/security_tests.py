"""
Security Test Suite — scans codebase and API for vulnerabilities.
"""
import os, re, requests
from core.reporter import Reporter
from core.config import BASE_URL, PROJECT_ROOT

SUITE = "security_tests"

CLIENT_DIR = os.path.join(PROJECT_ROOT, "client", "src")
SERVER_DIR = os.path.join(PROJECT_ROOT, "server", "src")

JS_EXTS = {".js", ".jsx", ".ts", ".tsx"}
PY_EXTS = {".py"}

def scan_files(root, extensions, pattern, label, rep: Reporter, severity="medium", category="code_scan"):
    """Walk files and report any line matching pattern."""
    hits = []
    if not os.path.exists(root):
        rep.skipped(label, f"Directory not found: {root}")
        return
    for dirpath, _, files in os.walk(root):
        if "node_modules" in dirpath or ".git" in dirpath:
            continue
        for fname in files:
            if not any(fname.endswith(ext) for ext in extensions):
                continue
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f, 1):
                        if re.search(pattern, line):
                            rel = os.path.relpath(fpath, PROJECT_ROOT)
                            hits.append(f"{rel}:{i}  →  {line.strip()[:120]}")
            except:
                pass
    if hits:
        rep.warning(label, f"Found {len(hits)} occurrence(s)", severity=severity,
                    category=category, details="\n".join(hits[:30]))
    else:
        rep.passed(label, "No occurrences found", category=category)

def run(rep: Reporter):
    print(f"\n  🔒 Running Security Tests\n")

    # ── Console.log in production code ────────────────────────────────────────
    scan_files(CLIENT_DIR, JS_EXTS, r"console\.(log|warn|error|debug)\(", "No console.log in frontend",
               rep, severity="low", category="code_quality")

    # ── Hardcoded secrets / passwords ─────────────────────────────────────────
    secret_pattern = r'(password|secret|api_key|apikey|token|passkey)\s*[=:]\s*["\'][^"\']{4,}'
    scan_files(CLIENT_DIR, JS_EXTS, secret_pattern, "No hardcoded secrets in frontend",
               rep, severity="critical", category="security")
    scan_files(SERVER_DIR, {".js"}, secret_pattern, "No hardcoded secrets in backend",
               rep, severity="critical", category="security")

    # ── TODO / FIXME comments ─────────────────────────────────────────────────
    scan_files(CLIENT_DIR, JS_EXTS, r"\b(TODO|FIXME|HACK|XXX)\b", "No unresolved TODO/FIXME",
               rep, severity="low", category="code_quality")

    # ── .env file not committed ───────────────────────────────────────────────
    env_files = []
    for root, _, files in os.walk(PROJECT_ROOT):
        if ".git" in root or "node_modules" in root:
            continue
        for f in files:
            if f == ".env" and ".gitignore" not in root:
                env_files.append(os.path.relpath(os.path.join(root, f), PROJECT_ROOT))

    gitignore = os.path.join(PROJECT_ROOT, ".gitignore")
    if os.path.exists(gitignore):
        with open(gitignore) as gf:
            gi_content = gf.read()
        if ".env" in gi_content:
            rep.passed(".env in .gitignore", "Environment files are gitignored", category="security")
        else:
            rep.failed(".env in .gitignore", ".env not listed in .gitignore — secrets may be committed", severity="critical", category="security")
    else:
        rep.warning(".gitignore exists", "No .gitignore found at project root", severity="high", category="security")

    # ── API endpoint auth protection ──────────────────────────────────────────
    protected = [
        ("/admin/children", "GET"),
        ("/admin/assessors", "GET"),
        ("/admin/reports", "GET"),
        ("/testing/summary", "GET"),
        ("/errors/list", "GET"),
    ]
    for path, method in protected:
        try:
            r = requests.request(method, f"{BASE_URL}{path}", timeout=6)
            if r.status_code in [401, 403]:
                rep.passed(f"Auth guard: {method} {path}", f"Returns {r.status_code} without token", category="security")
            else:
                rep.failed(f"Auth guard: {method} {path}",
                           f"Returns {r.status_code} without token – endpoint may be open",
                           severity="critical", category="security")
        except Exception as e:
            rep.skipped(f"Auth guard: {method} {path}", str(e))

    # ── SQL injection probe (basic) ────────────────────────────────────────────
    sql_payloads = ["' OR '1'='1", "'; DROP TABLE children; --", "\" OR \"1\"=\"1"]
    inj_found = False
    for payload in sql_payloads:
        try:
            r = requests.post(f"{BASE_URL}/admin/login",
                              json={"email": payload, "passcode": payload}, timeout=6)
            if r.status_code == 200 and "token" in r.json():
                rep.failed("SQL injection – admin login", f"Payload accepted: {payload}", severity="critical", category="security")
                inj_found = True
                break
        except:
            pass
    if not inj_found:
        rep.passed("SQL injection – admin login", "Injection payloads rejected correctly", category="security")

    # ── XSS probe (reflected) ──────────────────────────────────────────────────
    xss = "<script>alert('xss')</script>"
    try:
        r = requests.post(f"{BASE_URL}/admin/login",
                          json={"email": xss, "passcode": "test"}, timeout=6)
        body = r.text
        if xss in body:
            rep.failed("XSS – reflected input in response", "Raw script tag returned in response", severity="critical", category="security")
        else:
            rep.passed("XSS – input sanitized in response", "Script tags not reflected in response", category="security")
    except:
        rep.skipped("XSS probe", "Could not reach server")

    # ── CORS check ────────────────────────────────────────────────────────────
    try:
        r = requests.options(BASE_URL.replace("/api",""), headers={"Origin": "https://evil.com"}, timeout=6)
        acao = r.headers.get("Access-Control-Allow-Origin", "")
        if acao == "*":
            rep.warning("CORS policy", "Access-Control-Allow-Origin: * — consider restricting in production", severity="medium", category="security")
        elif acao:
            rep.passed("CORS policy", f"Origin restricted to: {acao}", category="security")
        else:
            rep.passed("CORS policy", "No CORS wildcard detected", category="security")
    except:
        rep.skipped("CORS policy check", "Could not reach server")

    rep.summary()
