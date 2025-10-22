// src/pages/ClosingHistoryPage.jsx (Com Funcionalidade de Exclusão)

import React, { useState, useEffect, useCallback, useRef } from 'react'; // Adicionado useRef
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config'; //
import { generateWaiterReceiptPDF } from '../services/pdfService';
import './ClosingHistoryPage.css'; //
import '../App.css'; //
import AlertModal from '../components/AlertModal.jsx'; // Adicionado AlertModal

const formatCurrency = (value) => { //
    const numValue = Number(value); //
    if (isNaN(numValue)) return 'R$ 0,00'; //
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); //
};

// --- Helper para obter protocolo base ---
const getProtocolBase = (closing) => { //
    return closing?.groupProtocol || closing?.protocol || null; //
};

function ClosingHistoryPage() { //
  const navigate = useNavigate(); //
  const [rawLocalClosings, setRawLocalClosings] = useState([]); //
  const [localClosings, setLocalClosings] = useState([]); //
  const [onlineClosings, setOnlineClosings] = useState([]); //
  const [filteredClosings, setFilteredClosings] = useState([]); //
  const [viewMode, setViewMode] = useState('local'); //

  const [isLoading, setIsLoading] = useState(true); //
  const [searchQuery, setSearchQuery] = useState(''); //

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false); //
  const [selectedClosing, setSelectedClosing] = useState(null); //

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false); //
  const [password, setPassword] = useState(''); //
  const [onlineError, setOnlineError] = useState(''); //

  const [isGlobalLoading, setIsGlobalLoading] = useState(false); //
  const [lastUsedPassword, setLastUsedPassword] = useState(''); //

  // --- Estados para Exclusão ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); //
  const [isDeletePasswordOpen, setIsDeletePasswordOpen] = useState(false); //
  const [itemToDelete, setItemToDelete] = useState(null); //
  const [deletePassword, setDeletePassword] = useState(''); //
  const [deleteError, setDeleteError] = useState(''); //
  const [isDeleting, setIsDeleting] = useState(false); //
  const [alertMessage, setAlertMessage] = useState(''); // Estado para AlertModal //
  const passwordInputRef = useRef(null); // Ref para focar no input de senha //

  // Função para carregar dados locais (já existente, movida para useCallback)
  const loadLocalClosings = useCallback(() => { //
    console.log("[ClosingHistoryPage] loadLocalClosings chamada."); //
    //setIsLoading(true); // Mostra loading ao recarregar
    try {
        const activeEvent = localStorage.getItem('activeEvent'); //
        const allLocal = JSON.parse(localStorage.getItem('localClosings')) || []; //
        const eventClosings = allLocal.filter(c => c.eventName === activeEvent); //

        setRawLocalClosings(eventClosings); //

        const flattenedClosings = []; //
        eventClosings.forEach(closing => { //
            if (Array.isArray(closing.caixas)) { //
            closing.caixas.forEach((caixa, index) => { //
                const acertoIndividual = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0); //
                const diferencaIndividual = (caixa.dinheiroFisico || 0) - acertoIndividual; //

                flattenedClosings.push({ //
                ...caixa, //
                type: 'individual_fixed_cashier', //
                protocol: `${closing.protocol}-${index + 1}`, // Ajustado para gerar o protocolo individual corretamente //
                groupProtocol: closing.protocol, //
                timestamp: closing.timestamp, //
                operatorName: closing.operatorName, //
                diferenca: diferencaIndividual, //
                synced: closing.synced // Propaga o status de sync do objeto pai //
                });
            });
            } else {
            flattenedClosings.push(closing); //
            }
        });

        flattenedClosings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); //
        setLocalClosings(flattenedClosings); //
        // O useEffect de filtro atualizará filteredClosings
    } catch (error) {
        console.error("[ClosingHistoryPage] Erro ao carregar dados locais:", error); //
        setLocalClosings([]); // Limpa em caso de erro //
    } finally {
       setIsLoading(false); //
    }
  }, []); // useCallback depende de nada externo à função //

  // Carregamento inicial (sem alterações)
  useEffect(() => { //
    loadLocalClosings(); // Chama a função na montagem //
  }, [loadLocalClosings]); //

  // Listener para atualizações automáticas (sem alterações)
  useEffect(() => { //
    const handleLocalDataChange = () => { //
      console.log("[ClosingHistoryPage] Evento localDataChanged recebido. Recarregando dados locais..."); //
      loadLocalClosings(); //
    };

    console.log("[ClosingHistoryPage] Adicionando listener para localDataChanged"); //
    window.addEventListener('localDataChanged', handleLocalDataChange); //

    return () => { //
      console.log("[ClosingHistoryPage] Removendo listener para localDataChanged"); //
      window.removeEventListener('localDataChanged', handleLocalDataChange); //
    };
  }, [loadLocalClosings]); //

  // Filtro (sem alterações)
  useEffect(() => { //
    console.log("[ClosingHistoryPage] Recalculando filtro. ViewMode:", viewMode, "Query:", searchQuery); //
    const sourceData = viewMode === 'local' ? localClosings : onlineClosings; //
    if (searchQuery === '') { //
      setFilteredClosings(sourceData); //
    } else {
      const lowercasedQuery = searchQuery.toLowerCase(); //
      const filtered = sourceData.filter(closing => { //
        const nameToSearch = (closing.waiterName || closing.cashierName || '').toLowerCase(); //
        return nameToSearch.includes(lowercasedQuery) || //
               closing.protocol?.toLowerCase().includes(lowercasedQuery) || //
               closing.groupProtocol?.toLowerCase().includes(lowercasedQuery); //
      });
      setFilteredClosings(filtered); //
    }
    // console.log("[ClosingHistoryPage] Filtro recalculado. Resultados:", filteredClosings.length); // Removido log excessivo
  }, [searchQuery, viewMode, localClosings, onlineClosings]); //

  // Função de Edição (sem alterações)
  const handleEdit = (closing) => { //
    let targetPath = ''; //
    let closingDataToSend = closing; //

    if (closing.type === 'individual_fixed_cashier') { //
        targetPath = '/fixed-cashier-closing'; //
        closingDataToSend = rawLocalClosings.find(c => c.protocol === closing.groupProtocol); //
        if (!closingDataToSend) { //
            console.error("Erro ao encontrar dados do grupo para edição:", closing.groupProtocol); //
            setAlertMessage("Erro: Não foi possível encontrar os dados originais do grupo para edição."); //
            return; //
        }
    } else if (closing.type === 'waiter') { //
        targetPath = closing.subType === '10_percent' ? '/waiter-closing-10' : '/waiter-closing'; // Direciona para a tela correta //
    } else if (closing.type === 'cashier') { //
        targetPath = '/mobile-cashier-closing'; //
    }

    if (targetPath && closingDataToSend) { //
        navigate(targetPath, { state: { closingToEdit: closingDataToSend } }); //
    }
  };

  // Funções de Detalhes e Busca Online (sem alterações)
  const handleViewDetails = (closing) => { setSelectedClosing(closing); setIsDetailsModalOpen(true); }; //
  const closeDetailsModal = () => { setIsDetailsModalOpen(false); setSelectedClosing(null); }; //

  const fetchOnlineData = async (passwordToUse) => { //
    setIsPasswordModalOpen(false); setIsGlobalLoading(true); setOnlineError(''); //
    try {
      const activeEvent = localStorage.getItem('activeEvent'); //
      const response = await axios.post(`${API_URL}/api/online-history`, { eventName: activeEvent, password: passwordToUse }); //
      const sortedData = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); //
      setOnlineClosings(sortedData); setLastUsedPassword(passwordToUse); setViewMode('online'); setPassword(''); //
    } catch (error) {
      const message = error.response?.data?.message || 'Falha ao buscar dados. Tente novamente.'; //
      setOnlineError(message); //
      setIsPasswordModalOpen(true); // Reabre o modal de senha em caso de erro //
    } finally { setIsGlobalLoading(false); } //
  };

  const handleRefresh = () => { if (lastUsedPassword) { fetchOnlineData(lastUsedPassword); } }; //
  const handlePasswordKeyDown = (event) => { if (event.key === 'Enter') { fetchOnlineData(password); } }; //

  // --- Funções para Iniciar a Exclusão ---
  const handleInitiateLocalDelete = (closing) => { //
      setItemToDelete(closing); //
      setIsDeleteConfirmOpen(true); //
  };

  const handleInitiateOnlineDelete = (closing) => { //
      setItemToDelete(closing); //
      setDeletePassword(''); // Limpa senha anterior //
      setDeleteError(''); // Limpa erro anterior //
      setIsDeletePasswordOpen(true); //
      // Foca no input de senha após abrir o modal
      setTimeout(() => passwordInputRef.current?.focus(), 100); //
  };

  // --- Funções para Confirmar e Executar a Exclusão ---
  const handleConfirmLocalDelete = async () => { //
      if (!itemToDelete) return; //

      setIsDeleteConfirmOpen(false); //
      setIsDeleting(true); //
      setAlertMessage('Excluindo registro local e online...'); //

      const protocolBase = getProtocolBase(itemToDelete); //
      const activeEvent = localStorage.getItem('activeEvent'); //

      let onlineErrorOccurred = false; // Flag para erro online

      try {
          // 1. Tenta excluir online primeiro (sem senha, pois é modo local)
          console.log(`[Frontend][DeleteLocal] Tentando excluir online protocolo base: ${protocolBase}`); //
          await axios.post(`${API_URL}/api/delete-closing`, { //
              eventName: activeEvent, //
              protocolToDelete: protocolBase //
              // Nenhuma senha é enviada aqui
          });
          console.log(`[Frontend][DeleteLocal] Exclusão online para ${protocolBase} bem-sucedida.`); //
      } catch (error) {
          onlineErrorOccurred = true; //
          const errorMsg = error.response?.data?.message || "Erro desconhecido"; //
          console.warn(`[Frontend][DeleteLocal] Falha ao excluir online ${protocolBase}: ${errorMsg}`); //
          // Não define alertMessage aqui, define no final
      }

      // 2. Exclui localmente SEMPRE (mesmo se online falhar)
      try {
          console.log(`[Frontend][DeleteLocal] Excluindo localmente protocolo base: ${protocolBase}`); //
          const currentLocalClosings = JSON.parse(localStorage.getItem('localClosings')) || []; //
          // Filtra mantendo apenas os que NÃO têm o protocolo base a ser excluído
          const updatedLocalClosings = currentLocalClosings.filter(closing => getProtocolBase(closing) !== protocolBase); //
          localStorage.setItem('localClosings', JSON.stringify(updatedLocalClosings)); //
          console.log(`[Frontend][DeleteLocal] Exclusão local concluída. Registros restantes: ${updatedLocalClosings.length}`); //
          loadLocalClosings(); // Recarrega a lista na UI //

          // Define a mensagem final baseada no sucesso/falha online
          if (onlineErrorOccurred) { //
              setAlertMessage(`Registro excluído localmente, mas falha ao excluir online. Verifique a conexão e tente novamente mais tarde se necessário.`); //
          } else {
              setAlertMessage('Registro excluído com sucesso (local e online).'); //
          }
      } catch (localError) {
          console.error(`[Frontend][DeleteLocal] Erro CRÍTICO ao excluir localmente ${protocolBase}:`, localError); //
          setAlertMessage('Erro GRAVE ao tentar excluir o registro localmente. Verifique o console.'); //
      } finally {
          setIsDeleting(false); //
          setItemToDelete(null); //
          // Dispara evento para garantir que o SyncContext reavalie o status de upload
          window.dispatchEvent(new Event('localDataChanged')); //
      }
  };

  const handleConfirmOnlineDelete = async () => { //
      if (!itemToDelete || !deletePassword) { //
          setDeleteError('Senha é obrigatória.'); //
          return; //
      }

      setIsDeletePasswordOpen(false); //
      setIsDeleting(true); //
      setAlertMessage('Excluindo registro online...'); //

      const protocolBase = getProtocolBase(itemToDelete); //
      const activeEvent = localStorage.getItem('activeEvent'); //

      try {
          console.log(`[Frontend][DeleteOnline] Tentando excluir online protocolo base: ${protocolBase} com senha.`); //
          const response = await axios.post(`${API_URL}/api/delete-closing`, { //
              eventName: activeEvent, //
              protocolToDelete: protocolBase, //
              password: deletePassword // Envia a senha //
          });
          console.log(`[Frontend][DeleteOnline] Exclusão online para ${protocolBase} bem-sucedida.`); //

          // Atualiza a UI removendo o item do estado onlineClosings
          setOnlineClosings(prev => prev.filter(closing => getProtocolBase(closing) !== protocolBase)); //
          setAlertMessage(response.data.message || 'Registro excluído com sucesso online.'); //
          // Opcional: Atualizar lastUsedPassword se a senha funcionou?
          // setLastUsedPassword(deletePassword);

      } catch (error) {
          const errorMsg = error.response?.data?.message || "Falha ao excluir online."; //
          console.error(`[Frontend][DeleteOnline] Falha ao excluir online ${protocolBase}: ${errorMsg}`); //
          setAlertMessage(`Falha ao excluir online: ${errorMsg}`); // Mostra erro detalhado //
          // Reabre o modal de senha se a senha estiver incorreta
          if (error.response?.status === 401) { //
              setDeleteError('Senha incorreta.'); //
              setIsDeletePasswordOpen(true); //
              setTimeout(() => passwordInputRef.current?.focus(), 100); //
          }
      } finally {
          setIsDeleting(false); //
          // Não limpa itemToDelete aqui caso precise reabrir modal de senha
          if (!isDeletePasswordOpen) setItemToDelete(null); // Limpa só se não reabriu //
      }
  };


  return ( //
    <div className="app-container history-page-wrapper"> {/* */}
      {/* --- AlertModal para mensagens gerais --- */}
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} /> {/* */}

      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}> {/* */}
        <h1>Histórico de Fechamentos</h1> {/* */}
        <p className="menu-subtitle">Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong></p> {/* */}
        {/* ... (Botões de toggle, refresh, busca - sem alterações) ... */}
        <div className="view-toggle-container"> {/* */}
            <div className="view-toggle"> {/* */}
                <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>Dados Locais</button> {/* */}
                <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>Consultar Online</button> {/* */}
            </div>
            {viewMode === 'online' && (<button className="refresh-button" onClick={handleRefresh} title="Atualizar dados online" disabled={isDeleting}>🔄</button>)} {/* Desabilita refresh durante delete */} {/* */}
        </div>
        <div className="input-group"> {/* */}
            <input type="text" placeholder="🔎 Buscar por nome ou protocolo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{marginBottom: '20px'}} /> {/* */}
        </div>

        {/* ... (Lógica de Loading) ... */}
         {isLoading && viewMode === 'local' ? ( <p>Carregando dados locais...</p> ) : //
         isGlobalLoading && viewMode === 'online' ? ( <p>Carregando dados online...</p> ) : //
         filteredClosings.length === 0 ? ( <p className="empty-message">Nenhum fechamento encontrado.</p> ) : //
         ( //
            <div className="history-list"> {/* */}
                {filteredClosings.map((closing) => { //
                    // ... (Lógica para determinar name, title, totalValue, etc. - SEM ALTERAÇÕES) ...
                    const { type } = closing; //
                    let name, title, totalValue, differenceLabel, differenceValue, differenceColor; //

                    if (type === 'waiter') { //
                        title = 'Garçom'; //
                        name = closing.waiterName; //
                        totalValue = closing.valorTotal; //
                        differenceLabel = closing.diferencaLabel; //
                        differenceValue = closing.diferencaPagarReceber; //
                        differenceColor = differenceLabel === 'Pagar ao Garçom' ? 'blue' : 'red'; //
                    } else if (type === 'cashier' || type === 'individual_fixed_cashier') { //
                        title = type === 'cashier' ? 'Caixa Móvel' : 'Caixa Fixo'; //
                        name = closing.cashierName; //
                        totalValue = closing.valorTotalVenda; //
                        const diff = closing.diferenca; //

                        differenceValue = typeof diff === 'number' ? Math.abs(diff) : 0; //

                        if (diff > 0) { //
                            differenceLabel = 'Sobrou no Caixa'; //
                            differenceColor = 'green'; //
                        } else if (diff < 0) { //
                            differenceLabel = 'Faltou no Caixa'; //
                            differenceColor = 'red'; //
                        } else {
                            differenceLabel = 'Caixa Zerado'; //
                            differenceColor = 'blue'; //
                        }
                    } else {
                        title = "Registro Inválido"; name = "Verificar dados"; totalValue = 0; //
                        differenceLabel = "Erro"; differenceValue = 0; differenceColor = "orange"; //
                    }

                    return ( //
                        <div key={closing.protocol} className="history-card"> {/* */}
                           {/* ... (card-header com status de sync - SEM ALTERAÇÕES) ... */}
                           <div className="card-header"> {/* */}
                                <span className="protocol">{closing.groupProtocol || closing.protocol}</span> {/* */}
                                {viewMode === 'local' ? ( /* */
                                    closing.synced === true ? ( /* */
                                        <span className="sync-status synced">✔ Sincronizado</span> /* */
                                    ) : ( /* */
                                        <span className="sync-status pending">... Aguardando Envio</span> /* */
                                    )
                                ) : ( /* */
                                    <span className="sync-status synced">✔ Online</span> /* */
                                )}
                                <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span> {/* */}
                            </div>
                           {/* ... (card-body - SEM ALTERAÇÕES) ... */}
                            <div className="card-body"> {/* */}
                                <p><strong>{title}:</strong> {name}</p> {/* */}
                                <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p> {/* */}
                                <p className="acerto" style={{color: differenceColor}}> {/* */}
                                    <strong>{differenceLabel}:</strong> {formatCurrency(differenceValue)} {/* */}
                                </p>
                            </div>
                           {/* --- MODIFICAÇÃO: card-footer com botão Excluir --- */}
                            <div className="card-footer"> {/* */}
                                {/* Botão Excluir (condicional) */}
                                {viewMode === 'local' ? ( //
                                    <button className="delete-button" onClick={() => handleInitiateLocalDelete(closing)} disabled={isDeleting}>Excluir</button> //
                                ) : ( //
                                    <button className="delete-button" onClick={() => handleInitiateOnlineDelete(closing)} disabled={isDeleting}>Excluir Online</button> //
                                )}
                                {/* Botões Detalhes e Editar (condicional) */}
                                <div className="details-edit-group">
                                    <button className="details-button" onClick={() => handleViewDetails(closing)} disabled={isDeleting}>Detalhes</button> {/* */}
                                    {viewMode === 'local' && ( //
                                        <button className="edit-button" onClick={() => handleEdit(closing)} disabled={isDeleting}> {/* */}
                                            {closing.type === 'individual_fixed_cashier' ? 'Editar Grupo' : 'Editar'} {/* */}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* ... (Modal de Detalhes e Modal de Senha para Consulta Online - SEM ALTERAÇÕES) ... */}
      {isDetailsModalOpen && selectedClosing && ( /* */
         <div className="modal-overlay" onClick={closeDetailsModal}> /* */
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}> /* */
            <h2>Detalhes do Fechamento</h2> /* */
            {(() => {
              const { type } = selectedClosing; /* */
              const isWaiter = type === 'waiter'; /* */
              const isCashier = ['cashier', 'individual_fixed_cashier'].includes(type); /* */

              const name = selectedClosing.waiterName || selectedClosing.cashierName; /* */
              const title = isWaiter ? 'Garçom' : (type === 'cashier' ? 'Caixa Móvel' : 'Caixa Fixo'); /* */
              const totalValue = selectedClosing.valorTotal || selectedClosing.valorTotalVenda; /* */
              const differenceValue = isWaiter ? selectedClosing.diferencaPagarReceber : (typeof selectedClosing.diferenca === 'number' ? selectedClosing.diferenca : 0); /* */

              return ( /* */
                <>
                  <p><strong>Protocolo:</strong> {selectedClosing.groupProtocol || selectedClosing.protocol}</p> /* */
                  <p><strong>Data:</strong> {new Date(selectedClosing.timestamp).toLocaleString('pt-BR')}</p> /* */
                  <p><strong>{title}:</strong> {name}</p> /* */
                  <p><strong>Operador:</strong> {selectedClosing.operatorName}</p> /* */
                  <p><strong>Nº Máquina:</strong> {selectedClosing.numeroMaquina || 'N/A'}</p> /* */
                  <hr/> /* */
                  <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p> /* */
                  <p><strong>Crédito:</strong> {formatCurrency(selectedClosing.credito)}</p> /* */
                  <p><strong>Débito:</strong> {formatCurrency(selectedClosing.debito)}</p> /* */
                  <p><strong>PIX:</strong> {formatCurrency(selectedClosing.pix)}</p> /* */
                  <p><strong>Cashless:</strong> {formatCurrency(selectedClosing.cashless)}</p> /* */
                  {selectedClosing.temEstorno && <p><strong>Estorno:</strong> {formatCurrency(selectedClosing.valorEstorno)}</p>} /* */
                  <hr/> /* */
                  {isWaiter && <p><strong>Comissão Total:</strong> {formatCurrency(selectedClosing.comissaoTotal)}</p>} /* */
                  {isCashier && <p><strong>Dinheiro Físico:</strong> {formatCurrency(selectedClosing.dinheiroFisico)}</p>} /* */

                  <p className="total-text" style={{fontSize: '1.2em', marginTop: '15px'}}> /* */
                    Diferença Final:
                    <strong style={{ marginLeft: '10px' }}> /* */
                        {formatCurrency(differenceValue)} /* */
                    </strong>
                  </p>
                </>
              )
            })()}
            <div className="modal-buttons" style={{marginTop: '20px'}}> /* */
              <button className="cancel-button" onClick={closeDetailsModal}>Fechar</button> /* */
              {selectedClosing.type === 'waiter' && ( /* */
                  <button
                    className="confirm-button" /* Defina um estilo para confirm-button se necessário */
                    onClick={() => generateWaiterReceiptPDF(selectedClosing)} /* */
                  >
                    Imprimir 2ª Via
                  </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && ( /* */
        <div className="modal-overlay"> /* */
          <div className="modal-content" style={{maxWidth: '400px'}}> /* */
            <h2>Acessar Histórico Online</h2> /* */
            <p>Digite a senha para consultar os dados na nuvem.</p> /* */
            <div className="input-group"> /* */
                <input
                    type="password"
                    placeholder="Senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKeyDown}
                    autoFocus
                />
            </div>
            {onlineError && <p className="error-message" style={{textAlign: 'center'}}>{onlineError}</p>} /* */
            <div className="modal-buttons"> /* */
                <button className="cancel-button" onClick={() => { setIsPasswordModalOpen(false); setOnlineError(''); }}>Cancelar</button> {/* Limpa erro ao cancelar */} {/* */}
                <button className="confirm-button" onClick={() => fetchOnlineData(password)} disabled={isGlobalLoading}> {/* Desabilita durante carregamento */} {/* */}
                  {isGlobalLoading ? 'Buscando...' : 'Confirmar'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal de Confirmação de Exclusão (Local) --- */}
      {isDeleteConfirmOpen && ( //
          <div className="modal-overlay"> {/* */}
              <div className="modal-content" style={{ maxWidth: '450px' }}> {/* */}
                  <h2>Confirmar Exclusão</h2> {/* */}
                  <p>
                      Tem certeza que deseja excluir o registro com protocolo
                      <strong> {getProtocolBase(itemToDelete)}</strong>?
                  </p>
                  <p>Esta ação removerá o registro localmente e tentará removê-lo da planilha online. <strong>Esta ação não pode ser desfeita.</strong></p> {/* */}
                  <div className="modal-buttons"> {/* */}
                      <button className="cancel-button" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancelar</button> {/* */}
                      <button className="delete-button-confirm" onClick={handleConfirmLocalDelete} disabled={isDeleting}> {/* Use delete-button-confirm para estilo */} {/* */}
                          {isDeleting ? 'Excluindo...' : 'Sim, Excluir'} {/* */}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Modal de Senha para Exclusão (Online) --- */}
      {isDeletePasswordOpen && ( //
          <div className="modal-overlay"> {/* */}
              <div className="modal-content" style={{ maxWidth: '450px' }}> {/* */}
                  <h2>Excluir Registro Online</h2> {/* */}
                   <p>
                      Digite a senha para confirmar a exclusão online do registro
                      <strong> {getProtocolBase(itemToDelete)}</strong>.
                  </p>
                  <p><strong>Esta ação não pode ser desfeita.</strong></p> {/* */}
                  <div className="input-group"> {/* */}
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
                  {deleteError && <p className="error-message" style={{ textAlign: 'center' }}>{deleteError}</p>} {/* Exibe erro de senha */} {/* */}
                  <div className="modal-buttons"> {/* */}
                      <button className="cancel-button" onClick={() => { setIsDeletePasswordOpen(false); setDeleteError(''); setItemToDelete(null); }} disabled={isDeleting}>Cancelar</button> {/* Limpa item ao cancelar */} {/* */}
                      <button className="delete-button-confirm" onClick={handleConfirmOnlineDelete} disabled={isDeleting}> {/* */}
                          {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão Online'} {/* */}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Loading Global (se necessário) --- */}
      {(isGlobalLoading || isDeleting) && ( // Mostra se busca online OU exclui
        <div className="modal-overlay"> {/* */}
          <div className="loading-container"> {/* */}
            <div className="loading-spinner"></div> {/* */}
            <p>{isDeleting ? 'Excluindo...' : 'Buscando dados na nuvem...'}</p> {/* Mensagem dinâmica */} {/* */}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingHistoryPage; //