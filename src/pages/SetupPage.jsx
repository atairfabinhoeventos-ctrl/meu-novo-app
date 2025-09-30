import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SetupPage.css';

function SetupPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const operatorName = localStorage.getItem('loggedInUserName') || 'Operador';

  useEffect(() => {
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const activeEvents = allEvents.filter(event => event.active);
    setEvents(activeEvents);
  }, []);

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
        <h1 className="setup-title">Bem-vindo(a), {operatorName}!</h1>
        <p className="setup-subtitle">Prepare seu ambiente de trabalho para iniciar a sessão.</p>

        <div className="setup-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h2>Atualizar Dados</h2>
            <p>Se necessário, sincronize ou importe os cadastros de garçons e eventos antes de começar.</p>
            <button className="setup-button secondary" onClick={() => navigate('/update-data')}>
              ⚙️ Acessar Gerenciador de Dados
            </button>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h2>Selecionar Evento</h2>
            <p>Escolha o evento em que você irá trabalhar.</p>
            <select 
              className="event-select"
              value={selectedEvent} 
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              <option value="">-- Escolha um evento --</option>
              {events.map(event => (
                <option key={event.name} value={event.name}>{event.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          className="setup-button primary" 
          onClick={handleEnterEvent} 
          disabled={!selectedEvent}
        >
          Entrar no Evento 
        </button>
      </div>
    </div>
  );
}

export default SetupPage;