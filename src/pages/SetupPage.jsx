import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backgroundDownloadMasterData } from '../services/syncService';
import '../App.css';
import './SetupPage.css';

function SetupPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const operatorName = localStorage.getItem('loggedInUserName') || 'Operador';

  const loadEventsFromStorage = () => {
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const activeEvents = allEvents.filter(event => event.active);
    setEvents(activeEvents);
  };

  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  const handleRefresh = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await backgroundDownloadMasterData();
      loadEventsFromStorage();
    } catch (error) {
      console.error("Erro ao atualizar eventos:", error);
      alert("Não foi possível buscar novos eventos. Verifique sua internet.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterEvent = () => {
    if (!selectedEvent) {
      alert('Por favor, selecione um evento para continuar.');
      return;
    }
    localStorage.setItem('activeEvent', selectedEvent);
    navigate('/dashboard');
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        {/* LADO ESQUERDO */}
        <div className="card-left">
          <div className="brand-header">
            {/* Logo 2x maior definida no CSS (.setup-logo) */}
            <img src="/logo2.png" alt="SisFO Logo" className="setup-logo" />
            <h1>SisFO</h1>
            <p>Sistema de Fechamento Operacional</p>
          </div>
          <div className="welcome-box">
            <span>Operador Identificado:</span>
            <h2>{operatorName}</h2>
          </div>
        </div>

        {/* LADO DIREITO */}
        <div className="card-right">
          <h2>Configuração de Acesso</h2>
          <p>Selecione o evento ativo na lista abaixo para carregar as tabelas de preços e configurações.</p>

          <div className="form-group">
            <label>Evento Disponível</label>
            <select
              className="std-select"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">Selecione um evento...</option>
              {events.map(event => (
                <option key={event.name} value={event.name}>{event.name}</option>
              ))}
            </select>
            
            {/* BOTÃO MELHORADO: Outline azul com ícone */}
            <button 
              className="btn-refresh-inline" 
              onClick={handleRefresh} 
              disabled={isLoading}
              title="Baixar lista atualizada da nuvem"
            >
              {/* O ícone gira se isLoading for true */}
              <span className={isLoading ? 'spin-icon' : ''}>
                {isLoading ? '⏳' : '☁️'}
              </span>
              {isLoading ? 'Buscando na Nuvem...' : 'Sincronizar Lista (Online)'}
            </button>
          </div>

          <div className="action-area">
            <button
              className="primary-btn"
              onClick={handleEnterEvent}
              disabled={!selectedEvent || isLoading}
            >
              <span>Acessar Painel</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <div className="divider">
              <span>OU</span>
            </div>

            <button
              className="secondary-btn"
              onClick={() => navigate('/update-data', { state: { activeTab: 'eventos' } })}
            >
              ⚙️ Gerenciar Eventos / Funcionários
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupPage;