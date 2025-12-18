// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; 
import './LoginPage.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const loggedInUser = localStorage.getItem('loggedInUserName');
    const activeEvent = localStorage.getItem('activeEvent');
    
    if (loggedInUser && activeEvent) {
      navigate('/dashboard');
    } else if (loggedInUser) {
        navigate('/event-selection');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('loggedInUserName', username);
        
        const masterEvents = JSON.parse(localStorage.getItem('master_events')) || [];
        const activeEvents = masterEvents.filter(event => event.active);
        
        if (activeEvents.length === 0) {
          navigate('/update-data');
        } else {
          navigate('/event-selection');
        }
      } else {
        setError('Usuário ou senha inválidos.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="login-wrapper">
      <div className="login-content">
        
        {/* CABEÇALHO IGUAL AO SELECTION */}
        <div className="login-header">
            <img src="/logo2.png" alt="SisFO Logo" className="login-logo-img" />
            <div className="header-title-block">
                <h2>SisFO</h2>
                <p>Sistema de Fechamento Operacional</p>
            </div>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleLogin} className="login-form-body">
          <div className="input-group">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              placeholder="Digite seu usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="std-input"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Senha</label>
            <div className="password-std-wrapper">
                <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="std-input password-field"
                required
                />
                <button 
                    type="button" 
                    className="toggle-std-btn"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? "Ocultar" : "Mostrar"}
                </button>
            </div>
          </div>

          {error && <div className="std-error-banner">{error}</div>}

          <button type="submit" className="btn-primary-std" disabled={isLoading}>
            {isLoading ? <span className="spinner-std"></span> : 'Acessar Sistema'}
          </button>
        </form>

        <div className="login-footer-std">
          <p>&copy; {new Date().getFullYear()} Fabinho Eventos</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;