# Frontend Dockerfile
FROM node:22-alpine AS build

# Build arguments for environment variables
ARG VITE_SERVER_URL=http://localhost:3001
ARG VITE_LINK_SHORTENER_ENABLED=false

# Install build dependencies for canvas and other native modules
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    python3 \
    make \
    g++

# Install the pinned pnpm from the npm registry (registry-verified; avoids
# relying on whatever corepack version ships in the base image).
RUN npm install -g pnpm@11.22.0

# Set working directory
WORKDIR /app

# Copy workspace root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy every workspace package.json so pnpm can resolve the workspace graph
# and validate the frozen lockfile
COPY packages/shared/package.json packages/shared/
COPY packages/teacher/package.json packages/teacher/
COPY packages/student/package.json packages/student/
COPY packages/server/package.json packages/server/

# Install only the teacher package graph (its workspace deps included).
# All four manifests are still copied above so pnpm can validate the lockfile.
RUN pnpm install --frozen-lockfile --filter "@classroom-widgets/teacher..."

# Copy shared package source
COPY packages/shared/ packages/shared/

# Copy teacher package source
COPY packages/teacher/ packages/teacher/

# Copy voice command generation files
COPY scripts/ scripts/

# Set environment variables for build
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_LINK_SHORTENER_ENABLED=$VITE_LINK_SHORTENER_ENABLED

# Build the app
RUN pnpm --filter @classroom-widgets/teacher build

# Production stage
FROM nginx:alpine

# Copy custom nginx config if needed
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/packages/teacher/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
