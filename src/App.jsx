import React, { useContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import Layout from './components/Layout.jsx';
import { API_URL, APP_VERSION } from './config'; // Importando Configurações

// --- CONTEXTO DE LICENÇA ---
import { LicenseProvider, LicenseContext } from './contexts/LicenseContext';
import ActivationPage from './pages/ActivationPage';

// --- COMPONENTE DE UPDATE (NOVO) ---
import UpdateModal from './components/UpdateModal';

// --- IMPORTAÇÃO DAS PÁGINAS ---
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
  
  // Estados para verificação de atualização
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [storeLink, setStoreLink] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(true);

  // 1. EFEITO: VERIFICAR NOVA VERSÃO AO INICIAR
  useEffect(() => {
    const checkVersion = async () => {
        if (!isActivated) {
            setCheckingUpdate(false);
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/api/check-version`);
            const { remoteVersion, storeLink } = response.data;
            
            if (isVersionOutdated(APP_VERSION, remoteVersion)) {
                setStoreLink(storeLink);
                setUpdateAvailable(true);
            }
        } catch (error) {
            console.warn("Não foi possível verificar atualizações na nuvem.");
        } finally {
            setCheckingUpdate(false);
        }
    };

    checkVersion();
  }, [isActivated]); // Roda quando a licença é ativada/carregada

  // Função auxiliar para comparar versões (ex: 1.0.0 vs 1.0.5)
  const isVersionOutdated = (current, remote) => {
      if (!remote || !current) return false;
      const v1 = String(current).split('.').map(Number);
      const v2 = String(remote).split('.').map(Number);
      
      for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
          const num1 = v1[i] || 0;
          const num2 = v2[i] || 0;
          if (num2 > num1) return true; // Remota é maior -> Atualizar
          if (num1 > num2) return false; // Atual é maior -> OK
      }
      return false; // Iguais
  };

  // --- RENDERIZAÇÃO CONDICIONAL ---

  // A. Carregando dados iniciais
  if (isLoading || (isActivated && checkingUpdate)) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          <h3 style={{marginTop: '20px', color: '#555'}}>Iniciando sistema...</h3>
        </div>
      </div>
    );
  }

  // B. Se tiver atualização pendente -> BLOQUEIA E MOSTRA POPUP
  if (updateAvailable) {
      return <UpdateModal storeLink={storeLink} />;
  }

  // C. Se não estiver ativado -> MOSTRA TELA DE ATIVAÇÃO
  if (!isActivated) {
    return <ActivationPage />;
  }

  // D. Tudo OK -> MOSTRA O SISTEMA
  return (
    <Router>
      <Routes>
        {/* ROTA INICIAL: Identificação do Operador */}
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
  // (Nota: O SyncProvider geralmente está no index.js, se não estiver, adicione aqui por fora)
  return (
    <LicenseProvider>
      <AppGuard />
    </LicenseProvider>
  );
}

export default App;