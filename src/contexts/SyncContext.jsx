// src/contexts/SyncContext.jsx (VERSÃO COM DOIS INDICADORES)
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { backgroundDownloadMasterData } from '../services/syncService'; // Importa a função

export const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  // 1. Status de UPLOAD (O que já tínhamos, só renomeado)
  const [uploadStatus, setUploadStatus] = useState('live'); // 'live' ou 'pending'
  
  // 2. Status de DOWNLOAD
  const [downloadStatus, setDownloadStatus] = useState('synced'); // 'synced', 'syncing', 'offline'
  
  // Flag para evitar downloads múltiplos
  const [isSyncingDownload, setIsSyncingDownload] = useState(false);

  // --- LÓGICA DE UPLOAD (Aguardando Rede) ---
  const checkUploadStatus = useCallback(() => {
    try {
      const localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      if (localClosings.length > 0) {
        setUploadStatus('pending');
      } else {
        setUploadStatus('live');
      }
    } catch (e) {
      console.error("Erro ao verificar status de UPLOAD:", e);
      setUploadStatus('live');
    }
  }, []);

  // Verifica o status de UPLOAD ao carregar
  useEffect(() => {
    checkUploadStatus();
  }, [checkUploadStatus]);

  // Ouve por eventos de salvamento local para atualizar o status de UPLOAD
  useEffect(() => {
    window.addEventListener('localDataChanged', checkUploadStatus);
    return () => {
      window.removeEventListener('localDataChanged', checkUploadStatus);
    };
  }, [checkUploadStatus]);

  // --- LÓGICA DE DOWNLOAD (Dados Sincronizados) ---
  const triggerDownloadSync = useCallback(async () => {
    // Evita rodar duas vezes
    if (isSyncingDownload) return; 

    setIsSyncingDownload(true);
    setDownloadStatus('syncing'); // Define como "Baixando..."
    console.log("[SyncContext] Iniciando download de dados mestre...");

    try {
      await backgroundDownloadMasterData(); // Chama o serviço
      setDownloadStatus('synced'); // Sucesso! Define como "Sincronizado"
      console.log("[SyncContext] Download de dados mestre concluído.");
    } catch (error) {
      setDownloadStatus('offline'); // Falha! Define como "Offline/Erro"
      console.error("[SyncContext] Falha no download de dados mestre:", error);
    } finally {
      setIsSyncingDownload(false); // Libera para a próxima
    }
  }, [isSyncingDownload]);


  // 3. Disponibiliza os DOIS status e a nova função
  const value = useMemo(() => ({
    uploadStatus,
    downloadStatus,
    triggerDownloadSync // Exporta a função para o App.jsx usar
  }), [uploadStatus, downloadStatus, triggerDownloadSync]);

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}