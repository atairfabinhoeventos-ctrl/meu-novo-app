// src/pages/EventSelectionPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './EventSelectionPage.css';

function EventSelectionPage() {
  const navigate = useNavigate();
  const [activeEvents, setActiveEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const loadEvents = () => {
    setIsLoading(true);
    // Simula um tempo de carregamento para feedback visual
    setTimeout(() => {
        const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
        
        const uniqueEvents = new Map();
        allEvents.forEach(evt => {
            if (evt.active && evt.name) {
                uniqueEvents.set(evt.name, evt);
            }
        });
        
        const filteredEvents = Array.from(uniqueEvents.values());
        filteredEvents.sort((a, b) => a.name.localeCompare(b.name));

        setActiveEvents(filteredEvents);
        setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadEvents();
    
    // Escuta atualizações de outras abas
    const handleStorageChange = () => loadEvents();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleSelectEvent = (event) => {
    setSelectedId(event.name);
    setTimeout(() => {
        localStorage.setItem('activeEvent', event.name); 
        window.dispatchEvent(new Event('storage'));
        navigate('/financial-selection');
    }, 150);
  };

  const handleGoToUpdate = () => {
      // Tenta enviar o state. Se a página de destino suportar, ela abrirá na aba 'events'
      navigate('/update-data', { state: { initialTab: 'events' } });
  };

  return (
    <div className="selection-wrapper">
      <div className="selection-content">
        
        {/* CABEÇALHO */}
        <div className="selection-header">
            <div className="header-top-row">
                <button onClick={() => navigate(-1)} className="back-link">
                    ⬅ Voltar
                </button>
                {/* BOTÃO ATUALIZAR EXPLÍCITO AQUI */}
                <button 
                    onClick={loadEvents} 
                    className={`btn-refresh-explicit ${isLoading ? 'loading' : ''}`}
                    disabled={isLoading}
                >
                    {isLoading ? 'Buscando...' : '🔄 Atualizar Lista'}
                </button>
            </div>
            
            <div className="header-title-block">
                <h2>Selecionar Evento</h2>
                <p>Escolha o evento ativo para prosseguir</p>
            </div>
        </div>

        {/* ÁREA DE LISTA */}
        <div className="events-list-container">
            {isLoading ? (
                <div className="state-container">
                    <div className="spinner"></div>
                    <p>Sincronizando dados...</p>
                </div>
            ) : activeEvents.length > 0 ? (
                <div className="events-grid-scroll">
                    {activeEvents.map((event, index) => (
                        <div 
                            key={event.name} 
                            className={`event-card ${selectedId === event.name ? 'selected' : ''}`}
                            onClick={() => handleSelectEvent(event)}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="event-icon-box">📅</div>
                            <div className="event-info">
                                <h3>{event.name}</h3>
                                <span className="active-tag">Disponível</span>
                            </div>
                            <div className="event-arrow">➜</div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="state-container empty">
                    <span className="emoji-large">📭</span>
                    <h3>Nenhum evento apareceu?</h3>
                    <p>Tente clicar em atualizar ou cadastre um novo.</p>
                    
                    <div className="empty-actions">
                        <button onClick={loadEvents} className="btn-action-outline">
                            🔄 Tentar Atualizar
                        </button>
                        <button onClick={handleGoToUpdate} className="btn-action-primary">
                            ➕ Cadastrar Novo Evento
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* RODAPÉ */}
        <div className="selection-footer">
            <button onClick={handleGoToUpdate} className="btn-manage-full">
                ⚙️ Gerenciar Eventos / Novo Cadastro
            </button>
        </div>

      </div>
    </div>
  );
}

export default EventSelectionPage;