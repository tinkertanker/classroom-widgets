#!/bin/bash

# Start the server in the background
echo "Starting server on port 3001..."
cd server && npm start &
SERVER_PID=$!

# Give server time to start
sleep 2

# Start the React app
echo "Starting React app on port 3000..."
cd . && npm start

# When React app is closed, kill the server
kill $SERVER_PID
echo "Server stopped."
