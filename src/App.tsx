import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { SpotlightCaptureView } from './components/capture/SpotlightCaptureView';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export function App() {
  const isSpotlightWindow = new URLSearchParams(window.location.search).get('window') === 'spotlight';

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      {isSpotlightWindow ? <SpotlightCaptureView /> : <AppLayout />}
    </ErrorBoundary>
  );
}

export default App;

