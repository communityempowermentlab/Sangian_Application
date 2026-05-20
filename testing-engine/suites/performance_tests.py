"""
Performance Test Suite — API response time and load validation.
"""
import time, statistics, requests, concurrent.futures
from core.reporter import Reporter
from core.config import BASE_URL, ADMIN_EMAIL, ADMIN_PASS

SUITE = "performance_tests"
SLOW_THRESHOLD_MS  = 500   # warn above this
CRIT_THRESHOLD_MS  = 2000  # fail above this

def get_admin_token():
    try:
        r = requests.post(f"{BASE_URL}/admin/login",
                          json={"email": ADMIN_EMAIL, "passcode": ADMIN_PASS}, timeout=10)
        return r.json().get("token")
    except:
        return None

def timed_get(url, headers=None):
    start = time.time()
    try:
        r = requests.get(url, headers=headers, timeout=15)
        ms = int((time.time() - start) * 1000)
        return r.status_code, ms
    except Exception as e:
        return None, -1

def run(rep: Reporter):
    print(f"\n  ⚡ Running Performance Tests\n")

    token = get_admin_token()
    auth  = {"Authorization": f"Bearer {token}"} if token else {}

    endpoints = [
        ("/admin/children",     "GET /admin/children",     True),
        ("/admin/assessors",    "GET /admin/assessors",    True),
        ("/admin/reports",      "GET /admin/reports",      True),
        ("/testing/summary",    "GET /testing/summary",    True),
        ("/errors/summary",     "GET /errors/summary",     True),
    ]

    # ── Single request latency ────────────────────────────────────────────────
    for path, label, needs_auth in endpoints:
        status, ms = timed_get(f"{BASE_URL}{path}", headers=auth if needs_auth else None)
        if ms < 0:
            rep.error(f"Response time: {label}", "Request failed / timeout")
        elif ms > CRIT_THRESHOLD_MS:
            rep.failed(f"Response time: {label}", f"{ms}ms — critically slow (>{CRIT_THRESHOLD_MS}ms)",
                       severity="high", category="performance", duration_ms=ms)
        elif ms > SLOW_THRESHOLD_MS:
            rep.warning(f"Response time: {label}", f"{ms}ms — slow (>{SLOW_THRESHOLD_MS}ms)",
                        severity="medium", category="performance", duration_ms=ms)
        else:
            rep.passed(f"Response time: {label}", f"{ms}ms ✓", category="performance", duration_ms=ms)

    # ── Concurrent load test (10 simultaneous requests) ──────────────────────
    if token:
        target = f"{BASE_URL}/admin/children"
        n = 10
        print(f"  ⏱  Load test: {n} concurrent requests to /admin/children…")
        times = []
        def fetch(_):
            return timed_get(target, auth)[1]
        with concurrent.futures.ThreadPoolExecutor(max_workers=n) as ex:
            results = list(ex.map(fetch, range(n)))
        valid = [t for t in results if t > 0]
        if valid:
            avg = int(statistics.mean(valid))
            p95 = int(sorted(valid)[int(len(valid)*0.95)-1]) if len(valid) > 1 else valid[0]
            mx  = max(valid)
            summary = f"avg={avg}ms  p95={p95}ms  max={mx}ms  ({len(valid)}/{n} succeeded)"
            if p95 > CRIT_THRESHOLD_MS:
                rep.failed("Concurrent load – p95 latency", summary, severity="high", category="performance")
            elif p95 > SLOW_THRESHOLD_MS:
                rep.warning("Concurrent load – p95 latency", summary, severity="medium", category="performance")
            else:
                rep.passed("Concurrent load – p95 latency", summary, category="performance")
        else:
            rep.error("Concurrent load test", "All requests failed")

    # ── Error log endpoint performance (public, no auth) ─────────────────────
    _, ms = timed_get(f"{BASE_URL}/errors/summary".replace("summary","list"), headers=auth)
    if ms > 0:
        label = "Response time: GET /errors/list"
        if ms > SLOW_THRESHOLD_MS:
            rep.warning(label, f"{ms}ms", severity="low", category="performance", duration_ms=ms)
        else:
            rep.passed(label, f"{ms}ms ✓", category="performance", duration_ms=ms)

    rep.summary()
