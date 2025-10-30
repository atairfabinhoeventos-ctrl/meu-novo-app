// src/contexts/SyncContext.jsx

import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { 
  backgroundDownloadMasterData, 
  backgroundUploadPendingClosings, 
  getAllLocalClosings 
} from '../services/syncService'; //

export const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const [isSyncingUpload, setIsSyncingUpload] = useState(false);
  const [isSyncingDownload, setIsSyncingDownload] = useState(false);
  const [masterDataTimestamp, setMasterDataTimestamp] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle', 'pending', 'synced'

  // --- CORREÇÃO 1 (TORNAR ESTÁVEL) ---
  // Usamos o setter funcional (ex: setIsSyncingUpload(prevState => ...))
  // para verificar o estado anterior sem precisar dele na lista de dependências.
  // Isso impede que a função seja recriada e evita o loop infinito.
  const triggerDownloadSync = useCallback(async () => {
    let shouldRun = false;
    setIsSyncingDownload(prevState => {
      if (prevState) {
        console.log('[SyncContext] Download já em andamento, pulando.');
        shouldRun = false;
        return prevState;
      }
      console.log('[SyncContext] Iniciando download de dados mestre...');
      shouldRun = true;
      return true;
    });

    if (!shouldRun) return;

    try {
      await backgroundDownloadMasterData(); //
      setMasterDataTimestamp(Date.now());
      console.log('[SyncContext] Download de dados mestre concluído.');
    } catch (error) {
      console.error('[SyncContext] Falha no download de dados mestre:', error);
      // Re-lança o erro para o App.jsx (se ele estiver usando await) saber que falhou
      throw error;
    } finally {
      setIsSyncingDownload(false);
    }
  }, []); // <-- Dependência VAZIA. A função agora é estável.
  
  // --- CORREÇÃO 2 (TORNAR ESTÁVEL) ---
  const retryPendingUploads = useCallback(async () => {
    let shouldRun = false;
    setIsSyncingUpload(prevState => {
      if (prevState) {
        console.log('[SyncContext] Upload já em andamento, pulando.');
        shouldRun = false;
        return prevState;
      }
      shouldRun = true;
      return true;
    });

    if (!shouldRun) return;
    
    console.log('[SyncContext] Verificando uploads pendentes...');
    try {
      // Passamos a função de callback 'checkUploadStatus'
      const success = await backgroundUploadPendingClosings(checkUploadStatus); //
      if (success) {
        console.log('[SyncContext] Upload em background concluído com sucesso.');
      }
    } catch (error) {
       console.error('[SyncContext] Falha no upload em background:', error);
       // Re-lança o erro
       throw error;
    } finally {
      setIsSyncingUpload(false);
    }
  }, []); // <-- Dependência VAZIA. A função agora é estável.
  // --- FIM DAS CORREÇÕES ---


  const checkUploadStatus = useCallback(() => {
    // Esta função checa o localStorage e define a cor da bolinha
    console.log('[SyncContext] checkUploadStatus: Verificando status de upload local...');
    const localClosings = getAllLocalClosings(); //
    if (localClosings.length === 0) {
      console.log('[SyncContext] checkUploadStatus: Nenhum item local. Status: idle');
      setUploadStatus('idle'); //
      return;
    }
    const hasUnsyncedItems = localClosings.some(item => !item.isSynced); //
    if (hasUnsyncedItems) {
      console.log('[SyncContext] checkUploadStatus: Encontrados itens não sincronizados. Status: pending');
      setUploadStatus('pending'); //
    } else {
      console.log('[SyncContext] checkUploadStatus: Todos os itens estão sincronizados. Status: synced');
      setUploadStatus('synced'); //
    }
  }, []);

  // Efeito para checar o status inicial e quando dados mudam
  useEffect(() => {
    checkUploadStatus();
    
    // Ouve o evento 'localDataChanged' que é disparado pelo (apiService)
    const handleDataChange = () => {
      console.log('[SyncContext] Evento localDataChanged detectado, verificando status...');
      checkUploadStatus();
    };
    window.addEventListener('localDataChanged', handleDataChange);
    
    return () => {
      window.removeEventListener('localDataChanged', handleDataChange);
    };
  }, [checkUploadStatus]);
  

  return (
    <SyncContext.Provider value={{
      isSyncingUpload,
      isSyncingDownload,
      masterDataTimestamp,
      uploadStatus, //
      triggerDownloadSync,
      retryPendingUploads,
      checkUploadStatus
    }}>
      {children}
    </SyncContext.Provider>
  );
};