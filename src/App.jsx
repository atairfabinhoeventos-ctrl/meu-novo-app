// src/App.jsx (VERSÃO LIMPA SEM A PÁGINA DE TREINAMENTO)

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';

// Importando suas páginas
import OperatorScreen from './pages/OperatorScreen.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EventSelectionPage from './pages/EventSelectionPage.jsx';
import FinancialSelectionPage from './pages/FinancialSelectionPage.jsx';
import WaiterClosing10Page from './pages/WaiterClosing10Page.jsx';
import MobileCashierClosingPage from './pages/MobileCashierClosingPage.jsx';
import FixedCashierClosingPage from './pages/FixedCashierClosingPage.jsx';
import ClosingHistoryPage from './pages/ClosingHistoryPage.jsx';
import ExportDataPage from './pages/ExportDataPage.jsx';
import LocalConfirmationPage from './pages/LocalConfirmationPage.jsx';
import DataUpdatePage from './pages/DataUpdatePage.jsx';
import WaiterClosingPage from './pages/WaiterClosingPage.jsx';
import CloudSyncPage from './pages/CloudSyncPage.jsx'; // Rota para Enviar para Nuvem

// Componente para proteger as rotas
const ProtectedRoute = () => {
  const operatorName = localStorage.getItem('loggedInUserName');
  if (!operatorName) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota inicial: Pede o nome do operador */}
        <Route path="/" element={<OperatorScreen />} />

        {/* Rotas Protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cloud-sync" element={<CloudSyncPage />} />
            <Route path="/update-data" element={<DataUpdatePage />} />
            <Route path="/event-selection" element={<EventSelectionPage />} />
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
        
        {/* Rota para qualquer outro caminho não encontrado */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}