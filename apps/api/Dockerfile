FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm install --workspace @attendance/api

FROM deps AS build
COPY . .
RUN npm --workspace @attendance/api run db:generate
RUN npm --workspace @attendance/api run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
EXPOSE 4000
CMD ["node", "apps/api/dist/src/server.js"]
