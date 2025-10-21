import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@gov-design-system-ce/react/dist/index.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
