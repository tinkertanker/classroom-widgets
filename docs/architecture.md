# System Architecture

This document outlines the architecture of the classroom-widgets application.

## Overview

The system is a monolithic repository (monorepo) containing a frontend application, a backend server, and a separate student-facing application. The architecture is designed to support real-time, interactive widgets for a classroom environment.

## Main Components

### 1. Frontend Application

*   **Location:** `src/`
*   **Framework:** React (with TypeScript)
*   **Build Tool:** Vite.js
*   **Styling:** Tailwind CSS
*   **Description:** This is the main application for teachers or presenters. It provides the interface for creating, managing, and displaying widgets. The application is structured with a component-based architecture, including features, services, a global state store, and various utility functions.

### 2. Backend Server

*   **Location:** `server/`
*   **Framework:** Node.js with Express.js
*   **Description:** The backend server handles API requests, manages user sessions, and facilitates real-time communication using WebSockets. It has its own `package.json` for managing dependencies.

### 3. Real-time Communication

*   **Technology:** Socket.IO
*   **Description:** Real-time communication between the frontend and backend is handled via WebSockets, using the Socket.IO library. This enables instantaneous updates for interactive widgets like polls, Q&A sessions, and real-time feedback. The relevant files are in `server/src/sockets`.

### 4. Student-Facing Application

*   **Location:** `server/src/student/`
*   **Framework:** React (with TypeScript)
*   **Build Tool:** Vite.js
*   **Description:** This is a separate, lightweight application designed for students. It allows them to interact with the widgets presented by the teacher. This application is served by the backend server.

### 5. Deployment

*   **Technology:** Docker
*   **Description:** The application is containerized using Docker for consistent and reliable deployment. The repository includes `Dockerfile` and `docker-compose.yml` files for building and running the application in different environments.
*   **Web Server:** NGINX is used as a reverse proxy and for serving the static frontend files in a production environment.

## Directory Structure

*   `docs/`: Contains documentation for the project.
*   `public/`: Public assets for the main frontend application.
*   `server/`: The Node.js backend server.
*   `src/`: The main React frontend application.
*   `scripts/`: Utility scripts for the project.
