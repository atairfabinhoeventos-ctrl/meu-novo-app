// src/pages/CloudSyncPage.jsx (VERSÃO CORRIGIDA SEM ERROS DE SINTAXE)

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
          title: 'Nenhuma Ação Necessária',
          message: `Nenhum fechamento local encontrado para o evento "${activeEvent}". Nada a enviar.`,
          status: 'success'
        });
        setIsLoading(false);
        return;
      }

      const waiterClosings = eventClosings.filter(c => c.type === 'waiter');
      const cashierClosings = eventClosings.filter(c => c.type === 'cashier' || c.type === 'fixed_cashier');
      
      const waiterHeader = [ "DATA", "PROTOCOLO", "NOME GARÇOM", "Nº MÁQUINA", "VALOR VENDA TOTAL", "CRÉDITO", "DÉBITO", "PIX", "CASHLESS", "DEVOLUÇÃO ESTORNO", "COMISSÃO TOTAL", "ACERTO", "OPERADOR"];
      const waiterData = waiterClosings.map(c => [ new Date(c.timestamp).toLocaleString('pt-BR'), c.protocol, c.waiterName, c.numeroMaquina, c.valorTotal, c.credito, c.debito, c.pix, c.cashless, c.temEstorno ? c.valorEstorno : 0, c.comissaoTotal, c.diferencaLabel === 'Pagar ao Garçom' ? -c.diferencaPagarReceber : c.diferencaPagarReceber, c.operatorName ]);
      
      const cashierHeader = [ "PROTOCOLO", "DATA", "TIPO", "CPF", "NOME DO CAIXA", "Nº MÁQUINA", "VENDA TOTAL", "CRÉDITO", "DÉBITO", "PIX", "CASHLESS", "TROCO", "DEVOLUÇÃO ESTORNO", "DINHEIRO FÍSICO", "VALOR ACERTO", "DIFERENÇA", "OPERADOR" ];
      let cashierData = [];
      cashierClosings.forEach(c => {
        if (c.type === 'fixed_cashier' && c.caixas) {
          c.caixas.forEach(caixa => {
            const acertoCaixa = (caixa.valorTotalVenda - (caixa.credito + caixa.debito + caixa.pix + caixa.cashless) - (caixa.temEstorno ? caixa.valorEstorno : 0));
            cashierData.push([ c.protocol, new Date(c.timestamp).toLocaleString('pt-BR'), 'Fixo', caixa.cpf, caixa.cashierName, caixa.numeroMaquina, caixa.valorTotalVenda, caixa.credito, caixa.debito, caixa.pix, caixa.cashless, c.valorTroco, caixa.temEstorno ? caixa.valorEstorno : 0, caixa.dinheiroFisico, acertoCaixa, caixa.dinheiroFisico - acertoCaixa, c.operatorName ]);
          });
        } else if (c.type === 'cashier') {
           cashierData.push([ c.protocol, new Date(c.timestamp).toLocaleString('pt-BR'), 'Móvel', c.cpf, c.cashierName, c.numeroMaquina, c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco, c.temEstorno ? c.valorEstorno : 0, c.dinheiroFisico, c.valorAcerto, c.diferenca, c.operatorName ]);
        }
      });

      const response = await axios.post(`${API_URL}/api/cloud-sync`, {
        eventName: activeEvent,
        waiterData: { header: waiterHeader, data: waiterData },
        cashierData: { header: cashierHeader, data: cashierData }
      });
      
      const { newWaiters, updatedWaiters, newCashiers, updatedCashiers } = response.data;
      
      let messageParts = [];
      if (newWaiters > 0) messageParts.push(`- ${newWaiters} novo(s) fechamento(s) de garçom enviados.`);
      if (updatedWaiters > 0) messageParts.push(`- ${updatedWaiters} fechamento(s) de garçom atualizados.`);
      if (newCashiers > 0) messageParts.push(`- ${newCashiers} novo(s) fechamento(s) de caixa enviados.`);
      if (updatedCashiers > 0) messageParts.push(`- ${updatedCashiers} fechamento(s) de caixa atualizados.`);

      if (messageParts.length === 0) {
        setFeedbackModal({
          isOpen: true,
          title: 'Tudo Certo!',
          message: 'Todos os dados locais já estavam sincronizados com a nuvem. Nenhuma ação foi necessária.',
          status: 'success'
        });
      } else {
        setFeedbackModal({
          isOpen: true,
          title: 'Sincronização Concluída!',
          message: messageParts.join('<br/>'),
          status: 'success'
        });
      }

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