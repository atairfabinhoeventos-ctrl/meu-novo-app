// src/pages/SetupPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import './SetupPage.css';

function SetupPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const operatorName = localStorage.getItem('loggedInUserName') || 'Operador';

  const loadEvents = () => {
    setIsLoading(true);
    setTimeout(() => {
      const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
      const activeEvents = allEvents.filter(event => event.active);
      setEvents(activeEvents);
      setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleRefresh = (e) => {
    e.preventDefault();
    loadEvents();
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
        {/* LADO ESQUERDO: BRANDING (#0e1b2a) */}
        <div className="card-left">
          <img src="logo2.png" alt="Logo SisFO" className="brand-logo-img" />
          <h1 className="brand-title">SisFO</h1>
          <p className="brand-desc">Sistema de Fechamento Operacional</p>
        </div>

        {/* LADO DIREITO: SELEÇÃO */}
        <div className="card-right">
          <div className="form-header">
            <h2 className="welcome-title">Olá, {operatorName}</h2>
            <p className="instruction-text">Selecione o evento para começar o trabalho.</p>
          </div>

          <div className="input-group">
            <label htmlFor="eventSelect" className="label-text">Evento Ativo:</label>
            <select
              id="eventSelect"
              className="std-input"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">Selecione um evento...</option>
              {events.map(event => (
                <option key={event.name} value={event.name}>{event.name}</option>
              ))}
            </select>
            
            <button className="btn-refresh-inline" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? '...' : '🔄 Atualizar Lista'}
            </button>
          </div>

          <div className="action-area">
            <button
              className="primary-btn"
              onClick={handleEnterEvent}
              disabled={!selectedEvent || isLoading}
            >
              <span>Acessar Painel</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>

            <div className="divider">
              <span>ADMINISTRAÇÃO</span>
            </div>

            <button
              className="secondary-btn"
              /* Envia o estado para abrir na aba Eventos */
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