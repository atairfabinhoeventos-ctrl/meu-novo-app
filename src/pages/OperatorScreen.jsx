import React, { useState, useEffect } from 'react'; // 1. Importe o useEffect
import { useNavigate } from 'react-router-dom';
import './OperatorScreen.css';
import LoadingSpinner from '../components/LoadingSpinner'; // 2. Importe o novo componente

function OperatorScreen() {
  const navigate = useNavigate();
  const [operatorName, setOperatorName] = useState('');
  const [isLoading, setIsLoading] = useState(true); // 3. Crie um estado de carregamento

  // 4. Use o useEffect para esconder o carregamento após um curto período
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // 800 milissegundos de duração

    return () => clearTimeout(timer); // Limpa o timer se o componente for desmontado
  }, []);

  const handleStart = (e) => {
    e.preventDefault();
    if (operatorName.trim() === '') {
      alert('Por favor, insira um nome.');
      return;
    }
    localStorage.setItem('loggedInUserName', operatorName.trim());
    navigate('/setup');
  };

  // 5. Renderize o LoadingSpinner ou a tela de login dependendo do estado
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