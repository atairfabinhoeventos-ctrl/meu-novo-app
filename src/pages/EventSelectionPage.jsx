// src/pages/EventSelectionPage.jsx (VERSÃO COMPLETA E ATUALIZADA)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

function EventSelectionPage() {
  const navigate = useNavigate();
  const [activeEvents, setActiveEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carrega a lista completa de objetos de evento do localStorage
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    
    // Filtra para mostrar apenas os eventos que têm a propriedade 'active: true'
    const filteredEvents = allEvents.filter(event => event.active);
    
    setActiveEvents(filteredEvents);
    setIsLoading(false);

    if (filteredEvents.length === 0) {
        alert('Nenhum evento ativo encontrado. Por favor, cadastre ou ative eventos na tela de "Atualizar Dados".');
    }
  }, []);

  const handleSelectEvent = (event) => {
    // Salva apenas o nome do evento no localStorage para ser usado em outras telas
    localStorage.setItem('activeEvent', event.name); 
    // Dispara um evento para que o Header atualize a informação em tempo real
    window.dispatchEvent(new Event('storage'));
    navigate('/financial-selection');
  };

  if (isLoading) {
    return <div className="app-container"><h1>Carregando eventos...</h1></div>;
  }

  return (
    <div className="app-container">
      <div className="login-form" style={{ maxWidth: '600px' }}>
        {/* --- BOTÃO VOLTAR ADICIONADO AQUI --- */}
        <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
        
        <h1>Selecione um Evento Ativo</h1>
        
        {activeEvents.length > 0 ? (
          activeEvents.map(event => (
            <button 
              key={event.name} 
              className="login-button" 
              style={{ marginBottom: '15px' }}
              onClick={() => handleSelectEvent(event)}
            >
              {event.name}
            </button>
          ))
        ) : (
          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            Nenhum evento ativo disponível. Vá para "Atualizar Dados" para gerenciar.
          </p>
        )}
      </div>
    </div>
  );
}

export default EventSelectionPage;