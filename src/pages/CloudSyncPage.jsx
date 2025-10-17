// src/pages/CloudSyncPage.jsx (VERSÃO CORRIGIDA - CPF DO GARÇOM INCLUÍDO)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CloudSyncPage.css';
import FeedbackModal from '../components/FeedbackModal';

// Garanta que a URL do seu servidor backend esteja correta aqui
const API_URL = 'http://localhost:3001';

function CloudSyncPage() {
  const [activeEvent, setActiveEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    status: ''
  });

  useEffect(() => {
    const eventName = localStorage.getItem('activeEvent') || '';
    setActiveEvent(eventName);
  }, []);

  const handleCloudSync = async () => {
    if (!activeEvent) {
      setFeedbackModal({ isOpen: true, title: 'Atenção', message: 'Nenhum evento ativo selecionado.', status: 'error' });
      return;
    }
    setIsLoading(true);

    try {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allClosings.filter(c => c.eventName === activeEvent);

      if (eventClosings.length === 0) {
        setFeedbackModal({ isOpen: true, title: 'Nenhuma Ação Necessária', message: `Nenhum fechamento local para "${activeEvent}".`, status: 'success' });
        setIsLoading(false);
        return;
      }

      const waiterData = eventClosings
        .filter(c => c.type === 'waiter')
        .map(c => ({
            timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
            protocol: c.protocol,
            // --- LINHA CORRIGIDA ADICIONADA AQUI ---
            cpf: c.cpf, 
            waiterName: c.waiterName,
            numeroMaquina: c.numeroMaquina,
            valorTotal: c.valorTotal,
            credito: c.credito,
            debito: c.debito,
            pix: c.pix,
            cashless: c.cashless,
            valorEstorno: c.temEstorno ? c.valorEstorno : 0,
            comissaoTotal: c.comissaoTotal,
            acerto: c.diferencaLabel === 'Pagar ao Garçom' ? -c.diferencaPagarReceber : c.diferencaPagarReceber,
            operatorName: c.operatorName
        }));

      const cashierData = eventClosings
        .filter(c => c.type === 'cashier' || Array.isArray(c.caixas))
        .flatMap(c => {
            if (Array.isArray(c.caixas)) {
                return c.caixas.map((caixa, index) => {
                    const acertoCaixa = (caixa.valorTotalVenda - (caixa.credito + caixa.debito + caixa.pix + caixa.cashless) - (caixa.temEstorno ? caixa.valorEstorno : 0));
                    return { protocol: `${c.protocol}-${index}`, timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), type: 'Fixo', cpf: caixa.cpf, cashierName: caixa.cashierName, numeroMaquina: caixa.numeroMaquina, valorTotalVenda: caixa.valorTotalVenda, credito: caixa.credito, debito: caixa.debito, pix: caixa.pix, cashless: caixa.cashless, valorTroco: c.valorTroco, valorEstorno: caixa.temEstorno ? caixa.valorEstorno : 0, dinheiroFisico: caixa.dinheiroFisico, valorAcerto: acertoCaixa, diferenca: caixa.dinheiroFisico - acertoCaixa, operatorName: c.operatorName };
                });
            } else {
                return [{ protocol: c.protocol, timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), type: 'Móvel', cpf: c.cpf, cashierName: c.cashierName, numeroMaquina: c.numeroMaquina, valorTotalVenda: c.valorTotalVenda, credito: c.credito, debito: c.debito, pix: c.pix, cashless: c.cashless, valorTroco: c.valorTroco, valorEstorno: c.temEstorno ? c.valorEstorno : 0, dinheiroFisico: c.dinheiroFisico, valorAcerto: c.valorAcerto, diferenca: c.diferenca, operatorName: c.operatorName }];
            }
        });

      const url = `${API_URL}/api/cloud-sync`;
      const payload = {
        eventName: activeEvent,
        waiterData: waiterData,
        cashierData: cashierData,
      };

      const response = await axios.post(url, payload);
      
      const { newWaiters, updatedWaiters, newCashiers, updatedCashiers } = response.data;
      
      let messageParts = [];
      if (newWaiters > 0) messageParts.push(`- ${newWaiters} novo(s) fechamento(s) de garçom enviados.`);
      if (updatedWaiters > 0) messageParts.push(`- ${updatedWaiters} fechamento(s) de garçom atualizados.`);
      if (newCashiers > 0) messageParts.push(`- ${newCashiers} novo(s) fechamento(s) de caixa enviados.`);
      if (updatedCashiers > 0) messageParts.push(`- ${updatedCashiers} fechamento(s) de caixa atualizados.`);

      if (messageParts.length === 0) {
        setFeedbackModal({ isOpen: true, title: 'Tudo Certo!', message: 'Todos os dados locais já estavam sincronizados.', status: 'success' });
      } else {
        setFeedbackModal({ isOpen: true, title: 'Sincronização Concluída!', message: messageParts.join('<br/>'), status: 'success' });
      }

    } catch (error) {
      console.error("[SYNC-FRONTEND-ERRO] Falha ao enviar a requisição:", error);
      const errorMessage = error.response?.data?.message || 'Falha na comunicação com o servidor. Verifique o console para mais detalhes.';
      setFeedbackModal({ isOpen: true, title: 'Ocorreu um Erro', message: errorMessage, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const closeFeedbackModal = () => {
    setFeedbackModal({ isOpen: false, title: '', message: '', status: '' });
  };

  return (
    <div className="cloud-sync-container">
      <FeedbackModal 
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedbackModal}
        title={feedbackModal.title}
        message={feedbackModal.message}
        status={feedbackModal.status}
      />
      <div className="cloud-sync-card">
        <h1>☁️ Enviar Dados para Nuvem</h1>
        {activeEvent ? (
          <>
            <p>Você está prestes a enviar todos os fechamentos salvos localmente do evento:</p>
            <div className="active-event-display">{activeEvent}</div>
          </>
        ) : (
          <p className="error-message">Nenhum evento ativo. Por favor, retorne ao início e selecione um evento.</p>
        )}
        <button onClick={handleCloudSync} disabled={isLoading || !activeEvent}>
          {isLoading ? 'Enviando...' : 'Iniciar Envio para Nuvem'}
        </button>
      </div>
      {isLoading && (
        <div className="modal-overlay">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Enviando dados para a nuvem...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CloudSyncPage;