FROM node:22-alpine AS builder

WORKDIR /workspace
COPY design-tokens ./design-tokens
COPY web/package.json ./web/package.json

WORKDIR /workspace/web
RUN npm install

COPY web .
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /workspace/web/.next/standalone ./
COPY --from=builder /workspace/web/.next/static ./.next/static
COPY --from=builder /workspace/web/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
