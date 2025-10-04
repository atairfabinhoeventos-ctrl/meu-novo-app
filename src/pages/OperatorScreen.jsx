import React, { useState, useEffect, useRef } from 'react'; // Passo 1: Importe o useRef
import { useNavigate } from 'react-router-dom';
import './OperatorScreen.css';
import LoadingSpinner from '../components/LoadingSpinner';

function OperatorScreen() {
  const navigate = useNavigate();
  const [operatorName, setOperatorName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef(null); // Passo 2: Crie a referência

  // Este useEffect controla a duração do spinner
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Passo 4: Este novo useEffect foca no input quando o spinner some
  useEffect(() => {
    if (!isLoading) {
      // Verifica se o input já existe na tela antes de tentar focar
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isLoading]); // A dependência é `isLoading`

  const handleStart = (e) => {
    e.preventDefault();
    if (operatorName.trim() === '') {
      alert('Por favor, insira um nome.');
      return;
    }
    localStorage.setItem('loggedInUserName', operatorName.trim());
    navigate('/setup');
  };
  
  if (isLoading) {
    return <LoadingSpinner message="Iniciando sistema..." />;
  }

  return (
    <div className="operator-screen-container">
      <div className="branding-section">
        <img src="/logo2.png" alt="Logo SisFO" className="branding-logo" />
        <h1 className="branding-title">SisFO</h1>
        <p className="branding-subtitle">Sistema de Fechamento Operacional</p>
      </div>

      <div className="form-section">
        <div className="form-content">
          <h2>Identificação do Operador</h2>
          <p>Digite seu nome para iniciar o sistema.</p>
          <form onSubmit={handleStart}>
            <div className="input-group">
              <label htmlFor="operatorName">Seu Nome:</label>
              <input
                ref={inputRef} // Passo 3: Anexe a referência aqui
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