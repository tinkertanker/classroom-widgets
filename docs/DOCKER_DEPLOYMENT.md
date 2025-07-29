# Docker Deployment Guide

This guide covers deploying the Classroom Widgets application using Docker and Docker Compose.

## Overview

The application is deployed as two services:
- **`frontend`**: The Teacher App (React + Vite) served by Nginx.
- **`backend`**: The Express server, which handles the API, WebSocket connections, and serves the Student App.

This architecture simplifies deployment by using a single backend for both API and Student App hosting, which avoids CORS issues and streamlines SSL configuration.

## Prerequisites

- Docker and Docker Compose installed on your server.
- A domain or subdomain pointed at your server's IP address.
- An optional reverse proxy (like Nginx or Caddy) to handle SSL termination.

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/classroom-widgets.git
cd classroom-widgets
```

### 2. Configure Environment Variables

Create production environment files from the examples:

```bash
# For the frontend (Teacher App)
cp .env.production.example .env.production

# For the backend server
cp server/.env.production.example server/.env.production
```

**Edit `.env.production`:**

Set the URL for your backend server. This is passed to the Teacher App at build time.

```env
# The public URL of your backend server
VITE_SERVER_URL=https://your-backend-domain.com
```

**Edit `server/.env.production`:**

Configure the backend server settings.

```env
# The port the backend server will run on inside the container
PORT=3001

# A comma-separated list of allowed origins for CORS
CORS_ORIGINS=https://your-frontend-domain.com
```

### 3. Build and Deploy with Docker Compose

Use the production Docker Compose file to build and start the services in detached mode:

```bash
# Build and start the containers
docker-compose -f docker-compose.prod.yml up -d --build
```

This command builds the Docker images for the `frontend` and `backend` services and starts them as defined in `docker-compose.prod.yml`.

### 4. Verify the Deployment

Check that the containers are running:

```bash
docker-compose -f docker-compose.prod.yml ps
```

You should see both the `frontend` and `backend` services with a status of `Up`.

## SSL/TLS Configuration (Recommended)

It is highly recommended to use a reverse proxy on your host machine to handle SSL/TLS termination. This keeps your SSL certificates on the host and simplifies the container setup.

Here is an example of how to configure Nginx as a reverse proxy:

1.  **Install Nginx and Certbot** on your host machine.
2.  **Configure Nginx** to proxy requests to your Docker containers.
3.  **Obtain SSL certificates** from Let's Encrypt using Certbot.

**Example Nginx configuration for the frontend:**

```nginx
server {
    server_name your-frontend-domain.com;

    location / {
        proxy_pass http://localhost:8080; # Assuming you map the container's port 80 to 8080
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/your-frontend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-frontend-domain.com/privkey.pem;
}
```

**Example Nginx configuration for the backend:**

```nginx
server {
    server_name your-backend-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/your-backend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-backend-domain.com/privkey.pem;
}
```

## Managing the Deployment

### View Logs

To view the logs for all services:

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

To view the logs for a specific service:

```bash
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Stop the Services

To stop the running services:

```bash
docker-compose -f docker-compose.prod.yml down
```

### Update the Deployment

To update the deployment with the latest code:

1.  **Pull the latest changes** from your Git repository:
    ```bash
    git pull
    ```
2.  **Rebuild and restart** the services:
    ```bash
    docker-compose -f docker-compose.prod.yml up -d --build
    ```

## Troubleshooting

-   **Container fails to start**: Check the logs for a specific service to identify the error.
-   **Permission issues**: Ensure that the user running the Docker commands has the necessary permissions to access the project files.
-   **Network conflicts**: If the default ports (e.g., 80, 3001) are already in use, you can change them in the `docker-compose.prod.yml` file.
