// src/pages/LoginPage.jsx (Com identidade visual do SisFO)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Mantenha o App.css para estilos gerais
import './LoginPage.css'; // Usaremos este para estilos específicos do login

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Redireciona se já estiver logado (e tiver um evento ativo)
    const loggedInUser = localStorage.getItem('loggedInUserName');
    const activeEvent = localStorage.getItem('activeEvent');
    if (loggedInUser && activeEvent) {
      navigate('/dashboard');
    } else if (loggedInUser) {
        navigate('/event-selection');
    }
  }, [navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError(''); // Limpa erros anteriores

    // Lógica de autenticação simplificada (pode ser expandida depois)
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('loggedInUserName', username);
      // Verifica se há eventos cadastrados.
      // Se não houver, ou se for a primeira vez, direciona para o cadastro/seleção
      const masterEvents = JSON.parse(localStorage.getItem('master_events')) || [];
      const activeEvents = masterEvents.filter(event => event.active);
      
      if (activeEvents.length === 0) {
        // Se não há eventos ativos, vai para a página de atualização para cadastrar/ativar
        navigate('/update-data');
        alert('Bem-vindo(a) ao SisFO! Por favor, cadastre ou ative um evento para começar.');
      } else {
        // Se já tem eventos, vai para a seleção de eventos
        navigate('/event-selection');
      }
    } else {
      setError('Usuário ou senha inválidos.');
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-form">
        <div className="system-identity">
          <p className="system-tagline">Bem-vindo(a) ao</p>
          <h1 className="system-name">Sistema de Fechamento Operacional</h1>
          <h2 className="system-abbreviation">SisFO</h2>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Usuário:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Senha:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">Entrar</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;