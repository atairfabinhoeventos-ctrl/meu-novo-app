// src/pages/CloudSyncPage.jsx (Com correção de status do feedback)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './CloudSyncPage.css';
import FeedbackModal from '../components/FeedbackModal';

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
      setFeedbackModal({
        isOpen: true,
        title: 'Atenção',
        message: 'Nenhum evento ativo selecionado. Por favor, selecione um evento na tela inicial.',
        status: 'error'
      });
      return;
    }
    setIsLoading(true);

    try {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allClosings.filter(c => c.eventName === activeEvent);

      if (eventClosings.length === 0) {
        setFeedbackModal({
          isOpen: true,
          title: 'Atenção',
          message: `Nenhum fechamento local encontrado para o evento "${activeEvent}". Nada a enviar.`,
          status: 'error' // CORRIGIDO
        });
        setIsLoading(false);
        return;
      }

      const waiterClosings = eventClosings.filter(c => c.waiterName);
      const cashierClosings = eventClosings.filter(c => c.cashierName || c.caixas);
      const waiterHeader = [ "NOME GARÇOM", "PROTOCOLO", "VALOR VENDA TOTAL", "DEVOLUÇÃO ESTORNO", "COMISSÃO TOTAL", "ACERTO", "CRÉDITO", "DÉBITO", "PIX", "CASHLESS", "Nº MÁQUINA", "OPERADOR", "DATA" ];
      const waiterData = waiterClosings.map(c => [ c.waiterName, c.protocol, c.valorTotal, c.temEstorno ? c.valorEstorno : 0, c.comissaoTotal, c.diferencaPagarReceber, c.credito, c.debito, c.pix, c.cashless, c.numeroMaquina, c.operatorName, new Date(c.timestamp).toLocaleString('pt-BR') ]);
      const cashierHeader = [ "PROTOCOLO", "DATA", "TIPO", "CPF", "NOME DO CAIXA", "Nº MÁQUINA", "VENDA TOTAL", "DIFERENÇA", "OPERADOR" ];
      let cashierData = [];
      cashierClosings.forEach(c => {
        if (c.caixas) {
          c.caixas.forEach(caixa => {
            cashierData.push([ c.protocol, new Date(c.timestamp).toLocaleString('pt-BR'), 'Fixo', caixa.cpf, caixa.cashierName, caixa.numeroMaquina, caixa.valorTotalVenda, null, c.operatorName ]);
          });
        } else {
           cashierData.push([ c.protocol, new Date(c.timestamp).toLocaleString('pt-BR'), 'Móvel', c.cpf, c.cashierName, c.numeroMaquina, c.valorTotalVenda, c.diferenca, c.operatorName ]);
        }
      });

      const response = await axios.post(`${API_URL}/api/cloud-sync`, {
        eventName: activeEvent,
        waiterData: { header: waiterHeader, data: waiterData },
        cashierData: { header: cashierHeader, data: cashierData }
      });
      
      setFeedbackModal({
        isOpen: true,
        title: 'Sincronização Concluída!',
        message: response.data.message.replace(/\n/g, '<br/>'),
        status: 'success'
      });

    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      const errorMessage = error.response?.data?.message || 'Falha na comunicação com o servidor.';
      
      setFeedbackModal({
        isOpen: true,
        title: 'Ocorreu um Erro',
        message: errorMessage,
        status: 'error'
      });
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
            <p>
              Você está prestes a enviar todos os fechamentos salvos localmente do evento:
            </p>
            <div className="active-event-display">
              {activeEvent}
            </div>
          </>
        ) : (
          <p className="error-message">
            Nenhum evento ativo. Por favor, retorne ao início e selecione um evento para continuar.
          </p>
        )}
        
        <button onClick={handleCloudSync} disabled={isLoading || !activeEvent}>
          Iniciar Envio para Nuvem
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