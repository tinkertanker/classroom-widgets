#!/bin/bash

# Install dependencies if needed
if [ ! -d "src/student/node_modules" ]; then
    echo "Installing student app dependencies..."
    cd src/student && npm install && cd ../..
fi

# Setup shared symlinks
cd src/student && ./setup-dev.sh && cd ../..

# Start the Express server in one terminal
echo "Starting Express server..."
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the Vite dev server
echo "Starting Vite dev server..."
echo "Access the student app at: http://localhost:3002/student"
cd src/student && npm run dev

# Kill the server when Vite exits
kill $SERVER_PID