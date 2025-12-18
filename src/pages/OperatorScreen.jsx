// src/pages/OperatorScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import './OperatorScreen.css';

function OperatorScreen() {
  const navigate = useNavigate();
  const [operatorName, setOperatorName] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const handleNameChange = (e) => {
    const rawValue = e.target.value;
    const formattedValue = rawValue
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    setOperatorName(formattedValue);
  };

  const handleStart = (e) => {
    e.preventDefault();
    if (operatorName.trim() === '') {
      alert('Por favor, insira um nome.');
      return;
    }
    if (!isAgreed) {
      alert('Você precisa concordar com os termos de coleta de dados para continuar.');
      return;
    }
    localStorage.setItem('loggedInUserName', operatorName.trim());
    navigate('/setup');
  };

  if (isLoading) {
    return <LoadingSpinner message="Iniciando sistema..." />;
  }

  return (
    <div className="op-screen-wrapper">
      <div className="op-card-refined">
        
        <div className="op-branding-side">
          <img src="logo2.png" alt="SisFO Logo" className="op-logo-refined" />
          <h1 className="op-title-refined">SisFO</h1>
          <div className="op-divider-refined"></div>
          <p className="op-subtitle-refined">Sistema de Fechamento Operacional</p>
        </div>

        <div className="op-form-side">
          <div className="op-header-refined">
            <h2 className="op-welcome-refined">Identificação</h2>
            <p className="op-instruction-refined">Bem-vindo! Identifique-se para acessar.</p>
          </div>

          <form onSubmit={handleStart} className="op-action-area">
            <div className="op-input-container">
              <label htmlFor="operatorName" className="op-label-refined">NOME DO OPERADOR</label>
              <div className="op-input-wrapper">
                <span className="op-input-icon">👤</span>
                <input
                  ref={inputRef}
                  id="operatorName"
                  type="text"
                  className="op-input-field"
                  value={operatorName}
                  onChange={handleNameChange}
                  placeholder="Nome completo..."
                  required
                />
              </div>
            </div>

            <div className="lgpd-container">
              <label className="lgpd-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={isAgreed} 
                  onChange={(e) => setIsAgreed(e.target.checked)} 
                />
                <span className="lgpd-text">
                  Concordo com a coleta de dados. 
                  <button type="button" className="lgpd-link" onClick={() => setShowTerms(true)}>
                    Leia os Termos de Privacidade
                  </button>
                </span>
              </label>
            </div>

            <button type="submit" className={`op-btn-primary-refined ${!isAgreed ? 'btn-disabled' : ''}`}>
              <span>Acessar Sistema</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        </div>
      </div>

      {showTerms && (
        <div className="lgpd-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="lgpd-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="lgpd-modal-header">
              <h3>Privacidade e Proteção de Dados (LGPD)</h3>
              <button className="close-modal-btn" onClick={() => setShowTerms(false)}>×</button>
            </div>
            <div className="lgpd-modal-body">
              <p><strong>1. Restrição de Tratamento:</strong> Todos os dados coletados por este sistema são estritamente restritos ao tratamento operacional interno. O SisFO utiliza criptografia e protocolos de segurança para garantir que as informações não sejam acessadas por pessoas não autorizadas.</p>
              
              <p><strong>2. Dados de Terceiros:</strong> Durante o processo de fechamento financeiro, o sistema processa dados de terceiros (colaboradores e prestadores de serviço). Fica estabelecido que a coleta desses dados é <strong>exclusiva para a finalidade de fechamento e prestação de contas</strong>, sendo vedado o uso para qualquer outro fim ou compartilhamento externo.</p>
              
              <p><strong>3. Dados do Operador:</strong> Seu nome é registrado exclusivamente para fins de auditoria, permitindo identificar o responsável pela abertura e validação de cada fechamento financeiro.</p>
              
              <p><strong>4. Conformidade Legal:</strong> Este software opera em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), assegurando os direitos de transparência, segurança e limitação de uso.</p>
            </div>
            <button className="lgpd-modal-close-btn" onClick={() => setShowTerms(false)}>Entendido e Ciente</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperatorScreen;