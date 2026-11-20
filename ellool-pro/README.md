# ELLOOL AI — Local-first creative AI studio

The complete browser application is in `frontend/index.html`. It is a local-first app: its encrypted vault, conversations, connector credentials, and settings stay in the current browser profile. It is not a multi-user account service and does not sync data between devices.

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

- Encrypted local vault using PBKDF2 + AES-GCM, with a user-created password.
- Local chat using WebLLM in browsers that support WebGPU and have enough memory, or a user-configured OpenAI-compatible endpoint.
- SVG illustration generation, with optional Stable Diffusion WebUI integration for image generation and img2img.
- Local browser video filters/export and storyboard-style animated video output. This is **not** photorealistic text-to-video generation.
- User-approved API connector calls and local API-key management.
- Exportable code blocks, chat history, settings, and a lock timer.

## Important limitations

- The app is local-first: each browser/device has its own encrypted data. Clearing browser data can remove the vault; export important content regularly.
- The local WebGPU model downloads to the device and needs a compatible browser and sufficient RAM/GPU. It may not work on every phone/tablet.
- A remote chat endpoint must be reachable over HTTPS and allow the browser's origin through CORS. Do not put production secrets into a public browser app.
- Stable Diffusion must be hosted separately and reachable by the browser; localhost only refers to the device running the browser.
- Video editing is browser-side WebM processing; it does not provide generative video AI or guaranteed audio preservation.
- No free unlimited cloud inference or photorealistic image/video generation is included. Those require a reachable model/service and may have limits or costs.
- The previous embedded legacy password (`ali2009`) was a public hard-coded bypass and has been removed. Existing old vaults that lack a per-vault verifier cannot be opened by this secure version. Export anything important from the old local copy before switching.

## Backend folder

`backend/` is an experimental API scaffold only. It is **not connected** to the static browser app and is not production-ready. It still uses local SQLite and needs persistent storage, hardened authentication, rate limiting, deployment configuration, and full tests before it should be deployed. Do not deploy it to Vercel serverless as-is.