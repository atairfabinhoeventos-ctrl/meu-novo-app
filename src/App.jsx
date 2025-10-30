// src/App.jsx (VERSÃO COM TIMER NO LOCAL CORRETO)

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


// Componentes ProtectedRoute (sem alterações)
const ProtectedRoute = () => { //
  const operatorName = localStorage.getItem('loggedInUserName'); //
  if (!operatorName) { //
    return <Navigate to="/" replace />; //
  }
  return <Outlet />; //
};

// --- CORREÇÃO APLICADA AQUI ---
// Movemos o timer de sincronização para DENTRO da rota que exige um evento.
const EventSelectedRoute = () => { //
  const { triggerDownloadSync } = useContext(SyncContext); //
  const activeEvent = localStorage.getItem('activeEvent'); //

  // Lógica do Timer (movida de App() para cá)
  useEffect(() => {
    // Se não há evento ativo, não faz nada
    if (!activeEvent) return;

    const SYNC_INTERVAL_MS = 300000; // 5 minutos (5 * 60 * 1000)
    let intervalId = null;

    // Usamos o 'async/await' para garantir que as tarefas rodem em sequência
    // e não causem a "Condição de Corrida" (Erro 500) no servidor.
    const runSyncTasks = async () => {
      console.log("[EventSelectedRoute] Executando tarefas de sincronização...");
      
      try {
        // 1. Espera o Download
        if (triggerDownloadSync) {
            console.log("[EventSelectedRoute] Disparando download de dados mestre...");
            await triggerDownloadSync(); //
        } else {
            console.log("[EventSelectedRoute] triggerDownloadSync indisponível, tentando download direto...");
            await backgroundDownloadMasterData().catch(err => console.error("[EventSelectedRoute] Erro no download direto:", err));
        }

        // 2. Espera o Upload (só após o Download)
        console.log("[EventSelectedRoute] Iniciando verificador de uploads pendentes...");
        await retryPendingUploads(); //
        
      } catch (error) {
          console.error("[EventSelectedRoute] Erro durante a execução sequencial das tarefas:", error);
      }
    };

    // Delay inicial de 10 segundos para dar tempo ao server.js iniciar no computador lento
    const initialDelay = 10000; 
    const initialTimeoutId = setTimeout(() => {
      runSyncTasks();
      // Inicia o intervalo *depois* da primeira execução
      intervalId = setInterval(runSyncTasks, SYNC_INTERVAL_MS);
    }, initialDelay);

    // Limpa os timers ao sair das rotas de evento
    return () => {
      console.log("[EventSelectedRoute] Limpando timers de sincronização.");
      clearTimeout(initialTimeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    
    // O useEffect agora depende 'triggerDownloadSync' (que agora é estável)
    // e 'activeEvent' (para reiniciar se o evento mudar)
  }, [triggerDownloadSync, activeEvent]);

  // Se o evento não estiver selecionado, redireciona (lógica original)
  if (!activeEvent) { //
    return <Navigate to="/setup" replace />; //
  }
  // Se estiver selecionado, renderiza as rotas filhas
  return <Outlet />; //
};
// --- FIM DA CORREÇÃO ---


export default function App() { //
  
  // --- REMOVIDO ---
  // A lógica do useEffect() que estava aqui foi movida para o 'EventSelectedRoute'
  // --- FIM DA REMOÇÃO ---

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
            
            {/* Rotas com evento selecionado (agora controlam a sincronização) */}
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