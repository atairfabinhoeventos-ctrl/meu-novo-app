// src/pages/SetupPage.jsx (VERSÃO MAIS INTUITIVA - Botão Gerenciar Ajustado)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import './SetupPage.css'; //

function SetupPage() {
  const navigate = useNavigate(); //
  const [events, setEvents] = useState([]); //
  const [selectedEvent, setSelectedEvent] = useState(''); //
  const operatorName = localStorage.getItem('loggedInUserName') || 'Operador'; //

  useEffect(() => { //
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || []; //
    const activeEvents = allEvents.filter(event => event.active); //
    setEvents(activeEvents); //

    const previouslySelected = localStorage.getItem('activeEvent'); //
    if (previouslySelected) { //
        // localStorage.removeItem('activeEvent');
        // window.dispatchEvent(new Event('storage'));
    }

  }, []); //

  const handleEnterEvent = () => { //
    if (!selectedEvent) { //
      alert('Por favor, selecione um evento para continuar.'); //
      return; //
    }
    localStorage.setItem('activeEvent', selectedEvent); //
    window.dispatchEvent(new Event('storage')); //
    navigate('/dashboard'); //
  };

  return ( //
    <div className="setup-container"> {/* */}
      <div className="setup-card"> {/* */}
        <h1 className="setup-title">Bem-vindo(a), {operatorName}!</h1> {/* */}
        <p className="setup-subtitle" style={{ marginBottom: '40px' }}> {/* */}
          Selecione o evento ativo para iniciar a sessão.
        </p>

        {/* --- Seção Principal: Seleção de Evento --- */}
        <div className="input-group" style={{ marginBottom: '30px' }}> {/* */}
          <label htmlFor="event-select" style={{ fontWeight: '600' }}>Evento Ativo:</label> {/* */}
          <select
            id="event-select"
            className="event-select" //
            value={selectedEvent} //
            onChange={(e) => setSelectedEvent(e.target.value)} //
            disabled={events.length === 0} // Desabilita se não houver eventos //
            style={{ marginTop: '8px' }} // Pequeno ajuste de espaço //
          >
            <option value="">-- Escolha um evento --</option> {/* */}
            {events.length > 0 ? ( //
              events.map(event => ( //
                <option key={event.name} value={event.name}>{event.name}</option> //
              ))
            ) : ( //
              <option value="" disabled>Nenhum evento ativo cadastrado</option> //
            )}
          </select>
        </div>

        {events.length === 0 && ( //
          <p className="error-message" style={{ textAlign: 'center', marginBottom: '25px', fontSize: '1em' }}> {/* */}
            Não há eventos ativos disponíveis. Utilize o botão "Gerenciar" abaixo para adicionar ou ativar eventos.
          </p>
        )}

        {/* Botão Principal de Ação */}
        <button
          className="login-button" //
          style={{ width: '100%', marginBottom: '20px' }} // Garante largura total //
          onClick={handleEnterEvent} //
          disabled={!selectedEvent || events.length === 0} // Desabilitado se nada selecionado ou lista vazia //
        >
          Entrar no Evento
        </button>

        {/* --- BOTÃO SECUNDÁRIO MODIFICADO --- */}
        <button
          className="setup-button secondary" // Alterado de link-button para setup-button secondary
          // style={{ fontSize: '0.95em' }} // Removido estilo inline de fonte
          onClick={() => navigate('/update-data')}
         >
              ⚙️ Gerenciar Eventos/Funcionários
         </button>
        {/* --- FIM DA MODIFICAÇÃO --- */}

      </div>
    </div>
  );
}

export default SetupPage; //