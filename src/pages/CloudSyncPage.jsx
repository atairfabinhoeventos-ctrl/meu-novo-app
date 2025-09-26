// src/pages/CloudSyncPage.jsx (Com envio de protocolo e feedback aprimorado)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import './CloudSyncPage.css';

function CloudSyncPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const activeEvents = allEvents.filter(event => event.active);
    setEvents(activeEvents);
  }, []);

  const handleCloudSync = async () => {
    if (!selectedEvent) { alert('Por favor, selecione um evento.'); return; }
    setIsLoading(true);
    setFeedback(`Enviando dados do evento "${selectedEvent}" para a nuvem...`);

    try {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allClosings.filter(c => c.eventName === selectedEvent);

      const waiterClosings = eventClosings.filter(c => c.waiterName);
      const cashierClosings = eventClosings.filter(c => c.cashierName || c.caixas);
      
      // --- ALTERAÇÃO AQUI: Adicionado "PROTOCOLO" ao cabeçalho e aos dados ---
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

      // Envia para o backend
      const response = await axios.post(`${API_URL}/api/cloud-sync`, {
        eventName: selectedEvent,
        waiterData: { header: waiterHeader, data: waiterData },
        cashierData: { header: cashierHeader, data: cashierData }
      });
      
      // --- ALTERAÇÃO AQUI: Usa a nova mensagem de feedback do backend ---
      setFeedback(response.data.message.replace(/\n/g, '<br/>')); // Exibe a mensagem com quebras de linha
      alert('Sincronização Concluída!');

    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      const errorMessage = error.response?.data?.message || 'Falha na comunicação com o servidor.';
      setFeedback(`Erro: ${errorMessage}`);
      alert('Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cloud-sync-container">
      <div className="cloud-sync-card">
        <h1>☁️ Enviar Dados para Nuvem</h1>
        <p>Selecione um evento para enviar todos os seus fechamentos salvos localmente para a planilha consolidada online.</p>
        
        <div className="input-group">
          <label>Selecione o Evento:</label>
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
            <option value="">-- Escolha um evento --</option>
            {events.map(event => <option key={event.name} value={event.name}>{event.name}</option>)}
          </select>
        </div>
        
        <button onClick={handleCloudSync} disabled={isLoading || !selectedEvent}>
          {isLoading ? 'Enviando...' : 'Iniciar Envio para Nuvem'}
        </button>

        {/* --- ALTERAÇÃO AQUI: Permite que o feedback exiba HTML (quebras de linha) --- */}
        {feedback && <p className="feedback-message" dangerouslySetInnerHTML={{ __html: feedback }}></p>}
      </div>
    </div>
  );
}

export default CloudSyncPage;