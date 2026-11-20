# ELLOOL AI — Local-first creative AI studio

The complete browser application is in `frontend/index.html`. It keeps the working vault encrypted locally and now supports optional Supabase email accounts plus encrypted cloud backup/restore. The cloud backup stores the already-encrypted vault payload; the Supabase account password is separate from the vault passphrase.

## Deployment

A separate Vercel project is deployed from `ellool-pro/frontend`:

- Live: https://ellool-ai-studio.vercel.app
- Root Directory: `ellool-pro/frontend`
- Framework: Vite; Build command: `npm run build`; Output directory: `dist`

The existing root website and its original Vercel project were intentionally left unchanged. A `vercel.json` is included for the separate frontend project.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## What works in this version

- Encrypted local vault using PBKDF2 + AES-GCM, with a user-created password. The AES-GCM authentication tag verifies the passphrase; no fast SHA-256 password verifier is stored.
- Optional Supabase Auth account registration/login and encrypted vault backup/restore, with per-user RLS in the dedicated `ellool` schema.
- Cloud backup is manual on demand and automatically refreshed after local saves when a cloud session is active.
- Local chat using WebLLM in browsers that support WebGPU and have enough memory, or a user-configured OpenAI-compatible endpoint.
- SVG illustration generation, with optional Stable Diffusion WebUI integration for image generation and img2img.
- Local browser video filters/export and storyboard-style animated video output. This is **not** photorealistic text-to-video generation.
- User-approved API connector calls and local API-key management.
- Exportable code blocks, chat history, settings, and a lock timer.

## Important limitations

- Cloud backup is optional. On a new device, create a temporary local vault, sign in to the same cloud account in Settings, then restore the encrypted backup and unlock it using the original vault passphrase. Keep a separate export as a fallback.
- The local WebGPU model downloads to the device and needs a compatible browser and sufficient RAM/GPU. It may not work on every phone/tablet.
- A remote chat endpoint must be reachable over HTTPS and allow the browser's origin through CORS. Do not put production secrets into a public browser app.
- Stable Diffusion must be hosted separately and reachable by the browser; localhost only refers to the device running the browser.
- Video editing is browser-side WebM processing; it does not provide generative video AI or guaranteed audio preservation.
- No free unlimited cloud inference or photorealistic image/video generation is included. Those require a reachable model/service and may have limits or costs.
- The previous embedded legacy password (`ali2009`) was a public hard-coded bypass and has been removed. Older vaults are opened by verifying the password through AES-GCM decryption; the old quick SHA-256 verifier is removed when the vault is opened.

## Backend folder

`backend/` is an experimental API scaffold only. It is **not connected** to the static browser app and is not production-ready. It still uses local SQLite and needs persistent storage, hardened authentication, rate limiting, deployment configuration, and full tests before it should be deployed. Do not deploy it to Vercel serverless as-is.

## Supabase data isolation

The Supabase project contains other applications' existing `public` tables. ELLOOL's new tables are isolated under the `ellool` schema (`profiles`, `conversations`, `knowledge_documents`, `user_preferences`, `generated_assets`, and `vault_backups`). Row Level Security is enabled on all six tables; client access is restricted to the authenticated owner. The `ellool` schema was added to the PostgREST exposed schema list without modifying existing `public` tables or policies.