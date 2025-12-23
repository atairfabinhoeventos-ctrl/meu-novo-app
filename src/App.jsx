import React, { useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout.jsx';

// --- CONTEXTO DE LICENÇA ---
import { LicenseProvider, LicenseContext } from './contexts/LicenseContext';
import ActivationPage from './pages/ActivationPage';

// --- IMPORTAÇÃO DAS PÁGINAS ---
// Agora importamos a OperatorScreen em vez do LoginPage
import OperatorScreen from './pages/OperatorScreen.jsx'; 
import SetupPage from './pages/SetupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FinancialSelectionPage from './pages/FinancialSelectionPage.jsx';
import WaiterClosingPage from './pages/WaiterClosingPage.jsx';
import WaiterClosing10Page from './pages/WaiterClosing10Page.jsx';
import MobileCashierClosingPage from './pages/MobileCashierClosingPage.jsx';
import FixedCashierClosingPage from './pages/FixedCashierClosingPage.jsx';
import ZigCashlessClosingPage from './pages/ZigCashlessClosingPage.jsx';
import ClosingHistoryPage from './pages/ClosingHistoryPage.jsx';
import ExportDataPage from './pages/ExportDataPage.jsx';
import LocalConfirmationPage from './pages/LocalConfirmationPage.jsx';
import DataUpdatePage from './pages/DataUpdatePage.jsx';
import CloudSyncPage from './pages/CloudSyncPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ReceiptsGeneratorPage from './pages/ReceiptsGeneratorPage.jsx';
import TrainingPage from './pages/TrainingPage.jsx';

// --- COMPONENTE DE ROTA PROTEGIDA POR EVENTO ---
const EventSelectedRoute = () => {
  const activeEvent = localStorage.getItem('activeEvent');
  if (!activeEvent) {
    // Se não tiver evento selecionado, manda para o Setup
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
};

// --- GUARDA PRINCIPAL DA APLICAÇÃO ---
const AppGuard = () => {
  const { isActivated, isLoading } = useContext(LicenseContext);

  if (isLoading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h3>Carregando sistema...</h3>
        </div>
      </div>
    );
  }

  // 1. SE NÃO ESTIVER ATIVADO -> MOSTRA TELA DE ATIVAÇÃO
  if (!isActivated) {
    return <ActivationPage />;
  }

  // 2. SE ATIVADO -> FLUXO NORMAL DO SISTEMA
  return (
    <Router>
      <Routes>
        {/* ROTA INICIAL: Identificação do Operador (Substitui o Login) */}
        <Route path="/" element={<OperatorScreen />} />

        {/* Seleção de Evento (Vem após o Operador se identificar) */}
        <Route path="/setup" element={<SetupPage />} />
        
        {/* Rota para Atualizar Dados/Admin (Acessível do Setup) */}
        <Route path="/update-data" element={<DataUpdatePage />} />

        {/* --- ROTAS DENTRO DO LAYOUT (COM HEADER E FOOTER) --- */}
        <Route element={<Layout />}>
          
          {/* Rotas Administrativas */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/receipts-generator" element={<ReceiptsGeneratorPage />} />

          {/* Rotas que exigem um Evento Ativo */}
          <Route element={<EventSelectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cloud-sync" element={<CloudSyncPage />} />
            <Route path="/financial-selection" element={<FinancialSelectionPage />} />
            
            {/* Telas de Fechamento */}
            <Route path="/waiter-closing" element={<WaiterClosingPage />} />
            <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} />
            <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} />
            <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} />
            <Route path="/zig-cashless-closing" element={<ZigCashlessClosingPage />} />
            
            {/* Outras Telas Operacionais */}
            <Route path="/closing-history" element={<ClosingHistoryPage />} />
            <Route path="/export-data" element={<ExportDataPage />} />
            <Route path="/local-confirmation" element={<LocalConfirmationPage />} />
            <Route path="/training" element={<TrainingPage />} />
          </Route>
        </Route>

        {/* Redirecionamento padrão */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

function App() {
  // SyncProvider envolve LicenseProvider, que envolve o AppGuard
  return (
    <LicenseProvider>
      <AppGuard />
    </LicenseProvider>
  );
}

export default App;