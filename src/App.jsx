import React, { useContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import Layout from './components/Layout.jsx';
import { API_URL, APP_VERSION } from './config'; // Importando Configurações

// --- CONTEXTOS ---
import { LicenseProvider, LicenseContext } from './contexts/LicenseContext';
import { SyncProvider } from './contexts/SyncContext'; // <--- ADICIONADO: Import do Sync
import ActivationPage from './pages/ActivationPage';

// --- COMPONENTE DE UPDATE ---
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

// --- CORREÇÃO CRÍTICA: IDENTIFICAÇÃO DA VERSÃO ---
// Isso garante que o servidor saiba que este é o App Novo e permita a validação da licença
axios.defaults.headers.common['x-app-version'] = APP_VERSION;
// --------------------------------------------------

// --- COMPONENTE DE ROTA PROTEGIDA POR EVENTO ---
const EventSelectedRoute = () => {
  const activeEvent = localStorage.getItem('activeEvent');
  if (!activeEvent) {
    return <Navigate to="/setup" replace />;
  }
  return <Outlet />;
};

// --- GUARDA PRINCIPAL DA APLICAÇÃO ---
const AppGuard = () => {
  const { isActivated, isLoading } = useContext(LicenseContext);
  
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [storeLink, setStoreLink] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(true);

  // 1. EFEITO: VERIFICAR NOVA VERSÃO AO INICIAR
  useEffect(() => {
    const checkVersion = async () => {
        // Se não tiver ativado, não perde tempo checando update na nuvem ainda
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
  }, [isActivated]);

  const isVersionOutdated = (current, remote) => {
      if (!remote || !current) return false;
      const v1 = String(current).split('.').map(Number);
      const v2 = String(remote).split('.').map(Number);
      
      for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
          const num1 = v1[i] || 0;
          const num2 = v2[i] || 0;
          if (num2 > num1) return true; 
          if (num1 > num2) return false; 
      }
      return false; 
  };

  // A. Carregando
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

  // B. Bloqueio de Update
  if (updateAvailable) {
      return <UpdateModal storeLink={storeLink} />;
  }

  // C. Tela de Ativação (Licença)
  if (!isActivated) {
    return <ActivationPage />;
  }

  // D. Sistema Logado
  return (
    <Router>
      <Routes>
        <Route path="/" element={<OperatorScreen />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/update-data" element={<DataUpdatePage />} />

        <Route element={<Layout />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/receipts-generator" element={<ReceiptsGeneratorPage />} />

          <Route element={<EventSelectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cloud-sync" element={<CloudSyncPage />} />
            <Route path="/financial-selection" element={<FinancialSelectionPage />} />
            
            <Route path="/waiter-closing" element={<WaiterClosingPage />} />
            <Route path="/waiter-closing-10" element={<WaiterClosing10Page />} />
            <Route path="/mobile-cashier-closing" element={<MobileCashierClosingPage />} />
            <Route path="/fixed-cashier-closing" element={<FixedCashierClosingPage />} />
            <Route path="/zig-cashless-closing" element={<ZigCashlessClosingPage />} />
            
            <Route path="/closing-history" element={<ClosingHistoryPage />} />
            <Route path="/export-data" element={<ExportDataPage />} />
            <Route path="/local-confirmation" element={<LocalConfirmationPage />} />
            <Route path="/training" element={<TrainingPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

function App() {
  // CORREÇÃO: SyncProvider envolve LicenseProvider
  return (
    <SyncProvider>
      <LicenseProvider>
        <AppGuard />
      </LicenseProvider>
    </SyncProvider>
  );
}

export default App;