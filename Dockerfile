FROM node:24.21.0-alpine AS build

# ponytail: Cypress só roda no e2e, não baixa o binário (~500 MB) no build
ENV CYPRESS_INSTALL_BINARY=0

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

FROM nginx:1.30-alpine

ENV API_URL=http://api:8000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
