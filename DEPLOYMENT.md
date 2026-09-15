# Sweet Silvia frontend on Amazon ECS Express Mode

The repository-root `Dockerfile` builds the Vite application and serves it with Nginx. Local development continues to use `npm run dev` and `.env.local`.

## Build the image

Vite variables are public and are embedded at image build time. Never pass backend secrets as build arguments.

```bash
docker build \
  --build-arg VITE_API_URL=https://api.sweetsilviastore.com \
  --build-arg VITE_ENABLE_MOCKS=false \
  --build-arg VITE_IZIPAY_ENABLED=false \
  --build-arg VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID \
  --build-arg VITE_WHATSAPP_PHONE=51941872197 \
  -t sweet-silvia-frontend .
```

Push the image to a private Amazon ECR repository. Rebuild it whenever one of the `VITE_` values changes.

## ECS Express Mode settings

- Image: the frontend image URI in ECR.
- Container port: `80`.
- Health check path: `/healthz`.
- Desired minimum tasks: `1`.
- Application URL: use the generated HTTPS URL for the first smoke test.
- Custom domain: `sweetsilviastore.com` and optionally `www.sweetsilviastore.com`.

The Nginx configuration returns `index.html` for unknown application routes, so direct visits to `/products/:id`, `/cart` and the legal pages work correctly.

After assigning the final frontend domain, add it to the backend CORS allowlist and to the authorized Google OAuth JavaScript origins.
