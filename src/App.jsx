// src/App.jsx
import React, { useEffect, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { SyncContext } from './contexts/SyncContext.jsx';
import { retryPendingUploads, backgroundDownloadMasterData } from './services/syncService';

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
import AdminPage from './pages/AdminPage.jsx';
import ZigCashlessClosingPage from './pages/ZigCashlessClosingPage.jsx';
import ReceiptsGeneratorPage from './pages/ReceiptsGeneratorPage.jsx'; 

// --- NOVO IMPORT DE TREINAMENTOS ---
import TrainingPage from './pages/TrainingPage.jsx'; 

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
    const SYNC_INTERVAL_MS = 300000; // 5 minutos
    let intervalId = null;

    const runSyncTasks = () => {
      console.log("[App.jsx] Executando tarefas de sincronização...");
      if (triggerDownloadSync) {
         triggerDownloadSync();
      } else {
         backgroundDownloadMasterData().catch(err => console.error("[App.jsx] Erro no download direto:", err));
      }
      retryPendingUploads();
    };

    const initialDelay = 5000;
    const initialTimeoutId = setTimeout(() => {
      runSyncTasks();
      intervalId = setInterval(runSyncTasks, SYNC_INTERVAL_MS);
    }, initialDelay);

    return () => {
      clearTimeout(initialTimeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [triggerDownloadSync]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<OperatorScreen />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/update-data" element={<DataUpdatePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/receipts-generator" element={<ReceiptsGeneratorPage />} />

            {/* Rotas que exigem um Evento Ativo (selecionado no Setup) */}
            <Route element={<EventSelectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cloud-sync" element={<CloudSyncPage />} />
              <Route path="/financial-selection" element={<FinancialSelectionPage />} />
              <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} />
              <Route path="/waiter-closing" element={<WaiterClosingPage />} />
              <Route path="/zig-cashless-closing" element={<ZigCashlessClosingPage />} />
              <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} />
              <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} />
              <Route path="/closing-history" element={<ClosingHistoryPage />} />
              <Route path="/export-data" element={<ExportDataPage />} />
              <Route path="/local-confirmation" element={<LocalConfirmationPage />} />

              {/* --- NOVA ROTA DE TREINAMENTOS --- */}
              <Route path="/training" element={<TrainingPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}