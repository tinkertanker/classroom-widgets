#!/bin/bash

# Local Docker Testing Script
# This script helps you quickly test the production build locally

echo "🐳 Classroom Widgets - Local Docker Testing"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from .env.example..."
    cp .env.example .env.production
    
    # Update URLs for local testing
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's|VITE_SERVER_URL=.*|VITE_SERVER_URL=http://localhost:3001|' .env.production
        sed -i '' 's|CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:3000,http://localhost|' .env.production
    else
        # Linux
        sed -i 's|VITE_SERVER_URL=.*|VITE_SERVER_URL=http://localhost:3001|' .env.production
        sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:3000,http://localhost|' .env.production
    fi
    
    echo "✅ Created .env.production with local URLs"
fi

# Build and run
echo "\n🔨 Building Docker images..."
docker-compose build

echo "\n🚀 Starting services..."
docker-compose up -d

echo "\n⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "\n✅ Services are running!"
    echo "\n📱 Access the application at:"
    echo "   Teacher App: http://localhost:3000"
    echo "   Student App: http://localhost:3000/student"
    echo "   Backend API: http://localhost:3001"
    echo "\n📋 Useful commands:"
    echo "   View logs:    docker-compose logs -f"
    echo "   Stop:         docker-compose down"
    echo "   Rebuild:      docker-compose up --build"
else
    echo "\n❌ Failed to start services. Check logs with: docker-compose logs"
    exit 1
fi