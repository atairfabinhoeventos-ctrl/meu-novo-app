// src/components/Header.jsx (VERSÃO CORRIGIDA PARA USAR A PASTA 'public/')

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import './Header.css';

// GARANTA QUE NÃO HÁ NENHUM 'import logoSisFO ...' AQUI EM CIMA

function Header() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [userName, setUserName] = useState('');
  const [activeEvent, setActiveEvent] = useState('');

  const updateHeaderInfo = () => {
    const name = localStorage.getItem('loggedInUserName');
    const event = localStorage.getItem('activeEvent');
    setUserName(name || '');
    setActiveEvent(event || 'Nenhum Evento');
  };

  useEffect(() => {
    updateHeaderInfo();
    window.addEventListener('storage', updateHeaderInfo);
    return () => {
      window.removeEventListener('storage', updateHeaderInfo);
    };
  }, [location]); 

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
          {/* AQUI ESTÁ A CORREÇÃO: 
            Removemos a barra '/' do início do 'src'.
            Isso torna o caminho relativo e funciona no .exe
          */}
          <img src="logo2.png" alt="Logo - Voltar ao Início" className="header-logo-img" />
        </Link>
      </div>
      <div className="header-right">
        <button onClick={handleLogout} className="logout-button">Sair do Sistema</button>
      </div>
    </header>
  );
}

export default Header;