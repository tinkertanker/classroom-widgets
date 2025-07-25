import React, { Component, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { ActivityType, SocketEventMap } from '../../types/socket.types';
import { ActivityState } from '../../types/activity.types';
import { EmptyState, LoadingState, ErrorBoundary } from '../common';
import { SocketService } from '../../services/SocketService';

export interface BaseActivityProps {
  socket: Socket;
  sessionCode: string;
  studentName: string;
  widgetId?: string;
  isSession?: boolean;
  initialData?: unknown;
}

export interface BaseActivityState extends ActivityState {
  data: any;
}

export abstract class BaseActivity<
  P extends BaseActivityProps = BaseActivityProps,
  S extends BaseActivityState = BaseActivityState
> extends Component<P, S> {
  protected socketService: SocketService;
  
  constructor(props: P) {
    super(props);
    
    // Create typed socket service wrapper
    this.socketService = new SocketService();
    this.socketService['socket'] = props.socket;
    
    // Set initial state
    this.state = {
      isActive: this.getInitialActiveState(),
      isConnected: true,
      error: null,
      isLoading: false,
      data: this.getInitialData()
    } as S;
  }
  
  // Abstract methods that must be implemented by activities
  abstract getActivityType(): ActivityType;
  abstract renderActivityContent(): ReactNode;
  
  // Optional methods that can be overridden
  protected getInitialActiveState(): boolean {
    return true;
  }
  
  protected getInitialData(): any {
    return this.props.initialData || {};
  }
  
  protected getEmptyStateProps() {
    return {
      title: 'Activity Paused',
      description: 'Waiting for teacher to start the activity...'
    };
  }
  
  protected getLoadingMessage(): string {
    return 'Loading activity...';
  }
  
  // Lifecycle methods
  componentDidMount() {
    this.joinRoom();
    this.setupCommonListeners();
    this.setupActivityListeners();
    this.requestInitialState();
  }
  
  componentWillUnmount() {
    this.leaveRoom();
    this.cleanupListeners();
  }
  
  // Room management
  private joinRoom() {
    const { isSession, sessionCode, widgetId } = this.props;
    const activityType = this.getActivityType();
    
    if (isSession && widgetId) {
      this.socketService.emit('session:joinRoom', {
        sessionCode,
        roomType: activityType,
        widgetId
      });
    }
  }
  
  private leaveRoom() {
    const { isSession, sessionCode, widgetId } = this.props;
    const activityType = this.getActivityType();
    
    if (isSession && widgetId) {
      this.socketService.emit('session:leaveRoom', {
        sessionCode,
        roomType: activityType,
        widgetId
      });
    }
  }
  
  // Common socket event listeners
  private setupCommonListeners() {
    const activityType = this.getActivityType();
    
    // Listen for state changes
    this.socketService.on(`${activityType}:stateChanged` as keyof SocketEventMap, (data: any) => {
      if (this.isRelevantEvent(data)) {
        this.setState({ isActive: data.isActive });
        this.onActivityStateChanged(data.isActive);
      }
    });
    
    // Listen for room closed
    this.socketService.on(`${activityType}:roomClosed` as keyof SocketEventMap, (data: any) => {
      if (this.isRelevantEvent(data)) {
        this.setState({ isActive: false });
        this.onRoomClosed();
      }
    });
  }
  
  // Check if event is for this widget instance
  protected isRelevantEvent(data: any): boolean {
    const { widgetId } = this.props;
    return !widgetId || data.widgetId === widgetId || !data.widgetId;
  }
  
  // Request initial state
  protected requestInitialState() {
    const { sessionCode, widgetId } = this.props;
    const activityType = this.getActivityType();
    
    // Default implementation - override if needed
    this.socketService.emit(`${activityType}:requestState` as keyof SocketEventMap, {
      code: sessionCode,
      widgetId
    } as any);
  }
  
  // Methods to be implemented/overridden by specific activities
  protected abstract setupActivityListeners(): void;
  protected abstract cleanupListeners(): void;
  
  // Optional lifecycle hooks
  protected onActivityStateChanged(isActive: boolean): void {
    // Override in specific activities if needed
  }
  
  protected onRoomClosed(): void {
    // Override in specific activities if needed
  }
  
  // Helper methods for activities
  protected setActivityData(data: Partial<S['data']>) {
    this.setState(prevState => ({
      ...prevState,
      data: { ...prevState.data, ...data }
    }));
  }
  
  protected setError(error: string | null) {
    this.setState({ error } as Partial<S>);
  }
  
  protected setLoading(isLoading: boolean) {
    this.setState({ isLoading } as Partial<S>);
  }
  
  // Render methods
  render() {
    const { isActive, isLoading, error } = this.state;
    
    return (
      <ErrorBoundary>
        {error ? (
          <div className="text-center py-4">
            <p className="text-dusty-rose-600 dark:text-dusty-rose-400">{error}</p>
          </div>
        ) : isLoading ? (
          <LoadingState message={this.getLoadingMessage()} />
        ) : !isActive ? (
          <EmptyState {...this.getEmptyStateProps()} />
        ) : (
          this.renderActivityContent()
        )}
      </ErrorBoundary>
    );
  }
}