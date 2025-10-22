// src/components/Header.jsx (Com botão Trocar Evento)

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom'; //
import './Header.css'; //
import SyncStatusIndicator from './SyncStatusIndicator.jsx'; //

function Header() {
  const navigate = useNavigate(); //
  const location = useLocation(); //
  const [userName, setUserName] = useState(''); //
  const [activeEvent, setActiveEvent] = useState(''); //

  const updateHeaderInfo = () => { //
    const name = localStorage.getItem('loggedInUserName'); //
    const event = localStorage.getItem('activeEvent'); //
    setUserName(name || ''); //
    setActiveEvent(event || 'Nenhum Evento'); //
  };

  useEffect(() => { //
    updateHeaderInfo(); //
    window.addEventListener('storage', updateHeaderInfo); //
    return () => { //
      window.removeEventListener('storage', updateHeaderInfo); //
    };
  }, [location]); //

  const handleLogout = () => { //
    if (window.confirm('Tem certeza que deseja sair?')) { //
      localStorage.removeItem('loggedInUserName'); //
      localStorage.removeItem('activeEvent'); //
      navigate('/'); //
    }
  };

  // --- NOVA FUNÇÃO ---
  const handleSwitchEvent = () => {
    // Apenas navega para a tela de setup. A SetupPage.jsx já lida com a seleção.
    navigate('/setup');
  };
  // --- FIM DA NOVA FUNÇÃO ---

  return (
    <header className="app-header"> {/* */}
      <div className="header-left"> {/* */}
          {/* 1. Bloco com informações de Usuário/Evento */}
          <div className="user-event-details"> {/* */}
            <p className="user-info">Usuário: <strong>{userName}</strong></p> {/* */}
            <p className="user-info">Evento: <strong>{activeEvent}</strong></p> {/* */}
          </div>

          {/* 2. Indicadores posicionados ABAIXO do bloco acima */}
          <SyncStatusIndicator /> {/* */}
      </div>
      <div className="header-center"> {/* */}
        <Link to="/dashboard" className="header-logo-link" title="Voltar ao Painel de Controle"> {/* */}
          <img src="logo2.png" alt="Logo - Voltar ao Início" className="header-logo-img" /> {/* */}
        </Link>
      </div>
      <div className="header-right"> {/* */}
        {/* --- NOVO BOTÃO ADICIONADO --- */}
        <button onClick={handleSwitchEvent} className="switch-event-button" title="Selecionar outro evento">
           🔄 Trocar Evento
        </button>
        {/* --- FIM DO NOVO BOTÃO --- */}
        <button onClick={handleLogout} className="logout-button">Sair do Sistema</button> {/* */}
      </div>
    </header>
  );
}

export default Header; //