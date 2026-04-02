import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { backgroundDownloadMasterData } from '../services/syncService';
import FeedbackModal from '../components/FeedbackModal.jsx';
import './DataUpdatePage.css';

function DataUpdatePage() {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, title: '', message: '', status: '' });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Chama a função que busca no MongoDB e salva no localStorage
      await backgroundDownloadMasterData();
      
      // Conta quantos registros vieram para mostrar no modal de sucesso
      const waiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
      const events = JSON.parse(localStorage.getItem('master_events')) || [];

      setFeedback({
        isOpen: true,
        title: 'Sincronização Concluída',
        message: `Banco de dados atualizado com sucesso!<br><br><b>${waiters.length}</b> Colaboradores<br><b>${events.length}</b> Eventos`,
        status: 'success'
      });
    } catch (error) {
      setFeedback({
        isOpen: true,
        title: 'Falha na Sincronização',
        message: 'Não foi possível conectar ao servidor para atualizar os dados. Verifique sua conexão com a internet.',
        status: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="update-container">
      <FeedbackModal 
        isOpen={feedback.isOpen} 
        onClose={() => setFeedback({ ...feedback, isOpen: false })} 
        title={feedback.title} 
        message={feedback.message} 
        status={feedback.status} 
      />

      <h1 className="update-title">Sincronização de Dados</h1>

      <div className="online-sync-section">
        <h2 className="sync-section-title">Integração SISGEF (MongoDB)</h2>
        <p className="sync-section-desc">
          O sistema SisFO agora está integrado diretamente ao banco de dados oficial em nuvem. <br/>
          Para garantir que você tenha os cadastros mais recentes, clique no botão abaixo para baixar a lista de <b>Colaboradores</b> e <b>Eventos</b> atualizada.
        </p>

        <button 
          className="sync-button"
          onClick={handleSync} 
          disabled={isSyncing}
        >
          {isSyncing ? '⏳ Baixando dados do Servidor...' : '🔄 Forçar Sincronização Agora'}
        </button>
      </div>

      <div className="back-section">
         <button className="back-button-simple" onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
         </button>
      </div>
    </div>
  );
}

export default DataUpdatePage;