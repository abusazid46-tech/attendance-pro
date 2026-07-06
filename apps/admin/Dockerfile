FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/admin/package.json apps/admin/package.json
RUN npm install --workspace @attendance/admin

FROM deps AS build
COPY . .
RUN npm --workspace @attendance/admin run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/public ./apps/admin/public
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
EXPOSE 3000
CMD ["npm", "--workspace", "@attendance/admin", "run", "start"]
