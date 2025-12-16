// src/pages/CloudSyncPage.jsx (VERSÃO FINAL: TIPOS EXPLICITOS 8% e 10%)
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
    console.log(`[CloudSync] URL da API carregada: ${API_URL}`);
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

      // --- 1. MAPEAMENTO DE GARÇONS ---
      const waiterData = eventClosings
        .filter(c => c.type && c.type.startsWith('waiter'))
        .map(c => {
            // Valores base
            const vTotal = Number(c.valorTotal || 0);
            const vEstorno = c.temEstorno ? Number(c.valorEstorno || 0) : 0;
            const vCashless = Number(c.cashless || 0);
            
            let valComissao8 = Number(c.comissao8 || 0);
            let valComissao10 = Number(c.comissao10 || 0);
            let valComissao4 = Number(c.comissao4 || 0);
            
            // --- DEFINIÇÃO DO TIPO PARA EXIBIÇÃO NA PLANILHA ---
            let displayType = 'Garçom 8%'; // Padrão
            
            if (c.type === 'waiter_zig') {
                displayType = 'Garçom ZIG';
            } else if (c.subType === '10_percent') {
                displayType = 'Garçom 10%';
            } else {
                displayType = 'Garçom 8%';
            }
            // ---------------------------------------------------
            
            // Recálculo de Segurança (se for registro antigo)
            if (valComissao8 === 0 && valComissao10 === 0 && valComissao4 === 0) {
                const vendaLiquida = (vTotal - vEstorno) - vCashless;
                valComissao4 = vCashless * 0.04;
                
                if (c.subType === '10_percent') {
                    valComissao10 = vendaLiquida * 0.10;
                } else {
                    valComissao8 = vendaLiquida * 0.08;
                }
            }

            return {
                type: displayType, // Envia o texto bonitinho ("Garçom 10%" ou "Garçom 8%")
                timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
                protocol: c.protocol,
                cpf: c.cpf, 
                waiterName: c.waiterName,
                numeroMaquina: c.numeroMaquina,
                
                valorTotal: vTotal,
                credito: Number(c.credito || 0),
                debito: Number(c.debito || 0),
                pix: Number(c.pix || 0),
                cashless: vCashless, 
                valorTotalProdutos: Number(c.valorTotalProdutos || 0), 
                valorEstorno: vEstorno,
                
                comissao8: valComissao8,
                comissao10: valComissao10,
                comissao4: valComissao4,
                comissaoTotal: Number(c.comissaoTotal || (valComissao8 + valComissao10 + valComissao4)),
                
                diferencaLabel: c.diferencaLabel, 
                diferencaPagarReceber: Number(c.diferencaPagarReceber || 0),
                operatorName: c.operatorName
            };
        });

      // --- 2. MAPEAMENTO DE CAIXAS ---
      const cashierData = eventClosings
        .filter(c => c.type === 'cashier' || Array.isArray(c.caixas))
        .flatMap(c => {
            if (Array.isArray(c.caixas)) {
                return c.caixas.map((caixa, index) => {
                    const acertoCaixa = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                    const diferencaCaixa = (caixa.dinheiroFisico || 0) - acertoCaixa;
                    return { 
                        protocol: caixa.protocol || `${c.protocol}-${index + 1}`,
                        timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), 
                        type: 'Fixo', 
                        cpf: caixa.cpf, cashierName: caixa.cashierName, numeroMaquina: caixa.numeroMaquina, 
                        valorTotalVenda: Number(caixa.valorTotalVenda || 0), credito: Number(caixa.credito || 0), debito: Number(caixa.debito || 0), pix: Number(caixa.pix || 0), cashless: Number(caixa.cashless || 0), 
                        valorTroco: index === 0 ? Number(c.valorTroco || 0) : 0, valorEstorno: (caixa.temEstorno ? Number(caixa.valorEstorno) : 0), dinheiroFisico: Number(caixa.dinheiroFisico || 0), 
                        valorAcerto: Number(acertoCaixa), diferenca: Number(diferencaCaixa), operatorName: c.operatorName 
                    };
                });
            } else {
                return [{ 
                    protocol: c.protocol, timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), type: 'Móvel', 
                    cpf: c.cpf, cashierName: c.cashierName, numeroMaquina: c.numeroMaquina, 
                    valorTotalVenda: Number(c.valorTotalVenda || 0), credito: Number(c.credito || 0), debito: Number(c.debito || 0), pix: Number(c.pix || 0), cashless: Number(c.cashless || 0), 
                    valorTroco: Number(c.valorTroco || 0), valorEstorno: (c.temEstorno ? Number(c.valorEstorno) : 0), dinheiroFisico: Number(c.dinheiroFisico || 0), valorAcerto: Number(c.valorAcerto || 0), diferenca: Number(c.diferenca || 0), operatorName: c.operatorName 
                }];
            }
        });

      // ENVIO
      const url = `${API_URL}/api/cloud-sync`;
      const payload = { eventName: activeEvent, waiterData, cashierData };

      const response = await axios.post(url, payload);
      const { newWaiters, updatedWaiters, newCashiers, updatedCashiers } = response.data;
      
      let messageParts = [];
      if (newWaiters > 0) messageParts.push(`- ${newWaiters} novo(s) fechamento(s) de garçom enviados.`);
      if (updatedWaiters > 0) messageParts.push(`- ${updatedWaiters} fechamento(s) de garçom atualizados.`);
      if (newCashiers > 0) messageParts.push(`- ${newCashiers} novo(s) fechamento(s) de caixa enviados.`);
      if (updatedCashiers > 0) messageParts.push(`- ${updatedCashiers} fechamento(s) de caixa atualizados.`);
      
      const protocolsSynced = new Set([...waiterData.map(w => w.protocol), ...cashierData.map(c => c.protocol)]);
      
      const allLocalClosingsUpdate = JSON.parse(localStorage.getItem('localClosings')) || [];
      const updatedLocals = allLocalClosingsUpdate.map(closing => {
          if (closing.eventName === activeEvent) {
              if (closing.type.startsWith('waiter') || closing.type === 'cashier') {
                  if (protocolsSynced.has(closing.protocol)) return { ...closing, synced: true };
              } else if (closing.type === 'fixed_cashier') {
                  const subProtocols = closing.caixas.map((caixa, index) => caixa.protocol || `${closing.protocol}-${index + 1}`);
                  if (subProtocols.some(p => protocolsSynced.has(p))) return { ...closing, synced: true };
              }
          }
          return closing;
      });
      
      localStorage.setItem('localClosings', JSON.stringify(updatedLocals));
      window.dispatchEvent(new Event('localDataChanged'));

      if (messageParts.length === 0) {
        setFeedbackModal({ isOpen: true, title: 'Tudo Certo!', message: 'Todos os dados locais já estavam sincronizados.', status: 'success' });
      } else {
        setFeedbackModal({ isOpen: true, title: 'Sincronização Concluída!', message: messageParts.join('<br/>'), status: 'success' });
      }

    } catch (error) {
      console.error("[SYNC-FRONTEND-ERRO] Falha na requisição:", error);
      const errorMessage = error.response?.data?.message || 'Falha na comunicação com o servidor. Tente novamente.';
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
      <FeedbackModal isOpen={feedbackModal.isOpen} onClose={closeFeedbackModal} title={feedbackModal.title} message={feedbackModal.message} status={feedbackModal.status} />
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