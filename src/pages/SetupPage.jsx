// src/pages/SetupPage.jsx
// VERSÃO: LOGOS +30% MAIORES & SINCRONIZAÇÃO INVISÍVEL

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backgroundDownloadMasterData } from '../services/syncService';
import '../App.css';
import './SetupPage.css';

function SetupPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const operatorName = localStorage.getItem('loggedInUserName') || 'Operador';

  // Carrega imediatamente o que tem no cache local (0 segundos)
  const loadEventsFromStorage = () => {
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const activeEvents = allEvents.filter(event => event.active);
    setEvents(activeEvents);
    return activeEvents.length > 0;
  };

  // EFEITO: Sincronização Invisível ao abrir a tela
  useEffect(() => {
    loadEventsFromStorage();

    const autoSyncOnStart = async () => {
      setIsSyncing(true); // Gira apenas o ícone, não trava a tela
      try {
        await backgroundDownloadMasterData();
        loadEventsFromStorage(); // Atualiza a lista na tela silenciosamente quando acabar
      } catch (error) {
        console.warn("Sem internet ou erro no servidor. Usando dados locais.");
      } finally {
        setIsSyncing(false);
      }
    };

    autoSyncOnStart();
  }, []);

  const handleRefresh = async (e) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      await backgroundDownloadMasterData();
      loadEventsFromStorage();
    } catch (error) {
      console.error("Erro ao atualizar eventos:", error);
      alert("Não foi possível buscar novos eventos. Verifique sua internet.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEnterEvent = () => {
    if (!selectedEvent) {
      alert('Por favor, selecione um evento para continuar.');
      return;
    }
    localStorage.setItem('activeEvent', selectedEvent);
    navigate('/financial-selection');
  };

  // Bloqueio total apenas se não houver dados nenhuns E estiver sincronizando
  const isLocked = events.length === 0 && isSyncing;

  return (
    <div className="setup-container">
      <div className="setup-card">
        
        {/* LADO ESQUERDO: LOGOS AUMENTADAS EM 30% */}
        <div className="card-left">
            <div className="brand-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                
                {/* Container das Logos - Gap aumentado para 26px (+30%) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '26px', marginBottom: '52px', width: '100%', flexWrap: 'nowrap' }}>
                    
                    {/* Logo Principal - maxHeight aumentada para 182px (+30%) */}
                    <img 
                        src="/logo2.png" 
                        alt="SisFO Logo" 
                        style={{ maxHeight: '182px', maxWidth: '45%', objectFit: 'contain' }} 
                        onError={(e) => e.target.style.display = 'none'}
                    />
                    
                    {/* Linha Divisória - height aumentada para 143px (+30%) */}
                    <div style={{ height: '143px', width: '2px', backgroundColor: 'rgba(255, 255, 255, 0.3)', flexShrink: 0 }}></div>
                    
                    {/* Bloco SISGEF */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', maxWidth: '45%' }}>
                        {/* Texto aumentado para 16px, margin para 8px (+30%) */}
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', opacity: 0.9, letterSpacing: '1px', marginBottom: '8px', whiteSpace: 'nowrap' }}>
                            Powered By
                        </span>
                        {/* Logo SISGEF - maxHeight aumentada para 98px (+30%) */}
                        <img 
                            src="/sisgef.png" 
                            alt="SISGEF Logo" 
                            style={{ maxHeight: '98px', maxWidth: '100%', objectFit: 'contain' }} 
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    </div>
                </div>

                {/* Título e Subtítulo aumentados proporcionalmente para harmonizar (+30%) */}
                <h1 style={{ fontSize: '3.3rem', margin: '0 0 7px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>SisFO</h1>
                <p style={{ opacity: 0.9, fontSize: '1.3rem', textAlign: 'center' }}>Sistema de Fechamento Operacional</p>
            </div>
            
            <div className="circle c1"></div>
            <div className="circle c2"></div>
        </div>

        {/* LADO DIREITO */}
        <div className="card-right">
          <div className="header-right-setup">
            <h2>Configuração de Acesso</h2>
            <p className="welcome-text">Olá, <strong>{operatorName}</strong>. Selecione o evento para iniciar.</p>
          </div>

          <div className="form-group-setup">
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#444' }}>
              Evento Disponível
            </label>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <div style={{ flex: 1 }}>
                  <select 
                    value={selectedEvent} 
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    disabled={isLocked}
                    style={{ 
                        width: '100%', 
                        height: '48px', 
                        padding: '0 15px', 
                        borderRadius: '8px', 
                        border: '1px solid #ccc', 
                        fontSize: '1rem', 
                        backgroundColor: '#f9f9f9',
                        outline: 'none',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        appearance: 'auto'
                    }}
                  >
                    <option value="" disabled>
                        {isLocked ? 'Baixando banco de dados...' : 'Selecione o evento...'}
                    </option>
                    {events.map((evt, idx) => (
                      <option key={idx} value={evt.name}>{evt.name}</option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={handleRefresh} 
                  disabled={isSyncing}
                  title="Atualizar Lista"
                  style={{
                      height: '48px',
                      padding: '0 20px',
                      backgroundColor: isSyncing ? '#ccc' : '#1E63B8',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'background-color 0.2s',
                      whiteSpace: 'nowrap'
                  }}
                >
                  <span className={isSyncing ? 'spin-icon' : ''} style={{ fontSize: '1.2rem' }}>
                      {isSyncing ? '⏳' : '🔄'}
                  </span>
                  {isSyncing ? 'Atualizando...' : 'Atualizar'}
                </button>
            </div>
          </div>

          <div className="action-area" style={{ marginTop: '30px' }}>
            <button
              className="primary-btn"
              onClick={handleEnterEvent}
              disabled={!selectedEvent || isLocked}
              style={{ width: '100%', height: '54px', fontSize: '1.1rem', borderRadius: '8px', opacity: (!selectedEvent || isLocked) ? 0.6 : 1 }}
            >
              <span>Acessar Painel</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            
            {isSyncing && events.length > 0 && (
                <p style={{ textAlign: 'center', fontSize: '11px', color: '#1E63B8', marginTop: '10px', fontWeight: 'bold' }}>
                    Atualizando cadastros em segundo plano... Você já pode acessar!
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetupPage;