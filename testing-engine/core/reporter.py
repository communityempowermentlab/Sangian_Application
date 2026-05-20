import time, requests
from colorama import Fore, Style, init
from core.config import REPORT_URL, ENGINE_SECRET

init(autoreset=True)

STATUS_COLOR = {
    "passed":  Fore.GREEN,
    "failed":  Fore.RED,
    "warning": Fore.YELLOW,
    "skipped": Fore.CYAN,
    "error":   Fore.MAGENTA,
}

class Reporter:
    def __init__(self, suite: str, run_id: str = None, triggered_by: str = "python-engine"):
        self.suite       = suite
        self.run_id      = run_id
        self.triggered_by= triggered_by
        self.results     = []
        self._start      = time.time()

    def record(self, test_name: str, status: str, message: str = "",
               details: str = "", severity: str = "info",
               category: str = "", duration_ms: int = 0):
        color = STATUS_COLOR.get(status, Fore.WHITE)
        icon  = {"passed":"✅","failed":"❌","warning":"⚠️","skipped":"⏭","error":"💥"}.get(status,"•")
        print(f"  {color}{icon} [{status.upper():8}] {test_name}{Style.RESET_ALL}")
        if message:
            print(f"             {Fore.WHITE}{message}{Style.RESET_ALL}")
        self.results.append({
            "suite":       self.suite,
            "test_name":   test_name,
            "category":    category,
            "status":      status,
            "severity":    severity,
            "message":     message,
            "details":     details,
            "duration_ms": duration_ms,
        })

    def passed(self, name, msg="", **kw):   self.record(name, "passed",  msg, **kw)
    def failed(self, name, msg="", **kw):   self.record(name, "failed",  msg, severity=kw.pop("severity","high"),  **kw)
    def warning(self, name, msg="", **kw):  self.record(name, "warning", msg, severity=kw.pop("severity","medium"),**kw)
    def skipped(self, name, msg="", **kw):  self.record(name, "skipped", msg, **kw)
    def error(self, name, msg="", **kw):    self.record(name, "error",   msg, severity=kw.pop("severity","critical"),**kw)

    def summary(self):
        total    = len(self.results)
        passed   = sum(1 for r in self.results if r["status"] == "passed")
        failed   = sum(1 for r in self.results if r["status"] == "failed")
        warnings = sum(1 for r in self.results if r["status"] == "warning")
        errors   = sum(1 for r in self.results if r["status"] == "error")
        elapsed  = round((time.time() - self._start) * 1000)
        print(f"\n{'─'*60}")
        print(f"  Suite: {Fore.CYAN}{self.suite}{Style.RESET_ALL}  |  "
              f"Total: {total}  |  "
              f"{Fore.GREEN}✅ {passed}{Style.RESET_ALL}  "
              f"{Fore.RED}❌ {failed}{Style.RESET_ALL}  "
              f"{Fore.YELLOW}⚠️  {warnings}{Style.RESET_ALL}  "
              f"{Fore.MAGENTA}💥 {errors}{Style.RESET_ALL}  "
              f"({elapsed}ms)")
        print(f"{'─'*60}\n")
        return {"passed": passed, "failed": failed, "warnings": warnings}

    def push(self):
        """Send results to the Sangian admin API."""
        payload = {
            "run_id":       self.run_id,
            "suite":        self.suite,
            "triggered_by": self.triggered_by,
            "results":      self.results,
        }
        try:
            r = requests.post(
                REPORT_URL, json=payload,
                headers={"x-engine-secret": ENGINE_SECRET},
                timeout=15,
            )
            if r.status_code == 200:
                print(f"  {Fore.GREEN}📤 Results pushed to admin panel (run_id={r.json().get('run_id')}){Style.RESET_ALL}\n")
            else:
                print(f"  {Fore.RED}Push failed: {r.status_code} {r.text[:200]}{Style.RESET_ALL}\n")
        except Exception as e:
            print(f"  {Fore.RED}Could not reach admin API: {e}{Style.RESET_ALL}\n")
