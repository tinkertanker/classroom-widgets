#!/bin/bash

# Start the Express server in one terminal
echo "Starting Express server..."
cd .. && npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the Vite dev server
echo "Starting Vite dev server..."
npm run dev

# Kill the server when Vite exits
kill $SERVER_PID