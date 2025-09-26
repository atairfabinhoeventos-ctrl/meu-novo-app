// src/pages/OperatorScreen.jsx (Com nova identidade visual SisFO)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OperatorScreen.css'; // Vamos criar este novo arquivo CSS

function OperatorScreen() {
  const navigate = useNavigate();
  const [operatorName, setOperatorName] = useState('');

  const handleStart = (e) => {
    e.preventDefault();
    if (operatorName.trim() === '') {
      alert('Por favor, insira um nome.');
      return;
    }
    localStorage.setItem('loggedInUserName', operatorName.trim());
    navigate('/dashboard');
  };

  return (
    <div className="operator-screen-container">
      {/* Coluna da Esquerda: Identidade Visual */}
      <div className="branding-section">
        <img src="/logo2.png" alt="Logo SisFO" className="branding-logo" />
        <h1 className="branding-title">SisFO</h1>
        <p className="branding-subtitle">Sistema de Fechamento Operacional</p>
      </div>

      {/* Coluna da Direita: Interação */}
      <div className="form-section">
        <div className="form-content">
          <h2>Identificação do Operador</h2>
          <p>Digite seu nome para iniciar o sistema.</p>
          <form onSubmit={handleStart}>
            <div className="input-group">
              <label htmlFor="operatorName">Seu Nome:</label>
              <input
                id="operatorName"
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Digite seu nome completo"
                required
              />
            </div>
            <button type="submit" className="start-button">
              Iniciar Sessão
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default OperatorScreen;