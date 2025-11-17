// src/pages/CloudSyncPage.jsx (VERSÃO ATUALIZADA PARA ZIG)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CloudSyncPage.css';
import FeedbackModal from '../components/FeedbackModal';
import { API_URL } from '../config'; 

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

      // --- MUDANÇA AQUI ---
      // Filtra todos os tipos de garçom (waiter, waiter_10, waiter_zig)
      const waiterData = eventClosings
        .filter(c => c.type && c.type.startsWith('waiter'))
        .map(c => ({
            // Adiciona o 'type' para o backend saber qual é
            type: c.type, 
            timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
            protocol: c.protocol,
            cpf: c.cpf, 
            waiterName: c.waiterName,
            numeroMaquina: c.numeroMaquina,
            valorTotal: c.valorTotal,
            credito: c.credito,
            debito: c.debito,
            pix: c.pix,
            cashless: c.cashless || 0, // Garante 0 se for ZIG
            // Adiciona o novo campo
            valorTotalProdutos: c.valorTotalProdutos || 0, 
            valorEstorno: c.temEstorno ? c.valorEstorno : 0,
            comissaoTotal: c.comissaoTotal,
            // Envia o 'diferencaLabel' para o backend (que agora espera)
            diferencaLabel: c.diferencaLabel, 
            diferencaPagarReceber: c.diferencaPagarReceber,
            // Lógica antiga de 'acerto' removida, pois o backend agora usa os 2 campos acima
            operatorName: c.operatorName
        }));
      // --- FIM DA MUDANÇA ---

      const cashierData = eventClosings
        .filter(c => c.type === 'cashier' || Array.isArray(c.caixas)) // Filtra Caixas Móveis E Grupos de Caixas Fixos
        .flatMap(c => { // 'c' é o objeto de fechamento
            // --- LÓGICA PARA GRUPO DE CAIXA FIXO ---
            if (Array.isArray(c.caixas)) {
                return c.caixas.map((caixa, index) => { // 'caixa' é o sub-objeto de um caixa individual
                    // Cálculo do acerto individual (sem troco)
                    const acertoCaixa = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                    // Diferença individual (Dinheiro Físico vs Acerto)
                    const diferencaCaixa = (caixa.dinheiroFisico || 0) - acertoCaixa;
                    
                    return { 
                        // Protocolo individual (Ex: CXF-123-1)
                        protocol: caixa.protocol || `${c.protocol}-${index + 1}`,
                        timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), 
                        type: 'Fixo', // Tipo para a planilha
                        cpf: caixa.cpf, 
                        cashierName: caixa.cashierName, 
                        numeroMaquina: caixa.numeroMaquina, 
                        valorTotalVenda: caixa.valorTotalVenda || 0, 
                        credito: caixa.credito || 0, 
                        debito: caixa.debito || 0, 
                        pix: caixa.pix || 0, 
                        cashless: caixa.cashless || 0, 
                        // O 'valorTroco' (do grupo 'c') só é aplicado ao primeiro caixa (index === 0)
                        valorTroco: index === 0 ? (c.valorTroco || 0) : 0, 
                        valorEstorno: (caixa.temEstorno ? caixa.valorEstorno : 0) || 0, 
                        dinheiroFisico: caixa.dinheiroFisico || 0, 
                        valorAcerto: acertoCaixa, // Acerto esperado (sem troco)
                        diferenca: diferencaCaixa, // Diferença (com base no dinheiro físico)
                        operatorName: c.operatorName 
                    };
                });
            } else {
                // --- LÓGICA PARA CAIXA MÓVEL (Individual) ---
                return [{ 
                    protocol: c.protocol, 
                    timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), 
                    type: 'Móvel', 
                    cpf: c.cpf, 
                    cashierName: c.cashierName, 
                    numeroMaquina: c.numeroMaquina, 
                    valorTotalVenda: c.valorTotalVenda || 0, 
                    credito: c.credito || 0, 
                    debito: c.debito || 0, 
                    pix: c.pix || 0, 
                    cashless: c.cashless || 0, 
                    valorTroco: c.valorTroco || 0, // Caixa móvel tem seu próprio troco
                    valorEstorno: (c.temEstorno ? c.valorEstorno : 0) || 0, 
                    dinheiroFisico: c.dinheiroFisico || 0, 
                    valorAcerto: c.valorAcerto || 0, 
                    diferenca: c.diferenca || 0, 
                    operatorName: c.operatorName 
                }];
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
      
      // --- MUDANÇA ---
      // Marca os itens enviados como 'synced' no localStorage
      const protocolsSynced = [...waiterData.map(w => w.protocol), ...cashierData.map(c => c.protocol)];
      const protocolSet = new Set(protocolsSynced);
      
      const allLocalClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      allLocalClosings.forEach(closing => {
          if (closing.eventName === activeEvent) {
              if (closing.type.startsWith('waiter') || closing.type === 'cashier') {
                  if (protocolSet.has(closing.protocol)) {
                      closing.synced = true;
                  }
              } else if (closing.type === 'fixed_cashier') {
                  // Se *qualquer* sub-item foi enviado, marca o grupo como synced
                  const subProtocols = closing.caixas.map((caixa, index) => caixa.protocol || `${closing.protocol}-${index + 1}`);
                  if (subProtocols.some(p => protocolSet.has(p))) {
                      closing.synced = true;
                  }
              }
          }
      });
      localStorage.setItem('localClosings', JSON.stringify(allLocalClosings));
      // Dispara o evento para o ClosingHistoryPage recarregar
      window.dispatchEvent(new Event('localDataChanged'));
      // --- FIM DA MUDANÇA ---

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