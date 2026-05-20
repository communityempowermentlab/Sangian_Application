#!/usr/bin/env python3
"""
Sangian Automated Testing Engine
Usage:
  python run_tests.py                          # run all suites
  python run_tests.py --suite api              # run one suite
  python run_tests.py --suite api,security     # run multiple
  python run_tests.py --no-push                # don't push to admin panel
  python run_tests.py --run-id <uuid>          # use specific run ID
"""

import sys, argparse
sys.path.insert(0, __file__.rsplit("/", 1)[0])  # ensure local imports work

from colorama import Fore, Style, init
init(autoreset=True)

from core.reporter import Reporter
from core.config   import BASE_URL, REPORT_URL

SUITES = {
    "api":          ("suites.api_tests",         "🌐 API Tests"),
    "security":     ("suites.security_tests",     "🔒 Security Tests"),
    "db":           ("suites.db_tests",           "🗄️  Database Tests"),
    "code_quality": ("suites.code_quality",       "🧹 Code Quality"),
    "performance":  ("suites.performance_tests",  "⚡ Performance Tests"),
}

def banner():
    print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════╗
║        🧪 Sangian Automated Testing Engine           ║
║             Built for Sangian Platform               ║
╚══════════════════════════════════════════════════════╝{Style.RESET_ALL}
  API Base : {BASE_URL}
  Report   : {REPORT_URL}
""")

def main():
    parser = argparse.ArgumentParser(description="Sangian Test Engine")
    parser.add_argument("--suite", default="all", help="Suite(s) to run: api,security,db,code_quality,performance,all")
    parser.add_argument("--no-push", action="store_true", help="Don't push results to admin panel")
    parser.add_argument("--run-id", default=None, help="Specific run ID to use")
    args = parser.parse_args()

    banner()

    suites_to_run = list(SUITES.keys()) if args.suite == "all" else [s.strip() for s in args.suite.split(",")]
    invalid = [s for s in suites_to_run if s not in SUITES]
    if invalid:
        print(f"{Fore.RED}Unknown suite(s): {', '.join(invalid)}")
        print(f"Available: {', '.join(SUITES.keys())}{Style.RESET_ALL}")
        sys.exit(1)

    all_results = []
    total_passed = total_failed = total_warnings = 0

    for suite_key in suites_to_run:
        module_path, label = SUITES[suite_key]
        print(f"{Fore.CYAN}{'═'*60}")
        print(f"  {label}")
        print(f"{'═'*60}{Style.RESET_ALL}")

        rep = Reporter(suite=suite_key, run_id=args.run_id)
        try:
            import importlib
            module = importlib.import_module(module_path)
            module.run(rep)
        except Exception as e:
            rep.error(f"{suite_key} suite crashed", str(e), severity="critical")

        stats = rep.summary()
        total_passed   += stats["passed"]
        total_failed   += stats["failed"]
        total_warnings += stats["warnings"]
        all_results.extend(rep.results)

        if not args.no_push:
            rep.push()

    # ── Grand total ────────────────────────────────────────────────────────────
    total = len(all_results)
    print(f"\n{Fore.CYAN}{'═'*60}")
    print(f"  🏁 ALL SUITES COMPLETE")
    print(f"{'═'*60}{Style.RESET_ALL}")
    print(f"  Total  : {total}")
    print(f"  {Fore.GREEN}Passed : {total_passed}{Style.RESET_ALL}")
    print(f"  {Fore.RED}Failed : {total_failed}{Style.RESET_ALL}")
    print(f"  {Fore.YELLOW}Warnings: {total_warnings}{Style.RESET_ALL}\n")

    if total_failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
