FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm --workspace apps/api run prisma:generate
RUN npm --workspace apps/web run build
RUN npm --workspace apps/api run build
RUN mkdir -p apps/api/dist/public && cp -R apps/web/dist/. apps/api/dist/public/

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
EXPOSE 3000
CMD ["sh", "-c", "npm --workspace apps/api run prisma:migrate && if [ \"${SEED_DEMO_DATA:-false}\" = \"true\" ]; then npm --workspace apps/api run prisma:seed; fi && npm start"]
