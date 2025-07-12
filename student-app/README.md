# Student Interface React App

This is the student-facing React application for the classroom widgets system.

## Development

1. Install dependencies:
```bash
npm install
```

2. Run both the Express server and Vite dev server:
```bash
./dev.sh
```

Or run them separately:
- Terminal 1: `cd ../server && npm start` (Express server on port 3001)
- Terminal 2: `npm run dev` (Vite dev server on port 3002)

3. Access the app at: `http://localhost:3002/student`

## Production Build

1. Build the React app:
```bash
npm run build
```

This creates optimized production files in `../server/public/`

2. The Express server will automatically serve the built files when `NODE_ENV=production`

## Features

- **Modern React**: Uses React 18 with TypeScript
- **Fast Development**: Vite for instant HMR
- **Component-based**: Separate components for Poll and Data Share activities
- **Real-time**: Socket.io integration for live updates
- **Responsive**: Works on all devices

## Architecture

- `JoinForm`: Initial room entry component
- `PollActivity`: Handles poll participation and voting
- `DataShareActivity`: Handles link sharing functionality
- Automatic room type detection based on room code