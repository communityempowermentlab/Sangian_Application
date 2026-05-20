"""
Database Test Suite — validates schema integrity and data consistency.
"""
from core.reporter import Reporter
from core.config import DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME

SUITE = "db_tests"

REQUIRED_TABLES = [
    "children", "admins", "assessors", "game_sessions",
    "game_assessments", "login_sessions", "admin_login_sessions",
    "game_documents", "game_document_versions",
    "crash_logs", "test_runs", "test_results",
]

def run(rep: Reporter):
    print(f"\n  🗄️  Running Database Tests\n")
    try:
        import mysql.connector
        conn = mysql.connector.connect(
            host=DB_HOST, port=DB_PORT,
            user=DB_USER, password=DB_PASS,
            database=DB_NAME, connection_timeout=8,
        )
        cur = conn.cursor(dictionary=True)
        rep.passed("Database connection", f"Connected to {DB_NAME}@{DB_HOST}:{DB_PORT}", category="db", severity="info")
    except Exception as e:
        rep.error("Database connection", str(e), severity="critical", category="db")
        return

    # ── Required tables exist ─────────────────────────────────────────────────
    cur.execute("SHOW TABLES")
    existing = {list(row.values())[0].lower() for row in cur.fetchall()}

    for table in REQUIRED_TABLES:
        if table in existing:
            rep.passed(f"Table exists: {table}", category="schema")
        else:
            rep.failed(f"Table exists: {table}", f"Table '{table}' not found in database", severity="critical", category="schema")

    # ── At least one admin exists ─────────────────────────────────────────────
    try:
        cur.execute("SELECT COUNT(*) AS c FROM admins")
        count = cur.fetchone()["c"]
        if count > 0:
            rep.passed("Admin account exists", f"{count} admin(s) found", category="data")
        else:
            rep.failed("Admin account exists", "No admin accounts in database", severity="critical", category="data")
    except Exception as e:
        rep.error("Admin account check", str(e), severity="high")

    # ── Children data integrity ────────────────────────────────────────────────
    try:
        cur.execute("SELECT COUNT(*) AS total, SUM(child_id IS NULL) AS nulls FROM children")
        row = cur.fetchone()
        if row["nulls"] and row["nulls"] > 0:
            rep.warning("Children – no null child_ids", f"{row['nulls']} children with null child_id", severity="medium", category="data")
        else:
            rep.passed("Children – no null child_ids", f"{row['total']} children, all have child_id", category="data")
    except Exception as e:
        rep.error("Children data integrity", str(e))

    # ── Orphaned game sessions ────────────────────────────────────────────────
    try:
        cur.execute("""
            SELECT COUNT(*) AS c FROM game_sessions gs
            LEFT JOIN children c ON gs.child_id = c.child_id
            WHERE c.id IS NULL
        """)
        orphans = cur.fetchone()["c"]
        if orphans > 0:
            rep.warning("No orphaned game sessions", f"{orphans} sessions with no matching child", severity="medium", category="data")
        else:
            rep.passed("No orphaned game sessions", "All sessions linked to valid children", category="data")
    except Exception as e:
        rep.error("Orphaned game sessions check", str(e))

    # ── Incomplete sessions (stuck in_progress) ───────────────────────────────
    try:
        cur.execute("""
            SELECT COUNT(*) AS c FROM game_sessions
            WHERE status = 'in_progress'
            AND updated_at < NOW() - INTERVAL 7 DAY
        """)
        stuck = cur.fetchone()["c"]
        if stuck > 0:
            rep.warning("Stale in_progress sessions", f"{stuck} sessions stuck for >7 days", severity="low", category="data")
        else:
            rep.passed("No stale sessions", "No in_progress sessions older than 7 days", category="data")
    except Exception as e:
        rep.error("Stale sessions check", str(e))

    # ── DB indexes present ────────────────────────────────────────────────────
    key_indexes = [
        ("children", "child_id"),
        ("game_sessions", "child_id"),
        ("crash_logs", "fingerprint"),
        ("test_results", "run_id"),
    ]
    for table, col in key_indexes:
        try:
            cur.execute(f"SHOW INDEX FROM {table} WHERE Column_name = %s", (col,))
            rows = cur.fetchall()
            if rows:
                rep.passed(f"Index on {table}.{col}", category="performance")
            else:
                rep.warning(f"Index on {table}.{col}", f"Missing index on {table}.{col} — may slow queries",
                            severity="low", category="performance")
        except Exception as e:
            rep.skipped(f"Index check {table}.{col}", str(e))

    # ── Duplicate email detection ─────────────────────────────────────────────
    try:
        cur.execute("""
            SELECT email, COUNT(*) AS c FROM assessors
            GROUP BY email HAVING c > 1
        """)
        dupes = cur.fetchall()
        if dupes:
            rep.failed("No duplicate assessor emails", f"{len(dupes)} duplicate email(s) found", severity="high", category="data",
                       details="\n".join(d["email"] for d in dupes))
        else:
            rep.passed("No duplicate assessor emails", "All assessor emails are unique", category="data")
    except Exception as e:
        rep.error("Duplicate email check", str(e))

    # ── Recent error log ──────────────────────────────────────────────────────
    try:
        cur.execute("SELECT COUNT(*) AS c FROM crash_logs WHERE status='open' AND severity IN ('fatal','error')")
        row = cur.fetchone()
        count = row["c"]
        if count > 50:
            rep.warning("Open error log backlog", f"{count} open fatal/error logs — review in Crash Analytics", severity="medium", category="monitoring")
        else:
            rep.passed("Error log backlog", f"{count} open fatal/error entries", category="monitoring")
    except Exception as e:
        rep.error("Crash log check", str(e))

    cur.close()
    conn.close()
    rep.summary()
