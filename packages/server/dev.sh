#!/bin/bash

# Start the Express server in one terminal
echo "Starting Express server..."
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the Vite dev server for student app
echo "Starting Vite dev server..."
echo "Access the student app at: http://localhost:3002/student"
cd ../student && npm run dev

# Kill the server when Vite exits
kill $SERVER_PID
