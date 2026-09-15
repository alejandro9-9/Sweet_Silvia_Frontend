FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_ENABLE_MOCKS=false
ARG VITE_IZIPAY_ENABLED=false
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_WHATSAPP_PHONE=51941872197

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ENABLE_MOCKS=${VITE_ENABLE_MOCKS}
ENV VITE_IZIPAY_ENABLED=${VITE_IZIPAY_ENABLED}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_WHATSAPP_PHONE=${VITE_WHATSAPP_PHONE}

RUN test -n "$VITE_API_URL" && npm run build

FROM nginx:1.29-alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
