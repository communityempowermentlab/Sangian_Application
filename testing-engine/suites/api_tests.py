"""
API Test Suite — validates every Sangian backend endpoint.
"""
import time, requests
from core.reporter import Reporter
from core.config import BASE_URL, ADMIN_EMAIL, ADMIN_PASS

SUITE = "api_tests"

def get_admin_token():
    try:
        r = requests.post(f"{BASE_URL}/admin/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=10)
        return r.json().get("token")
    except:
        return None

def _get(url, headers=None, timeout=8):
    t = time.time()
    r = requests.get(url, headers=headers, timeout=timeout)
    return r, int((time.time()-t)*1000)

def _post(url, data, headers=None, timeout=8):
    t = time.time()
    r = requests.post(url, json=data, headers=headers, timeout=timeout)
    return r, int((time.time()-t)*1000)

def run(rep: Reporter):
    print(f"\n  🌐 Running API Tests against {BASE_URL}\n")
    auth = {}

    # ── Server health ──────────────────────────────────────────────────────────
    try:
        r, ms = _get(BASE_URL.replace("/api",""))
        if r.status_code == 200:
            rep.passed("Server health check", f"HTTP 200 in {ms}ms", category="health", duration_ms=ms)
        else:
            rep.failed("Server health check", f"Expected 200, got {r.status_code}", severity="critical", duration_ms=ms)
    except Exception as e:
        rep.error("Server health check", f"Cannot reach server: {e}", severity="critical")

    # ── Admin login ────────────────────────────────────────────────────────────
    try:
        r, ms = _post(f"{BASE_URL}/admin/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        if r.status_code == 200 and "token" in r.json():
            token = r.json()["token"]
            auth = {"Authorization": f"Bearer {token}"}
            rep.passed("Admin login – valid credentials", f"Token received in {ms}ms", category="auth", duration_ms=ms)
        else:
            rep.failed("Admin login – valid credentials", f"Status {r.status_code}: {r.text[:100]}", severity="critical", duration_ms=ms)
    except Exception as e:
        rep.error("Admin login – valid credentials", str(e), severity="critical")

    try:
        r, ms = _post(f"{BASE_URL}/admin/login", {"email": "wrong@x.com", "passcode": "badpass"})
        if r.status_code in [401, 400]:
            rep.passed("Admin login – invalid credentials rejected", f"Correctly returned {r.status_code}", category="auth", duration_ms=ms)
        else:
            rep.failed("Admin login – invalid credentials rejected", f"Expected 401/400, got {r.status_code}", severity="high", duration_ms=ms)
    except Exception as e:
        rep.error("Admin login – invalid credentials rejected", str(e))

    # ── Auth protection ────────────────────────────────────────────────────────
    for path in ["/admin/children", "/admin/assessors"]:
        try:
            r, ms = _get(f"{BASE_URL}{path}")  # No token
            if r.status_code in [401, 403]:
                rep.passed(f"Auth guard – {path}", f"Unauthenticated request blocked ({r.status_code})", category="security", duration_ms=ms)
            else:
                rep.failed(f"Auth guard – {path}", f"Endpoint returned {r.status_code} without auth — possible open endpoint", severity="critical", duration_ms=ms)
        except Exception as e:
            rep.error(f"Auth guard – {path}", str(e))

    if not auth:
        rep.skipped("Remaining API tests", "Skipped – could not obtain admin token")
        return

    # ── Children API ───────────────────────────────────────────────────────────
    try:
        r, ms = _get(f"{BASE_URL}/admin/children", headers=auth)
        if r.status_code == 200:
            data = r.json()
            count = len(data.get("children", data if isinstance(data, list) else []))
            rep.passed("GET /admin/children", f"{count} records returned in {ms}ms", category="crud", duration_ms=ms)
        else:
            rep.failed("GET /admin/children", f"Status {r.status_code}", duration_ms=ms)
    except Exception as e:
        rep.error("GET /admin/children", str(e))

    # ── Assessors API ─────────────────────────────────────────────────────────
    try:
        r, ms = _get(f"{BASE_URL}/admin/assessors", headers=auth)
        if r.status_code == 200:
            rep.passed("GET /admin/assessors", f"Status 200 in {ms}ms", category="crud", duration_ms=ms)
        else:
            rep.failed("GET /admin/assessors", f"Status {r.status_code}", duration_ms=ms)
    except Exception as e:
        rep.error("GET /admin/assessors", str(e))

    # ── Reports API ───────────────────────────────────────────────────────────
    try:
        r, ms = _get(f"{BASE_URL}/games/reports/overview", headers=auth)
        if r.status_code == 200:
            rep.passed("GET /games/reports/overview", f"Status 200 in {ms}ms", category="reports", duration_ms=ms)
        else:
            rep.warning("GET /games/reports/overview", f"Status {r.status_code}", duration_ms=ms)
    except Exception as e:
        rep.error("GET /games/reports/overview", str(e))

    # ── Sessions API ──────────────────────────────────────────────────────────
    try:
        r, ms = _get(f"{BASE_URL}/sessions", headers=auth)
        rep.passed("GET /sessions", f"Status {r.status_code} in {ms}ms", category="sessions", duration_ms=ms) \
            if r.status_code == 200 else \
            rep.warning("GET /sessions", f"Status {r.status_code}", category="sessions", duration_ms=ms)
    except Exception as e:
        rep.error("GET /sessions", str(e))

    # ── Docs API ──────────────────────────────────────────────────────────────
    try:
        r, ms = _get(f"{BASE_URL}/docs/numeracy_number_skill", headers=auth)
        if r.status_code == 200:
            rep.passed("GET /docs/:game_key", f"Status 200 in {ms}ms", category="docs", duration_ms=ms)
        else:
            rep.warning("GET /docs/:game_key", f"Status {r.status_code}", duration_ms=ms)
    except Exception as e:
        rep.error("GET /docs/:game_key", str(e))

    # ── Error log endpoint (public) ───────────────────────────────────────────
    try:
        r, ms = _post(f"{BASE_URL}/errors/log", {
            "fingerprint": "test0000",
            "message": "Automated test – ignore",
            "source_type": "manual",
            "severity": "info",
        })
        if r.status_code == 200:
            rep.passed("POST /errors/log (public)", f"Error ingested in {ms}ms", category="crash_analytics", duration_ms=ms)
        else:
            rep.failed("POST /errors/log (public)", f"Status {r.status_code}", duration_ms=ms)
    except Exception as e:
        rep.error("POST /errors/log (public)", str(e))

    # ── Analytics routes ──────────────────────────────────────────────────────
    for path in ["/analytics/report", "/analytics/top-pages"]:
        try:
            r, ms = _post(f"{BASE_URL}{path}", {"accessToken":"fake","propertyId":"0"}, headers=auth)
            # Expect 400 or 401 from Google (not 500 from our server)
            if r.status_code < 500:
                rep.passed(f"POST {path} – server handles bad token gracefully", f"Status {r.status_code}", category="analytics", duration_ms=ms)
            else:
                rep.failed(f"POST {path} – server error on bad token", f"Status {r.status_code}", severity="medium", duration_ms=ms)
        except Exception as e:
            rep.error(f"POST {path}", str(e))

    rep.summary()
