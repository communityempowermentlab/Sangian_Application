"""
Code Quality Suite — static analysis of JS/JSX/Node source files.
"""
import os, re
from core.reporter import Reporter
from core.config import PROJECT_ROOT

SUITE = "code_quality"
CLIENT_SRC = os.path.join(PROJECT_ROOT, "client", "src")
SERVER_SRC = os.path.join(PROJECT_ROOT, "server", "src")

def walk_code(root, extensions):
    results = []
    if not os.path.exists(root):
        return results
    for dirpath, _, files in os.walk(root):
        if "node_modules" in dirpath or ".git" in dirpath:
            continue
        for fname in files:
            if any(fname.endswith(e) for e in extensions):
                results.append(os.path.join(dirpath, fname))
    return results

def read_file(path):
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            return f.readlines()
    except:
        return []

def run(rep: Reporter):
    print(f"\n  🧹 Running Code Quality Tests\n")
    js_files  = walk_code(CLIENT_SRC, [".js", ".jsx"])
    srv_files = walk_code(SERVER_SRC, [".js"])
    all_files = js_files + srv_files

    # ── console.log count ─────────────────────────────────────────────────────
    console_hits = []
    for fp in js_files:
        for i, line in enumerate(read_file(fp), 1):
            if re.search(r"console\.(log|warn|debug)\(", line) and "// eslint" not in line:
                rel = os.path.relpath(fp, PROJECT_ROOT)
                console_hits.append(f"{rel}:{i}")
    if console_hits:
        rep.warning("console.log statements", f"{len(console_hits)} found — remove before production",
                    severity="low", category="code_quality",
                    details="\n".join(console_hits[:20]))
    else:
        rep.passed("No console.log statements", category="code_quality")

    # ── Unused imports heuristic ──────────────────────────────────────────────
    unused = []
    for fp in js_files:
        lines = read_file(fp)
        content = "".join(lines)
        for i, line in enumerate(lines, 1):
            m = re.match(r"^import\s+(\w+)\s+from", line.strip())
            if m:
                name = m.group(1)
                # Count uses outside the import line
                rest = content.replace(line, "", 1)
                if rest.count(name) == 0:
                    rel = os.path.relpath(fp, PROJECT_ROOT)
                    unused.append(f"{rel}:{i}  import {name}")
    if unused:
        rep.warning("Potentially unused imports", f"{len(unused)} possible unused default imports",
                    severity="low", category="code_quality",
                    details="\n".join(unused[:20]))
    else:
        rep.passed("No obviously unused imports", category="code_quality")

    # ── TODO/FIXME comments ───────────────────────────────────────────────────
    todos = []
    for fp in all_files:
        for i, line in enumerate(read_file(fp), 1):
            if re.search(r"\b(TODO|FIXME|HACK|TEMP|XXX)\b", line, re.IGNORECASE):
                rel = os.path.relpath(fp, PROJECT_ROOT)
                todos.append(f"{rel}:{i}  {line.strip()[:100]}")
    if todos:
        rep.warning("Unresolved TODO/FIXME", f"{len(todos)} comment(s) need attention",
                    severity="low", category="code_quality",
                    details="\n".join(todos[:20]))
    else:
        rep.passed("No TODO/FIXME comments", category="code_quality")

    # ── Large files (>400 lines) ──────────────────────────────────────────────
    large = []
    for fp in js_files:
        lines = read_file(fp)
        if len(lines) > 400:
            rel = os.path.relpath(fp, PROJECT_ROOT)
            large.append(f"{rel}  ({len(lines)} lines)")
    if large:
        rep.warning("Large files (>400 lines)", f"{len(large)} file(s) may need splitting",
                    severity="low", category="code_quality",
                    details="\n".join(large))
    else:
        rep.passed("No oversized files", "All source files under 400 lines", category="code_quality")

    # ── Hardcoded localhost URLs ──────────────────────────────────────────────
    localhost_hits = []
    for fp in js_files:
        for i, line in enumerate(read_file(fp), 1):
            if re.search(r"localhost:\d{4}", line) and ".env" not in fp and "setupProxy" not in fp:
                rel = os.path.relpath(fp, PROJECT_ROOT)
                localhost_hits.append(f"{rel}:{i}")
    if localhost_hits:
        rep.warning("Hardcoded localhost URLs", f"{len(localhost_hits)} occurrence(s) — use env variables",
                    severity="medium", category="security",
                    details="\n".join(localhost_hits[:10]))
    else:
        rep.passed("No hardcoded localhost URLs", category="security")

    # ── Missing error handling (bare catch blocks) ────────────────────────────
    bare_catches = []
    for fp in all_files:
        for i, line in enumerate(read_file(fp), 1):
            if re.search(r"catch\s*\(\w*\)\s*\{\s*\}", line):
                rel = os.path.relpath(fp, PROJECT_ROOT)
                bare_catches.append(f"{rel}:{i}")
    if bare_catches:
        rep.warning("Empty catch blocks", f"{len(bare_catches)} silently swallowing errors",
                    severity="medium", category="code_quality",
                    details="\n".join(bare_catches[:15]))
    else:
        rep.passed("No empty catch blocks", category="code_quality")

    # ── Eval usage ────────────────────────────────────────────────────────────
    eval_hits = []
    for fp in js_files:
        for i, line in enumerate(read_file(fp), 1):
            if re.search(r"\beval\s*\(", line):
                rel = os.path.relpath(fp, PROJECT_ROOT)
                eval_hits.append(f"{rel}:{i}")
    if eval_hits:
        rep.failed("No eval() usage", f"{len(eval_hits)} eval() call(s) found — security risk",
                   severity="high", category="security",
                   details="\n".join(eval_hits))
    else:
        rep.passed("No eval() usage", category="security")

    # ── dangerouslySetInnerHTML ───────────────────────────────────────────────
    dsh_hits = []
    for fp in js_files:
        for i, line in enumerate(read_file(fp), 1):
            if "dangerouslySetInnerHTML" in line:
                rel = os.path.relpath(fp, PROJECT_ROOT)
                dsh_hits.append(f"{rel}:{i}")
    if dsh_hits:
        rep.warning("dangerouslySetInnerHTML usage", f"{len(dsh_hits)} instance(s) — ensure content is sanitized",
                    severity="medium", category="security",
                    details="\n".join(dsh_hits))
    else:
        rep.passed("No unsafe dangerouslySetInnerHTML", category="security")

    # ── File count summary ────────────────────────────────────────────────────
    rep.passed("Code scan complete",
               f"Scanned {len(js_files)} frontend + {len(srv_files)} backend files",
               category="summary", severity="info")

    rep.summary()
