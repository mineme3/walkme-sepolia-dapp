# WalkMe frontend

Next.js app for [WalkMe](../README.md) — wallet connection, dashboard, and the
`/api/attest` signing route.

```bash
npm install
cp .env.local.example .env.local   # then fill VERIFIER_PRIVATE_KEY
npm run dev                        # http://localhost:3000
```

Deployment instructions (Vercel, root directory = `web`) are in the
[root README](../README.md#deploy-the-frontend-to-vercel).
