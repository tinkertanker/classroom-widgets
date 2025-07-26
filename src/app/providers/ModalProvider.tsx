import React, { ReactNode } from 'react';
import { ModalProvider as BaseModalProvider } from '../../contexts/ModalContext';

interface AppModalProviderProps {
  children: ReactNode;
}

export const AppModalProvider: React.FC<AppModalProviderProps> = ({ children }) => {
  return <BaseModalProvider>{children}</BaseModalProvider>;
};