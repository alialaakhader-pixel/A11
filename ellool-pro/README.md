# ELLOOL Pro (source workspace)

This folder contains a separate React + FastAPI implementation. It does not replace the currently deployed root-level app.

## Local development

Backend:
```bash
cd backend
python -m venv .venv
# activate the environment for your OS
pip install -r requirements.txt
cp .env.example .env
# Set APP_SECRET to a random value of at least 32 characters.
# Set BOOTSTRAP_ADMIN_PASSWORD to a unique long password.
uvicorn app.main:app --reload --port 8000
```

Frontend (second terminal):
```bash
cd frontend
npm install
npm run dev
```

## Important deployment limits

- The backend currently uses SQLite on local disk. This is suitable for local development only; serverless filesystems are not durable or shared between instances.
- The configured Ollama and OpenAI-compatible URLs default to loopback addresses. A cloud-hosted backend cannot reach a model running on the user's computer through 127.0.0.1.
- The Vite proxy only works during local development. Production needs a reachable backend URL and a matching API base/proxy configuration.
- Uploaded knowledge files and conversation records are local to the backend process and are not cloud-synced.
- Image generation, image editing, video editing, and seed-library loading are not included in this trimmed initial source scaffold yet.
- Do not deploy this backend to production until persistent storage, bootstrap-admin provisioning, request rate limits, CSRF strategy, upload scanning/quotas, and production CORS/cookie settings have been configured and tested.
- No secrets belong in Git. Copy .env.example to .env locally and never commit .env.

The root app and its existing Vercel deployment are intentionally left unchanged.
