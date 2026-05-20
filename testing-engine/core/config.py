import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL     = os.getenv("SANGIAN_API_URL",    "http://localhost:5000/api")
ADMIN_EMAIL  = os.getenv("SANGIAN_ADMIN_EMAIL","admin@sangian.com")
ADMIN_PASS   = os.getenv("SANGIAN_ADMIN_PASS", "sangian123")
REPORT_URL   = os.getenv("SANGIAN_REPORT_URL", "http://localhost:5000/api/testing/ingest")
ENGINE_SECRET= os.getenv("TESTING_ENGINE_SECRET","sangian-test-engine-secret")
PROJECT_ROOT = os.getenv("SANGIAN_PROJECT_ROOT", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "sangian")
