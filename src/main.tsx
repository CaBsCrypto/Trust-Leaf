import { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import './index.css';

import PublicDemoApp from './PublicDemoApp';

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicDemoApp />
  </StrictMode>,
);
