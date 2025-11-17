// src/pages/ClosingHistoryPage.jsx (VERSÃO ATUALIZADA PARA ZIG)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { generateWaiterReceiptPDF } from '../services/pdfService';
import './ClosingHistoryPage.css';
import '../App.css';
import AlertModal from '../components/AlertModal.jsx';

const formatCurrency = (value) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- Helper para obter protocolo base ---
const getProtocolBase = (closing) => {
    // Protocolo de grupo (CXF-123) > Protocolo individual (G8-123, CXM-123, GZ-123)
    return closing?.groupProtocol || closing?.protocol || null;
};

function ClosingHistoryPage() {
  const navigate = useNavigate();
  const [rawLocalClosings, setRawLocalClosings] = useState([]);
  const [localClosings, setLocalClosings] = useState([]);
  const [onlineClosings, setOnlineClosings] = useState([]);
  const [filteredClosings, setFilteredClosings] = useState([]);
  const [viewMode, setViewMode] = useState('local');

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para Modais
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [onlineError, setOnlineError] = useState('');
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [lastUsedPassword, setLastUsedPassword] = useState('');

  // --- Estados para Exclusão ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletePasswordOpen, setIsDeletePasswordOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const passwordInputRef = useRef(null);

  // Função para carregar/recarregar dados locais do localStorage
  const loadLocalClosings = useCallback(() => {
    console.log("[ClosingHistoryPage] loadLocalClosings chamada.");
    setIsLoading(true);
    try {
        const activeEvent = localStorage.getItem('activeEvent');
        const allLocal = JSON.parse(localStorage.getItem('localClosings')) || [];
        const eventClosings = allLocal.filter(c => c.eventName === activeEvent);

        setRawLocalClosings(eventClosings);

        const flattenedClosings = [];
        eventClosings.forEach(closing => {
            if (closing.type === 'fixed_cashier' && Array.isArray(closing.caixas)) {
                // Desmembra o caixa fixo em itens individuais
                closing.caixas.forEach((caixa, index) => {
                    // Recalcula o acerto/diferença individual (baseado no server.js)
                    const acertoIndividual = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                    // A diferença é o físico (salvo) vs o acerto (calculado)
                    const diferencaIndividual = (caixa.dinheiroFisico !== undefined ? caixa.dinheiroFisico : 0) - acertoIndividual;

                    flattenedClosings.push({
                        ...caixa,
                        type: 'individual_fixed_cashier',
                        protocol: caixa.protocol || `${closing.protocol}-${index + 1}`,
                        groupProtocol: closing.protocol,
                        timestamp: closing.timestamp,
                        operatorName: closing.operatorName,
                        // Salva os valores recalculados
                        valorAcerto: acertoIndividual,
                        diferenca: diferencaIndividual, 
                        synced: closing.synced // Puxa o status de sync do grupo
                    });
                });
            } else {
                // Adiciona garçons (todos os tipos) e caixas móveis
                flattenedClosings.push(closing);
            }
        });

        flattenedClosings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLocalClosings(flattenedClosings);

    } catch (error) {
        console.error("[ClosingHistoryPage] Erro ao carregar dados locais:", error);
        setLocalClosings([]);
        setRawLocalClosings([]);
    } finally {
       setIsLoading(false);
    }
  }, []);

  // Carregamento inicial ao montar o componente
  useEffect(() => {
    loadLocalClosings();
  }, [loadLocalClosings]);

  // Listener para atualizações automáticas
  useEffect(() => {
    const handleLocalDataChange = () => {
      console.log("[ClosingHistoryPage] Evento localDataChanged recebido. Recarregando dados locais...");
      loadLocalClosings();
    };
    console.log("[ClosingHistoryPage] Adicionando listener para localDataChanged");
    window.addEventListener('localDataChanged', handleLocalDataChange);
    return () => {
      console.log("[ClosingHistoryPage] Removendo listener para localDataChanged");
      window.removeEventListener('localDataChanged', handleLocalDataChange);
    };
  }, [loadLocalClosings]);

  // Aplica o filtro de busca
  useEffect(() => {
    const sourceData = viewMode === 'local' ? localClosings : onlineClosings;
    if (searchQuery === '') {
      setFilteredClosings(sourceData);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = sourceData.filter(closing => {
        const nameToSearch = (closing.waiterName || closing.cashierName || '').toLowerCase();
        return nameToSearch.includes(lowercasedQuery) ||
               (closing.protocol && closing.protocol.toLowerCase().includes(lowercasedQuery)) ||
               (closing.groupProtocol && closing.groupProtocol.toLowerCase().includes(lowercasedQuery));
      });
      setFilteredClosings(filtered);
    }
  }, [searchQuery, viewMode, localClosings, onlineClosings]);

  // --- MUDANÇA AQUI ---
  // Navega para a tela de edição correta
  const handleEdit = (closing) => {
    let targetPath = '';
    let closingDataToSend = closing;

    if (closing.type === 'individual_fixed_cashier') {
        targetPath = '/fixed-cashier-closing';
        // Encontra o grupo original no 'raw' (antes de ser desmembrado)
        closingDataToSend = rawLocalClosings.find(c => c.protocol === closing.groupProtocol);
        if (!closingDataToSend) {
            console.error("Erro ao encontrar dados do grupo para edição:", closing.groupProtocol);
            setAlertMessage("Erro: Não foi possível encontrar os dados originais do grupo para edição.");
            return;
        }
    } else if (closing.type === 'waiter_zig') {
        // Rota para o novo fechamento ZIG
        targetPath = '/zig-cashless-closing';
    } else if (closing.type === 'waiter' || closing.type === 'waiter_10') {
        // Lógica antiga (G8 e G10)
        targetPath = (closing.type === 'waiter_10' || closing.protocol?.startsWith('G10-'))
            ? '/waiter-closing-10'
            : '/waiter-closing';
    } else if (closing.type === 'cashier') {
        targetPath = '/mobile-cashier-closing';
    }
    // --- FIM DA MUDANÇA ---

    if (targetPath && closingDataToSend) {
        navigate(targetPath, { state: { closingToEdit: closingDataToSend } });
    } else {
         console.warn("Não foi possível determinar a rota de edição para:", closing);
         setAlertMessage("Não foi possível abrir a edição para este tipo de registro.");
    }
  };

  // Funções de Detalhes e Busca Online
  const handleViewDetails = (closing) => { setSelectedClosing(closing); setIsDetailsModalOpen(true); };
  const closeDetailsModal = () => { setIsDetailsModalOpen(false); setSelectedClosing(null); };

  const fetchOnlineData = async (passwordToUse) => {
    setIsPasswordModalOpen(false); setIsGlobalLoading(true); setOnlineError('');
    try {
      const activeEvent = localStorage.getItem('activeEvent');
      const response = await axios.post(`${API_URL}/api/online-history`, { eventName: activeEvent, password: passwordToUse });
      const sortedData = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // --- MUDANÇA AQUI ---
      // Processa os dados online para garantir consistência (ex: caixa fixo)
      const flattenedOnline = [];
      sortedData.forEach(closing => {
          // O backend (server.js) já retorna caixas fixos como 'individual_fixed_cashier'
          flattenedOnline.push(closing);
      });
      // --- FIM DA MUDANÇA ---
      
      setOnlineClosings(flattenedOnline); // Salva os dados já desmembrados
      setLastUsedPassword(passwordToUse); 
      setViewMode('online'); 
      setPassword('');
    } catch (error) {
      const message = error.response?.data?.message || 'Falha ao buscar dados. Tente novamente.';
      setOnlineError(message);
      setIsPasswordModalOpen(true);
    } finally { setIsGlobalLoading(false); }
  };

  const handleRefresh = () => { if (lastUsedPassword) { fetchOnlineData(lastUsedPassword); } };
  const handlePasswordKeyDown = (event) => { if (event.key === 'Enter') { fetchOnlineData(password); } };

  // --- Funções para Iniciar a Exclusão ---
  const handleInitiateLocalDelete = (closing) => {
      setItemToDelete(closing);
      setIsDeleteConfirmOpen(true);
  };

  const handleInitiateOnlineDelete = (closing) => {
      setItemToDelete(closing);
      setDeletePassword('');
      setDeleteError('');
      setIsDeletePasswordOpen(true);
      setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  // --- Funções para Confirmar e Executar a Exclusão ---
  const handleConfirmLocalDelete = async () => {
      if (!itemToDelete) return;
      setIsDeleteConfirmOpen(false);
      setIsDeleting(true);
      setAlertMessage('Excluindo registro local e online...');
      const protocolBase = getProtocolBase(itemToDelete);
      const activeEvent = localStorage.getItem('activeEvent');
      if (!protocolBase || !activeEvent) {
          setAlertMessage('Erro: Não foi possível identificar o registro ou evento para exclusão.');
          setIsDeleting(false); setItemToDelete(null); return;
      }
      let onlineErrorOccurred = false;
      try {
          console.log(`[Frontend][DeleteLocal] Tentando excluir online protocolo base: ${protocolBase}`);
          await axios.post(`${API_URL}/api/delete-closing`, { eventName: activeEvent, protocolToDelete: protocolBase });
          console.log(`[Frontend][DeleteLocal] Exclusão online para ${protocolBase} bem-sucedida.`);
      } catch (error) {
          const status = error.response?.status;
          const errorMsg = error.response?.data?.message || "Erro desconhecido ao excluir online.";
          if (status !== 404) {
             onlineErrorOccurred = true;
             console.warn(`[Frontend][DeleteLocal] Falha ao excluir online ${protocolBase}: ${errorMsg} (Status: ${status})`);
          } else {
             console.log(`[Frontend][DeleteLocal] Registro ${protocolBase} não encontrado online (status 404), procedendo com exclusão local.`);
             onlineErrorOccurred = false;
          }
      }
      try {
          console.log(`[Frontend][DeleteLocal] Excluindo localmente protocolo base: ${protocolBase}`);
          const currentLocalClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
          // Filtra o RAW data (que contém os grupos)
          const updatedLocalClosings = currentLocalClosings.filter(closing => getProtocolBase(closing) !== protocolBase);
          localStorage.setItem('localClosings', JSON.stringify(updatedLocalClosings));
          
          console.log(`[Frontend][DeleteLocal] Exclusão local concluída. Registros restantes: ${updatedLocalClosings.length}`);
          
          // Recarrega os dados (que irá re-desmembrar)
          loadLocalClosings();
          
          if (onlineErrorOccurred) {
              setAlertMessage(`Registro excluído localmente, mas falha ao excluir online. Verifique a conexão.`);
          } else {
              setAlertMessage('Registro excluído com sucesso.');
          }
      } catch (localError) {
          console.error(`[Frontend][DeleteLocal] Erro CRÍTICO ao excluir localmente ${protocolBase}:`, localError);
          setAlertMessage('Erro GRAVE ao tentar excluir o registro localmente. Verifique o console.');
      } finally {
          setIsDeleting(false);
          setItemToDelete(null);
          window.dispatchEvent(new Event('localDataChanged'));
      }
  };

  const handleConfirmOnlineDelete = async () => {
      if (!itemToDelete || !deletePassword) {
          setDeleteError('Senha é obrigatória.'); return;
      }
      setIsDeletePasswordOpen(false);
      setIsDeleting(true);
      setAlertMessage('Excluindo registro online...');
      const protocolBase = getProtocolBase(itemToDelete);
      const activeEvent = localStorage.getItem('activeEvent');
      if (!protocolBase || !activeEvent) {
          setAlertMessage('Erro: Não foi possível identificar o registro ou evento para exclusão online.');
          setIsDeleting(false); setItemToDelete(null); return;
      }
      try {
          console.log(`[Frontend][DeleteOnline] Tentando excluir online protocolo base: ${protocolBase} com senha.`);
          const response = await axios.post(`${API_URL}/api/delete-closing`, { eventName: activeEvent, protocolToDelete: protocolBase, password: deletePassword });
          console.log(`[Frontend][DeleteOnline] Exclusão online para ${protocolBase} bem-sucedida.`);
          
          // Remove da lista online (que é desmembrada)
          setOnlineClosings(prev => prev.filter(closing => getProtocolBase(closing) !== protocolBase));
          setAlertMessage(response.data.message || 'Registro excluído com sucesso online.');
          
          // Tenta remover localmente também
          try {
              const currentLocalClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
              const updatedLocalClosings = currentLocalClosings.filter(closing => getProtocolBase(closing) !== protocolBase);
              if (updatedLocalClosings.length < currentLocalClosings.length) {
                  localStorage.setItem('localClosings', JSON.stringify(updatedLocalClosings));
                  console.log(`[Frontend][DeleteOnline] Registro local ${protocolBase} também removido.`);
                   window.dispatchEvent(new Event('localDataChanged'));
              }
          } catch (e) { console.warn("Erro menor ao tentar limpar registro local após exclusão online bem-sucedida:", e); }
      } catch (error) {
          const status = error.response?.status;
          const errorMsg = error.response?.data?.message || "Falha ao excluir online.";
          console.error(`[Frontend][DeleteOnline] Falha ao excluir online ${protocolBase}: ${errorMsg} (Status: ${status})`);
          setAlertMessage(`Falha ao excluir online: ${errorMsg}`);
          if (status === 401) {
              setDeleteError('Senha incorreta.');
              setIsDeletePasswordOpen(true);
              setTimeout(() => passwordInputRef.current?.focus(), 100);
          }
      } finally {
          setIsDeleting(false);
          if (!isDeletePasswordOpen) setItemToDelete(null);
      }
  };


  return (
    <div className="app-container history-page-wrapper">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />

      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}>
        <h1>Histórico de Fechamentos</h1>
        <p className="menu-subtitle">Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong></p>
        
        <div className="view-toggle-container">
            <div className="view-toggle">
                <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>Dados Locais</button>
                <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>Consultar Online</button>
            </div>
            {viewMode === 'online' && (<button className="refresh-button" onClick={handleRefresh} title="Atualizar dados online" disabled={isDeleting || isGlobalLoading}>🔄</button>)}
        </div>
        <div className="input-group">
            <input type="text" placeholder="🔎 Buscar por nome ou protocolo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{marginBottom: '20px'}} />
        </div>

        {(isLoading && viewMode === 'local') || (isGlobalLoading && viewMode === 'online') ? ( <p>Carregando dados...</p> ) :
         filteredClosings.length === 0 ? ( <p className="empty-message">Nenhum fechamento encontrado.</p> ) :
         (
            <div className="history-list">
                {filteredClosings.map((closing) => {
                    
                    // --- MUDANÇA AQUI (Lógica de exibição do Card) ---
                    const { type } = closing;
                    let name, title, totalValue, differenceLabel, differenceValue, differenceColor;

                    if (type === 'waiter' || type === 'waiter_10') {
                        title = type === 'waiter_10' ? 'Garçom 10%' : 'Garçom 8%';
                        name = closing.waiterName; 
                        totalValue = closing.valorTotal;
                        differenceLabel = closing.diferencaLabel; 
                        differenceValue = closing.diferencaPagarReceber;
                        differenceColor = differenceLabel === 'Pagar ao Garçom' ? 'blue' : 'red';
                    
                    } else if (type === 'waiter_zig') {
                        title = 'Garçom ZIG';
                        name = closing.waiterName;
                        // O valor principal do card ZIG é a Venda de Produtos (para comissão)
                        totalValue = closing.valorTotalProdutos; 
                        differenceLabel = closing.diferencaLabel; 
                        differenceValue = closing.diferencaPagarReceber;
                        differenceColor = differenceLabel === 'Pagar ao Garçom' ? 'blue' : 'red';

                    } else if (type === 'cashier' || type === 'individual_fixed_cashier') {
                        title = type === 'cashier' ? 'Caixa Móvel' : 'Caixa Fixo'; 
                        name = closing.cashierName;
                        totalValue = closing.valorTotalVenda; 
                        const diff = closing.diferenca;
                        differenceValue = typeof diff === 'number' ? Math.abs(diff) : 0;
                        if (diff > 0) { differenceLabel = 'Sobrou no Caixa'; differenceColor = 'green'; }
                        else if (diff < 0) { differenceLabel = 'Faltou no Caixa'; differenceColor = 'red'; }
                        else { differenceLabel = 'Caixa Zerado'; differenceColor = 'blue'; }
                    } else {
                        title = "Inválido"; name = "Erro"; totalValue = 0;
                        differenceLabel = "Erro"; differenceValue = 0; differenceColor = "orange";
                    }
                    // --- FIM DA MUDANÇA ---

                    return (
                        <div key={closing.protocol} className="history-card">
                           <div className="card-header">
                                <span className="protocol">{getProtocolBase(closing)}</span>
                                {viewMode === 'local' ? (
                                    closing.synced === true ? (
                                        <span className="sync-status synced">✔ Sincronizado</span>
                                    ) : (
                                        <span className="sync-status pending">... Aguardando Envio</span>
                                    )
                                ) : (
                                    <span className="sync-status synced">✔ Online</span>
                                )}
                                <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="card-body">
                                <p><strong>{title}:</strong> {name}</p>
                                <p><strong>{type === 'waiter_zig' ? 'Venda Produtos:' : 'Venda Total:'}</strong> {formatCurrency(totalValue)}</p>
                                <p className="acerto" style={{color: differenceColor}}>
                                    <strong>{differenceLabel}:</strong> {formatCurrency(differenceValue)}
                                </p>
                            </div>
                            <div className="card-footer">
                                {viewMode === 'local' ? (
                                    <button className="delete-button" onClick={() => handleInitiateLocalDelete(closing)} disabled={isDeleting}>
                                        🗑️ Excluir
                                    </button>
                                ) : (
                                    <button className="delete-button" onClick={() => handleInitiateOnlineDelete(closing)} disabled={isDeleting}>
                                        🗑️ Excluir Online
                                    </button>
                                )}
                                {viewMode === 'local' && (
                                    <button className="edit-button" onClick={() => handleEdit(closing)} disabled={isDeleting}>
                                       ✏️ {closing.type === 'individual_fixed_cashier' ? 'Editar Grupo' : 'Editar'}
                                    </button>
                                )}
                                <button className="details-button" onClick={() => handleViewDetails(closing)} disabled={isDeleting}>
                                   📄 Detalhes
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* --- MODAL DE DETALHES ATUALIZADO --- */}
      {isDetailsModalOpen && selectedClosing && (
         <div className="modal-overlay" onClick={closeDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <h2>Detalhes do Fechamento</h2>
            {(() => {
              const { type } = selectedClosing;
              const isWaiter = type.startsWith('waiter'); // Pega todos os garçons
              const isZig = type === 'waiter_zig';
              const isCashier = ['cashier', 'individual_fixed_cashier'].includes(type);
              
              const name = selectedClosing.waiterName || selectedClosing.cashierName;
              let title = '';
              if (isZig) title = 'Garçom ZIG';
              else if (isWaiter) title = selectedClosing.type === 'waiter_10' ? 'Garçom 10%' : 'Garçom 8%';
              else if (isCashier) title = type === 'cashier' ? 'Caixa Móvel' : 'Caixa Fixo';
              
              // Valor principal (Recarga ZIG ou Venda Total normal)
              const totalValue = selectedClosing.valorTotal || selectedClosing.valorTotalVenda;
              let differenceValue = 0;
              let differenceLabelText = '';
              
              if (isWaiter) {
                  differenceValue = selectedClosing.diferencaPagarReceber;
                  differenceLabelText = selectedClosing.diferencaLabel;
              } else if (isCashier) {
                   differenceValue = typeof selectedClosing.diferenca === 'number' ? selectedClosing.diferenca : 0;
                   if (differenceValue > 0) differenceLabelText = "Sobrou";
                   else if (differenceValue < 0) differenceLabelText = "Faltou";
                   else differenceLabelText = "Zerado";
              }

              return (
                <>
                  <p><strong>Protocolo:</strong> {getProtocolBase(selectedClosing)}</p>
                  <p><strong>Data:</strong> {new Date(selectedClosing.timestamp).toLocaleString('pt-BR')}</p>
                  <p><strong>{title}:</strong> {name}</p>
                  <p><strong>Operador:</strong> {selectedClosing.operatorName}</p>
                  <p><strong>Nº Máquina:</strong> {selectedClosing.numeroMaquina || 'N/A'}</p>
                  <hr/>
                  
                  {/* Seção de Venda ZIG (com destaque) */}
                  {isZig && (
                    <p style={{backgroundColor: '#fff8f2', padding: '5px', borderRadius: '4px'}}>
                      <strong>Venda Total Produtos:</strong> {formatCurrency(selectedClosing.valorTotalProdutos)}
                    </p>
                  )}
                  
                  <p><strong>{isZig ? 'Recarga Cashless:' : 'Venda Total:'}</strong> {formatCurrency(totalValue)}</p>
                  <p><strong>Crédito:</strong> {formatCurrency(selectedClosing.credito)}</p>
                  <p><strong>Débito:</strong> {formatCurrency(selectedClosing.debito)}</p>
                  <p><strong>PIX:</strong> {formatCurrency(selectedClosing.pix)}</p>
                  
                  {/* Só mostra Cashless se NÃO for ZIG */}
                  {!isZig && <p><strong>Cashless:</strong> {formatCurrency(selectedClosing.cashless)}</p>}
                  
                  {isCashier && (selectedClosing.valorTroco > 0 || viewMode === 'online') && <p><strong>Troco Recebido:</strong> {formatCurrency(selectedClosing.valorTroco)}</p>}
                  {selectedClosing.temEstorno && <p><strong>Estorno:</strong> {formatCurrency(selectedClosing.valorEstorno)}</p>}
                  <hr/>
                  {isWaiter && <p><strong>Comissão Total:</strong> {formatCurrency(selectedClosing.comissaoTotal)}</p>}
                  {isCashier && <p><strong>Dinheiro Físico:</strong> {formatCurrency(selectedClosing.dinheiroFisico)}</p>}
                  {isCashier && selectedClosing.valorAcerto !== undefined && <p><strong>Valor Acerto (Esperado):</strong> {formatCurrency(selectedClosing.valorAcerto)}</p>}

                  <p className="total-text" style={{fontSize: '1.2em', marginTop: '15px'}}>
                    Resultado Final ({differenceLabelText}):
                    <strong style={{ marginLeft: '10px' }}>
                        {formatCurrency(differenceValue)}
                    </strong>
                  </p>
                </>
              )
            })()}
            <div className="modal-buttons" style={{marginTop: '20px'}}>
              <button className="cancel-button" onClick={closeDetailsModal}>Fechar</button>
              {selectedClosing.type.startsWith('waiter') && (
                  <button
                    className="confirm-button"
                    onClick={() => generateWaiterReceiptPDF(selectedClosing)}
                  >
                    Imprimir 2ª Via
                  </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Senha para Consulta Online */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Acessar Histórico Online</h2>
            <p>Digite a senha para consultar os dados na nuvem.</p>
            <div className="input-group">
                <input
                    type="password"
                    placeholder="Senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKeyDown}
                    autoFocus
                />
            </div>
            {onlineError && <p className="error-message" style={{textAlign: 'center'}}>{onlineError}</p>}
            <div className="modal-buttons">
                <button className="cancel-button" onClick={() => { setIsPasswordModalOpen(false); setOnlineError(''); }}>Cancelar</button>
                <button className="confirm-button" onClick={() => fetchOnlineData(password)} disabled={isGlobalLoading}>
                  {isGlobalLoading ? 'Buscando...' : 'Confirmar'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Local */}
      {isDeleteConfirmOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '450px' }}>
                  <h2>Confirmar Exclusão</h2>
                  <p>
                      Tem certeza que deseja excluir o registro com protocolo
                      <strong> {getProtocolBase(itemToDelete)}</strong>?
                  </p>
                  <p>Esta ação removerá o registro localmente e tentará removê-lo da planilha online. <strong>Esta ação não pode ser desfeita.</strong></p>
                  <div className="modal-buttons">
                      <button className="cancel-button" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancelar</button>
                      <button className="delete-button-confirm" onClick={handleConfirmLocalDelete} disabled={isDeleting}>
                          {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Senha para Exclusão Online */}
      {isDeletePasswordOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '450px' }}>
                  <h2>Excluir Registro Online</h2>
                   <p>
                      Digite a senha para confirmar a exclusão online do registro
                      <strong> {getProtocolBase(itemToDelete)}</strong>.
                  </p>
                  <p><strong>Esta ação não pode ser desfeita.</strong></p>
                  <div className="input-group">
                      <input
                          ref={passwordInputRef} // Foco no input
                          type="password"
                          placeholder="Senha de acesso online"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleConfirmOnlineDelete()} // Enter confirma
                          autoFocus
                      />
                  </div>
                  {deleteError && <p className="error-message" style={{ textAlign: 'center' }}>{deleteError}</p>} {/* Exibe erro de senha */}
                  <div className="modal-buttons">
                      <button className="cancel-button" onClick={() => { setIsDeletePasswordOpen(false); setDeleteError(''); setItemToDelete(null); }} disabled={isDeleting}>Cancelar</button> {/* Limpa item ao cancelar */}
                      <button className="delete-button-confirm" onClick={handleConfirmOnlineDelete} disabled={isDeleting}>
                          {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão Online'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Loading Global */}
      {(isGlobalLoading || isDeleting) && ( 
        <div className="modal-overlay">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>{isDeleting ? 'Excluindo...' : 'Buscando dados na nuvem...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingHistoryPage;