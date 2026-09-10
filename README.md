Sweet Silvia is a Next.js storefront connected to the Sweet Silvia .NET API.

## Local setup

Copy `.env.local.example` to `.env.local` and configure:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_ENABLE_MOCKS=false
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_WHATSAPP_PHONE=51941872197
```

`NEXT_PUBLIC_ENABLE_MOCKS` must remain `false` for real backend checkout. Google requires the OAuth client ID configured for the frontend origin.

## Getting Started

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000). The API should be running at `NEXT_PUBLIC_API_URL` and its CORS allowlist must include the frontend origin.

## Verification

```bash
npm run lint
npm run build
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
