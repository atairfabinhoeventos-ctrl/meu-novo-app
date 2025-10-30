// src/App.jsx (VERSÃO COM TIMER ÚNICO E CORRETO)

import React, { useEffect, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx'; //
import { SyncContext } from './contexts/SyncContext.jsx'; //
import { retryPendingUploads, backgroundDownloadMasterData } from './services/syncService'; //

// Importando suas páginas
import OperatorScreen from './pages/OperatorScreen.jsx'; //
import SetupPage from './pages/SetupPage.jsx'; //
import DashboardPage from './pages/DashboardPage.jsx'; //
import FinancialSelectionPage from './pages/FinancialSelectionPage.jsx'; //
import WaiterClosing10Page from './pages/WaiterClosing10Page.jsx'; //
import MobileCashierClosingPage from './pages/MobileCashierClosingPage.jsx'; //
import FixedCashierClosingPage from './pages/FixedCashierClosingPage.jsx'; //
import ClosingHistoryPage from './pages/ClosingHistoryPage.jsx'; //
import ExportDataPage from './pages/ExportDataPage.jsx'; //
import LocalConfirmationPage from './pages/LocalConfirmationPage.jsx'; //
import DataUpdatePage from './pages/DataUpdatePage.jsx'; //
import WaiterClosingPage from './pages/WaiterClosingPage.jsx'; //
import CloudSyncPage from './pages/CloudSyncPage.jsx'; //
import AdminPage from './pages/AdminPage'; //


// Componentes ProtectedRoute e EventSelectedRoute (sem alterações)
const ProtectedRoute = () => { //
  const operatorName = localStorage.getItem('loggedInUserName'); //
  if (!operatorName) { //
    return <Navigate to="/" replace />; //
  }
  return <Outlet />; //
};
const EventSelectedRoute = () => { //
  const activeEvent = localStorage.getItem('activeEvent'); //
  if (!activeEvent) { //
    return <Navigate to="/setup" replace />; //
  }
  return <Outlet />; //
};


export default function App() { //
  const { triggerDownloadSync } = useContext(SyncContext); //

  useEffect(() => {
    // --- LÓGICA DE TIMER UNIFICADA E CORRIGIDA ---
    const SYNC_INTERVAL_MS = 300000; // 5 minutos (5 * 60 * 1000)
    let intervalId = null;

    // --- CORREÇÃO APLICADA AQUI (async/await) ---
    // Transformamos a função em 'async' para poder usar 'await'
    const runSyncTasks = async () => { //
      console.log("[App.jsx] Executando tarefas de sincronização...");
      
      try {
        // 1. Dispara o download de dados mestre (usando a função do context)
        if (triggerDownloadSync) {
            console.log("[App.jsx] Disparando download de dados mestre...");
            // ADICIONADO 'await' para esperar o download terminar
            await triggerDownloadSync(); //
        } else {
          // Fallback caso o triggerDownloadSync não esteja pronto (raro)
            console.log("[App.jsx] triggerDownloadSync indisponível, tentando download direto...");
            // ADICIONADO 'await' para esperar o download terminar
            await backgroundDownloadMasterData().catch(err => console.error("[App.jsx] Erro no download direto:", err));
        }

        // 2. Dispara a verificação de uploads pendentes (SÓ DEPOIS QUE O DOWNLOAD TERMINAR)
        console.log("[App.jsx] Iniciando verificador de uploads pendentes...");
        // ADICIONADO 'await' (embora não seja 100% necessário aqui, é uma boa prática)
        await retryPendingUploads(); //
        
      } catch (error) {
          console.error("[App.jsx] Erro durante a execução sequencial das tarefas:", error);
      }
    };
    // --- FIM DA CORREÇÃO ---

    // Executa as tarefas uma vez logo após um delay (mantemos 10s para segurança)
    const initialDelay = 10000; // 10 segundos (para garantir que o server.js iniciou)
    const initialTimeoutId = setTimeout(() => {
      runSyncTasks();
      // Inicia o intervalo *depois* da primeira execução
      intervalId = setInterval(runSyncTasks, SYNC_INTERVAL_MS);
    }, initialDelay);

    // Limpa o timeout inicial e o intervalo ao desmontar o componente
    return () => {
      console.log("[App.jsx] Limpando timers de sincronização.");
      clearTimeout(initialTimeoutId);
      if (intervalId) {
        clearInterval(intervalId); //
      }
    };
  }, [triggerDownloadSync]); // Depende de triggerDownloadSync para garantir que o contexto está pronto


  return ( //
    <Router> {/* */}
      <Routes> {/* */}
        {/* Rota inicial pública */}
        <Route path="/" element={<OperatorScreen />} /> {/* */}

        {/* Rotas protegidas */}
        <Route element={<ProtectedRoute />}> {/* */}
          <Route element={<Layout />}> {/* */}
            {/* Rotas sem evento selecionado */}
            <Route path="/setup" element={<SetupPage />} /> {/* */}
            <Route path="/update-data" element={<DataUpdatePage />} /> {/* */}
            <Route path="/admin" element={<AdminPage />} /> {/* */}
            {/* Rotas com evento selecionado */}
            <Route element={<EventSelectedRoute />}> {/* */}
              <Route path="/dashboard" element={<DashboardPage />} /> {/* */}
              <Route path="/cloud-sync" element={<CloudSyncPage />} /> {/* */}
              <Route path="/financial-selection" element={<FinancialSelectionPage />} /> {/* */}
              <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} /> {/* */}
              <Route path="/waiter-closing" element={<WaiterClosingPage />} /> {/* */}
              <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} /> {/* */}
              <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} /> {/* */}
              <Route path="/closing-history" element={<ClosingHistoryPage />} /> {/* */}
              <Route path="/export-data" element={<ExportDataPage />} /> {/* */}
              <Route path="/local-confirmation" element={<LocalConfirmationPage />} /> {/* */}
            </Route>
          </Route>
        </Route>

        {/* Rota fallback */}
        <Route path="*" element={<Navigate to="/" />} /> {/* */}
      </Routes> {/* */}
    </Router> //
  );
}