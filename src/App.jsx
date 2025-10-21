// src/App.jsx (VERSÃO COM INTERVALOS DE SYNC DE 1 MINUTO)

import React, { useEffect, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { SyncContext } from './contexts/SyncContext.jsx';
import { retryPendingUploads } from './services/syncService'; // Importa apenas upload

// Importando suas páginas
import OperatorScreen from './pages/OperatorScreen.jsx';
import SetupPage from './pages/SetupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FinancialSelectionPage from './pages/FinancialSelectionPage.jsx';
import WaiterClosing10Page from './pages/WaiterClosing10Page.jsx';
import MobileCashierClosingPage from './pages/MobileCashierClosingPage.jsx';
import FixedCashierClosingPage from './pages/FixedCashierClosingPage.jsx';
import ClosingHistoryPage from './pages/ClosingHistoryPage.jsx';
import ExportDataPage from './pages/ExportDataPage.jsx';
import LocalConfirmationPage from './pages/LocalConfirmationPage.jsx';
import DataUpdatePage from './pages/DataUpdatePage.jsx';
import WaiterClosingPage from './pages/WaiterClosingPage.jsx';
import CloudSyncPage from './pages/CloudSyncPage.jsx';
import AdminPage from './pages/AdminPage';


// Componentes ProtectedRoute e EventSelectedRoute (sem alterações)
const ProtectedRoute = () => {
  const operatorName = localStorage.getItem('loggedInUserName');
  if (!operatorName) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
const EventSelectedRoute = () => {
  const activeEvent = localStorage.getItem('activeEvent');
  if (!activeEvent) {
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
};


export default function App() {
  const { triggerDownloadSync } = useContext(SyncContext);

  useEffect(() => {
    // --- TEMPOS AJUSTADOS PARA 1 MINUTO (60.000 ms) ---
    const ONE_MINUTE_MS = 60000; 

    // --- Bloco de Download ---
    const initialSyncTimeout = setTimeout(() => {
      console.log("[App.jsx] Disparando download inicial de dados mestre (após 1 min)...");
      if (triggerDownloadSync) triggerDownloadSync(); 
    }, ONE_MINUTE_MS); // Primeira execução após 1 minuto

    const downloadIntervalId = setInterval(() => {
      console.log("[App.jsx] Disparando download periódico de dados mestre (a cada 1 min)...");
      if (triggerDownloadSync) triggerDownloadSync(); 
    }, ONE_MINUTE_MS); // Repete a cada 1 minuto

    // --- Bloco de Upload ---
    const initialUploadTimeout = setTimeout(() => {
        console.log("[App.jsx] Iniciando verificador inicial de uploads pendentes (após 1 min)...");
        retryPendingUploads();
    }, ONE_MINUTE_MS); // Primeira execução após 1 minuto

    const uploadIntervalId = setInterval(() => {
        console.log("[App.jsx] Iniciando verificador periódico de uploads pendentes (a cada 1 min)...");
        retryPendingUploads();
    }, ONE_MINUTE_MS); // Repete a cada 1 minuto

    // Limpa os timers ao desmontar
    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(downloadIntervalId);
      clearTimeout(initialUploadTimeout);
      clearInterval(uploadIntervalId);
    };
  }, [triggerDownloadSync]); 


  return (
    <Router>
      <Routes>
        {/* Rota inicial pública */}
        <Route path="/" element={<OperatorScreen />} />

        {/* Rotas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* Rotas sem evento selecionado */}
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/update-data" element={<DataUpdatePage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Rotas com evento selecionado */}
            <Route element={<EventSelectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cloud-sync" element={<CloudSyncPage />} />
              <Route path="/financial-selection" element={<FinancialSelectionPage />} />
              <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} />
              <Route path="/waiter-closing" element={<WaiterClosingPage />} />
              <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} />
              <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} />
              <Route path="/closing-history" element={<ClosingHistoryPage />} />
              <Route path="/export-data" element={<ExportDataPage />} />
              <Route path="/local-confirmation" element={<LocalConfirmationPage />} />
            </Route>
          </Route>
        </Route>
        
        {/* Rota fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}