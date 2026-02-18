import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useWidgetSettings } from './useWidgetSettings';
import { ModalProvider } from '@/contexts/ModalContext';

// Mock settings component
interface TestSettings {
  value: string;
  enabled: boolean;
}

const TestSettingsComponent: React.FC<{
  state: TestSettings;
  onUpdate: (updates: Partial<TestSettings>) => void;
  onClose: () => void;
}> = ({ state, onUpdate, onClose }) => {
  return (
    <div>
      <h2>Test Settings</h2>
      <input
        type="text"
        value={state.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Test input"
      />
      <label>
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(e) => onUpdate({ enabled: e.target.checked })}
        />
        Enable feature
      </label>
      <button onClick={onClose}>Close</button>
    </div>
  );
};

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const { state, openSettings, updateState } = useWidgetSettings<TestSettings>(
    TestSettingsComponent,
    {
      title: 'Test Settings',
      initialState: { value: 'initial', enabled: false }
    }
  );

  return (
    <div>
      <div data-testid="state-value">{state.value}</div>
      <div data-testid="state-enabled">{state.enabled ? 'true' : 'false'}</div>
      <button onClick={openSettings}>Open Settings</button>
      <button onClick={() => updateState({ value: 'updated' })}>Update Value</button>
    </div>
  );
};

// Wrapper with ModalProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ModalProvider>{children}</ModalProvider>
);

describe('useWidgetSettings', () => {
  test('provides initial state', () => {
    render(<TestComponent />, { wrapper });
    
    expect(screen.getByTestId('state-value')).toHaveTextContent('initial');
    expect(screen.getByTestId('state-enabled')).toHaveTextContent('false');
  });

  test('opens settings modal when openSettings is called', () => {
    render(<TestComponent />, { wrapper });
    
    // Settings should not be visible initially
    expect(screen.queryByText('Test Settings')).not.toBeInTheDocument();
    
    // Open settings
    fireEvent.click(screen.getByText('Open Settings'));
    
    // Settings should now be visible
    expect(screen.getByText('Test Settings')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
  });

  test('updates state when updateState is called', () => {
    render(<TestComponent />, { wrapper });
    
    expect(screen.getByTestId('state-value')).toHaveTextContent('initial');
    
    // Update the value
    fireEvent.click(screen.getByText('Update Value'));
    
    expect(screen.getByTestId('state-value')).toHaveTextContent('updated');
  });

  test('updates state from within settings', () => {
    render(<TestComponent />, { wrapper });
    
    // Open settings
    fireEvent.click(screen.getByText('Open Settings'));
    
    // Change the input value
    const input = screen.getByPlaceholderText('Test input');
    fireEvent.change(input, { target: { value: 'new value' } });
    
    // Close settings
    fireEvent.click(screen.getByText('Close'));
    
    // State should be updated
    expect(screen.getByTestId('state-value')).toHaveTextContent('new value');
  });

  test('closes settings when close button is clicked', () => {
    render(<TestComponent />, { wrapper });
    
    // Open settings
    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByText('Test Settings')).toBeInTheDocument();
    
    // Close settings
    fireEvent.click(screen.getByText('Close'));
    
    // Settings should no longer be visible
    expect(screen.queryByText('Test Settings')).not.toBeInTheDocument();
  });

  test('notifies parent of state changes', () => {
    const onStateChange = jest.fn();
    
    const TestComponentWithCallback: React.FC = () => {
      const { updateState } = useWidgetSettings<TestSettings>(
        TestSettingsComponent,
        {
          title: 'Test Settings',
          initialState: { value: 'initial', enabled: false },
          onStateChange
        }
      );
      
      return <button onClick={() => updateState({ value: 'changed' })}>Change</button>;
    };
    
    render(<TestComponentWithCallback />, { wrapper });
    
    // Clear initial call
    onStateChange.mockClear();
    
    // Update state
    fireEvent.click(screen.getByText('Change'));
    
    // Callback should be called with new state
    expect(onStateChange).toHaveBeenCalledWith({
      value: 'changed',
      enabled: false
    });
  });

});