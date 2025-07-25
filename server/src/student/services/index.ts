// Export all services
export * from './SocketService';
export * from './SessionService';
export * from './ErrorService';

// Initialize services
import { getSocketService } from './SocketService';
import { getSessionService } from './SessionService';
import { errorService } from './ErrorService';

// Create singleton instances
export const socketService = getSocketService();
export const sessionService = getSessionService(socketService);

// Export error service singleton
export { errorService };