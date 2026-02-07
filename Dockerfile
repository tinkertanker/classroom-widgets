# Frontend Dockerfile
FROM node:20-alpine as build

# Build arguments for environment variables
ARG VITE_SERVER_URL=http://localhost:3001

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

# Set working directory
WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./

# Copy workspace package.json files for install
COPY packages/shared/package.json packages/shared/
COPY packages/teacher/package.json packages/teacher/

# Install all dependencies (including dev dependencies for build)
RUN npm ci --legacy-peer-deps

# Copy shared package source
COPY packages/shared/ packages/shared/

# Copy teacher package source
COPY packages/teacher/ packages/teacher/

# Copy voice command generation files
COPY shared/ shared/
COPY scripts/ scripts/

# Set environment variables for build
ENV VITE_SERVER_URL=$VITE_SERVER_URL

# Build the app
RUN npm run build -w @classroom-widgets/teacher

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
