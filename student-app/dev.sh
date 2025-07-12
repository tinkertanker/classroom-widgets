#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing student app dependencies..."
    npm install
fi

# Start the Express server in one terminal
echo "Starting Express server..."
cd ../server && npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the Vite dev server
echo "Starting Vite dev server..."
echo "Access the student app at: http://localhost:3002/student"
npm run dev

# Kill the server when Vite exits
kill $SERVER_PID