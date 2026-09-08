import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { SpotlightCaptureView } from './components/capture/SpotlightCaptureView';

export function App() {
  const isSpotlightWindow = new URLSearchParams(window.location.search).get('window') === 'spotlight';

  if (isSpotlightWindow) {
    return <SpotlightCaptureView />;
  }

  return <AppLayout />;
}

export default App;
