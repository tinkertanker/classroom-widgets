# Environment Configuration

This project uses environment variables for sensitive configuration like API keys.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration values.

## Available Environment Variables

### Required for Link Shortener Widget
- `REACT_APP_SHORTIO_API_KEY` - Your Short.io API key
- `REACT_APP_SHORTIO_BASE_URL` - Short.io API base URL (default: https://api.short.io/links)

### Required for Poll Widget
- `REACT_APP_SERVER_URL` - Backend server URL (default: http://localhost:3001)

## Important Notes

- Never commit `.env` files containing real API keys
- Environment variables must start with `REACT_APP_` to be accessible in React
- Restart the development server after changing environment variables
- In production, set these variables in your hosting platform's environment configuration