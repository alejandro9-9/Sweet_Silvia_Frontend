Sweet Silvia is a React + Vite storefront connected to the Sweet Silvia .NET API.

## Local setup

Copy `.env.local.example` to `.env.local` and configure:

```env
VITE_API_URL=http://localhost:8080
VITE_ENABLE_MOCKS=false
VITE_IZIPAY_ENABLED=false
VITE_GOOGLE_CLIENT_ID=
VITE_WHATSAPP_PHONE=51941872197
```

`VITE_ENABLE_MOCKS` must remain `false` for real backend checkout. Google requires the OAuth client ID configured for the frontend origin. Variables exposed with `VITE_` are public browser configuration; never place backend secrets in this file.

## Getting Started

Run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API should be running at `VITE_API_URL` and its CORS allowlist must include the frontend origin.

## Verification

```bash
npm run lint
npm run build
npm run start
```

The application uses React Router for client-side navigation. When deploying as a static site, configure the host to return `index.html` for unknown routes so direct visits to paths such as `/products/:id` work correctly.

## AWS deployment

The repository includes a production `Dockerfile` and Nginx SPA configuration for Amazon ECS Express Mode. Build-time variables are:

```env
VITE_API_URL=https://your-public-api-domain.com
VITE_ENABLE_MOCKS=false
VITE_IZIPAY_ENABLED=false
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id
VITE_WHATSAPP_PHONE=51941872197
```

See `DEPLOYMENT.md` for the image build and ECS settings. Keep `VITE_IZIPAY_ENABLED=false` until the backend credentials, webhook and public terms URL pass the Izipay sandbox flow. Local development continues to use `.env.local` and is not affected by the container build arguments.
