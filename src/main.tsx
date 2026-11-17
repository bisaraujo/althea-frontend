import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './app';
import './styles.css';
// Camada visual atual: vem por ultimo para valer sobre as regras antigas.
import './styles/refresh.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
