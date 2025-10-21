// src/components/SyncStatusIndicator.jsx (VERSÃO COM DOIS INDICADORES)
import React, { useContext } from 'react';
import { SyncContext } from '../contexts/SyncContext.jsx';
import './SyncStatusIndicator.css'; // Usará o CSS atualizado

// Sub-componente para evitar repetição de código
const StatusItem = ({ statusClass, text, usePulse }) => (
  <div className="status-item">
    <div className={`status-dot ${statusClass} ${usePulse ? 'pulse-animation' : ''}`}></div>
    <span className={statusClass}>{text}</span>
  </div>
);

function SyncStatusIndicator() {
  const { uploadStatus, downloadStatus } = useContext(SyncContext);

  if (!uploadStatus || !downloadStatus) return null;

  // --- Lógica do Indicador 1: UPLOAD (Eventos Subidos) ---
  const uploadInfo = {
    text: uploadStatus === 'pending' ? 'Aguardando Envio' : 'Dados Enviados',
    className: uploadStatus === 'pending' ? 'status-pending' : 'status-live',
    pulse: uploadStatus === 'pending'
  };

  // --- Lógica do Indicador 2: DOWNLOAD (Dados Sincronizados) ---
  let downloadInfo;
  if (downloadStatus === 'syncing') {
    downloadInfo = { text: 'Baixando Dados...', className: 'status-syncing', pulse: true };
  } else if (downloadStatus === 'offline') {
    downloadInfo = { text: 'Erro de Rede', className: 'status-offline', pulse: false };
  } else {
    downloadInfo = { text: 'Dados Sincronizados', className: 'status-live', pulse: false };
  }

  return (
    <div className="sync-status-indicator-wrapper">
      <StatusItem 
        text={uploadInfo.text} 
        statusClass={uploadInfo.className} 
        usePulse={uploadInfo.pulse} 
      />
      <StatusItem 
        text={downloadInfo.text} 
        statusClass={downloadInfo.className} 
        usePulse={downloadInfo.pulse} 
      />
    </div>
  );
}

export default SyncStatusIndicator;