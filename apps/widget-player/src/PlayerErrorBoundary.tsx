import { Component, type ErrorInfo, type ReactNode } from 'react';

import { postStudioBridgeMessage } from './bridge';
import { PlayerError } from './WidgetPlayer';

interface PlayerErrorBoundaryProps {
  children: ReactNode;
}

interface PlayerErrorBoundaryState {
  failed: boolean;
}

export class PlayerErrorBoundary extends Component<
  PlayerErrorBoundaryProps,
  PlayerErrorBoundaryState
> {
  state: PlayerErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PlayerErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    postStudioBridgeMessage({
      type: 'error',
      message: 'The widget player could not render this specification.',
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <PlayerError
          title="This widget could not be displayed"
          message="Ask the teacher to open it in Studio and publish it again."
        />
      );
    }
    return this.props.children;
  }
}
