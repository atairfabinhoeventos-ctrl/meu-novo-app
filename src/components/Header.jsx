// src/components/Header.jsx (VERSÃO CORRIGIDA PARA ATUALIZAÇÃO AUTOMÁTICA)

import React, { useState, useEffect } from 'react';
// 1. IMPORTE O 'useLocation' JUNTO COM OS OUTROS HOOKS
import { useNavigate, Link, useLocation } from 'react-router-dom';
import './Header.css';

function Header() {
  const navigate = useNavigate();
  const location = useLocation(); // 2. INICIALIZE O HOOK useLocation
  const [userName, setUserName] = useState('');
  const [activeEvent, setActiveEvent] = useState('');

  const updateHeaderInfo = () => {
    const name = localStorage.getItem('loggedInUserName');
    const event = localStorage.getItem('activeEvent');
    setUserName(name || '');
    setActiveEvent(event || 'Nenhum Evento');
  };

  useEffect(() => {
    // Esta função agora será chamada sempre que a URL (location) mudar
    updateHeaderInfo();

    // O listener de 'storage' é mantido para consistência, caso necessário no futuro
    window.addEventListener('storage', updateHeaderInfo);
    return () => {
      window.removeEventListener('storage', updateHeaderInfo);
    };
  }, [location]); // 3. ADICIONE 'location' COMO DEPENDÊNCIA DO useEffect

  const handleLogout = () => {
    if (window.confirm('Tem certeza que deseja sair?')) {
      localStorage.removeItem('loggedInUserName');
      localStorage.removeItem('activeEvent'); 
      navigate('/');
    }
  };
  
  return (
    <header className="app-header">
      <div className="header-left">
        <p className="user-info">Usuário: <strong>{userName}</strong></p>
        <p className="user-info">Evento: <strong>{activeEvent}</strong></p>
      </div>
      <div className="header-center">
        <Link to="/dashboard" className="header-logo-link" title="Voltar ao Painel de Controle">
          <img src="/logo2.png" alt="Logo - Voltar ao Início" className="header-logo-img" />
        </Link>
      </div>
      <div className="header-right">
        <button onClick={handleLogout} className="logout-button">Sair do Sistema</button>
      </div>
    </header>
  );
}

export default Header;