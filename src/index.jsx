// src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// A importação DEVE ser "./contexts/SyncContext.jsx"
import { SyncProvider } from './contexts/SyncContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SyncProvider>
      <App />
    </SyncProvider>
  </React.StrictMode>
);