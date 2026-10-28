import React from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { NotificationProvider } from './notifications/NotificationContext';
import { AppShell } from './components/AppShell';

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppShell />
      </NotificationProvider>
    </ThemeProvider>
  );
}
