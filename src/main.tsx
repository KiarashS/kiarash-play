import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UiProvider } from './state/ui';
import { CollectionsProvider } from './state/collections';
import './styles/glass.css';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <UiProvider>
      <CollectionsProvider>
        <App />
      </CollectionsProvider>
    </UiProvider>
  </StrictMode>,
);

// Offline support: the shell is precached, audio is cached the first time it plays.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // A failed registration is not worth interrupting playback over.
    });
  });
}
