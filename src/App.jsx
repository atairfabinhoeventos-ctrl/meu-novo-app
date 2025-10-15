// src/App.jsx (VERSÃO ATUALIZADA COM LAYOUT UNIFICADO)

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';

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
import AdminPage from './pages/AdminPage'; // <-- 1. IMPORTAÇÃO DA NOVA PÁGINA


// Componente para proteger rotas que exigem login do operador
const ProtectedRoute = () => {
  const operatorName = localStorage.getItem('loggedInUserName');
  if (!operatorName) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

// Componente para proteger rotas que exigem um evento ativo
const EventSelectedRoute = () => {
  const activeEvent = localStorage.getItem('activeEvent');
  if (!activeEvent) {
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota inicial pública: Tela de login do operador (sem layout) */}
        <Route path="/" element={<OperatorScreen />} />

        {/* GRUPO DE ROTAS PROTEGIDAS PELO LOGIN DO OPERADOR */}
        <Route element={<ProtectedRoute />}>
          {/* O Layout agora envolve todas as telas após o login */}
          <Route element={<Layout />}>
            
            {/* Telas de configuração que não exigem evento selecionado */}
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/update-data" element={<DataUpdatePage />} />

            {/* GRUPO DE ROTAS QUE EXIGEM LOGIN E SELEÇÃO DE EVENTO */}
            <Route element={<EventSelectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cloud-sync" element={<CloudSyncPage />} />
              <Route path="/financial-selection" element={<FinancialSelectionPage />} />
              <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} />
              <Route path="/waiter-closing" element={<WaiterClosingPage />} />
              <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} />
              <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} />
              <Route path="/closing-history" element={<ClosingHistoryPage />} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/export-data" element={<ExportDataPage />} />
              <Route path="/local-confirmation" element={<LocalConfirmationPage />} />
            </Route>

          </Route>
        </Route>
        
        {/* Rota para qualquer outro caminho não encontrado */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}