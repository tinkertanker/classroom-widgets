#!/bin/bash

# Staging Docker Testing Script
# This script helps you test the staging build locally with Docker

echo "🐳 Classroom Widgets - Staging Environment"
echo "============================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo "📝 Creating .env.staging from .env.staging.example..."
    cp .env.staging.example .env.staging
    
    echo "✅ Created .env.staging with staging URLs"
    echo "⚠️  Please edit .env.staging to add any API keys if needed"
fi

# Build and run with staging compose file
echo "\n🔨 Building Docker images for staging..."
docker compose -f docker-compose.staging.yml build

echo "\n🚀 Starting staging services..."
docker compose -f docker-compose.staging.yml up -d

echo "\n⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker compose -f docker-compose.staging.yml ps | grep -q "Up"; then
    echo "\n✅ Staging environment is running!"
    echo "\n🎭 STAGING ENVIRONMENT:"
    echo "   Teacher App: http://localhost:3000"
    echo "   Student App: http://localhost:3000/student"
    echo "   Backend API: http://localhost:3001"
    echo "\n📋 Useful commands:"
    echo "   View logs:    docker compose -f docker-compose.staging.yml logs -f"
    echo "   Stop:         docker compose -f docker-compose.staging.yml down"
    echo "   Rebuild:      docker compose -f docker-compose.staging.yml up --build"
    echo "\n🔍 This is a STAGING environment - perfect for testing before production!"
else
    echo "\n❌ Failed to start staging services. Check logs with: docker compose -f docker-compose.staging.yml logs"
    exit 1
fi