# Classroom Widgets Server

This server provides real-time communication support for interactive classroom widgets like polls, quizzes, and collaborative activities.

## Features

- WebSocket-based real-time communication
- Room-based sessions with unique 4-digit codes
- Automatic room cleanup after 12 hours
- Support for multiple widget types (currently: Poll)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

   The server will run on port 3001 by default.

## How It Works

### For Teachers (Widget Host)
1. Create a Poll widget in the classroom workspace
2. Click "Create Poll Room" to generate a unique 4-digit code
3. Share the code with students
4. Configure poll questions and options
5. Start/stop the poll as needed
6. View real-time results

### For Students
1. Visit `http://[server-ip]:3001` on any device
2. Enter the 4-digit room code
3. Optionally enter their name
4. Vote on poll questions
5. See results after voting

## API Endpoints

- `POST /api/rooms/create` - Create a new room
- `GET /api/rooms/:code/exists` - Check if a room exists
- `GET /api/health` - Server health check

## WebSocket Events

### Host Events
- `host:join` - Join room as host
- `poll:update` - Update poll question/options
- `poll:toggle` - Start/stop poll

### Participant Events
- `participant:join` - Join room as participant
- `vote:submit` - Submit a vote

### Broadcast Events
- `poll:updated` - Poll data changed
- `results:update` - New results available
- `participant:count` - Participant count changed

## Development

To run in development mode with auto-reload:
```bash
npm install -g nodemon
npm run dev
```

## Future Enhancements

- Support for more widget types (Quiz, Word Cloud, etc.)
- Persistent storage (database)
- Authentication for hosts
- Analytics and reporting
- Export results