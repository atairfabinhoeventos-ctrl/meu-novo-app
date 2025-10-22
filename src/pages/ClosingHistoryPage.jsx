// src/pages/ClosingHistoryPage.jsx

import React, { useState, useEffect, useCallback } from 'react'; // Adicionado useCallback
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { generateWaiterReceiptPDF } from '../services/pdfService';
import './ClosingHistoryPage.css';
import '../App.css';

const formatCurrency = (value) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [onlineError, setOnlineError] = useState('');

  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [lastUsedPassword, setLastUsedPassword] = useState('');

  // --- INÍCIO DA MODIFICAÇÃO (Passo 2.1) ---
  // Mova a lógica de carregamento para uma função useCallback
  const loadLocalClosings = useCallback(() => { //
    console.log("[ClosingHistoryPage] loadLocalClosings chamada."); // Log
    setIsLoading(true); // Mostra loading ao recarregar
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
                protocol: `${closing.protocol}-${index}`, //
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
        // Não defina filteredClosings aqui, o useEffect de filtro cuidará disso
    } catch (error) {
        console.error("[ClosingHistoryPage] Erro ao carregar dados locais:", error);
        setLocalClosings([]); // Limpa em caso de erro
    } finally {
       setIsLoading(false); //
    }
  }, []); // useCallback depende de nada externo à função

  // Carregamento inicial
  useEffect(() => { //
    loadLocalClosings(); // Chama a função na montagem //
  }, [loadLocalClosings]); // Depende da função useCallback

  // ADICIONE ESTE useEffect PARA O LISTENER (Passo 2.2)
  useEffect(() => {
    const handleLocalDataChange = () => {
      console.log("[ClosingHistoryPage] Evento localDataChanged recebido. Recarregando dados locais...");
      loadLocalClosings();
    };

    console.log("[ClosingHistoryPage] Adicionando listener para localDataChanged");
    window.addEventListener('localDataChanged', handleLocalDataChange);

    // Função de limpeza para remover o listener quando o componente desmontar
    return () => {
      console.log("[ClosingHistoryPage] Removendo listener para localDataChanged");
      window.removeEventListener('localDataChanged', handleLocalDataChange);
    };
  }, [loadLocalClosings]); // Depende da função loadLocalClosings
  // --- FIM DA MODIFICAÇÃO ---


  useEffect(() => { //
    console.log("[ClosingHistoryPage] Recalculando filtro. ViewMode:", viewMode, "Query:", searchQuery); // Log
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
    console.log("[ClosingHistoryPage] Filtro recalculado. Resultados:", filteredClosings.length); // Log
  }, [searchQuery, viewMode, localClosings, onlineClosings]); // Agora também depende de localClosings //

  const handleEdit = (closing) => { //
    let targetPath = ''; //
    let closingDataToSend = closing; //

    if (closing.type === 'individual_fixed_cashier') { //
        targetPath = '/fixed-cashier-closing'; //
        // Busca o objeto PAI (grupo) no estado rawLocalClosings usando o groupProtocol
        closingDataToSend = rawLocalClosings.find(c => c.protocol === closing.groupProtocol); //
        if (!closingDataToSend) {
            console.error("Erro ao encontrar dados do grupo para edição:", closing.groupProtocol);
            alert("Erro: Não foi possível encontrar os dados originais do grupo para edição.");
            return;
        }
    } else if (closing.type === 'waiter') { //
        targetPath = '/waiter-closing'; //
    } else if (closing.type === 'cashier') { //
        targetPath = '/mobile-cashier-closing'; //
    }

    if (targetPath && closingDataToSend) { //
        navigate(targetPath, { state: { closingToEdit: closingDataToSend } }); //
    }
  };

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
      setOnlineError(message); setIsPasswordModalOpen(true); //
    } finally { setIsGlobalLoading(false); } //
  };

  const handleRefresh = () => { if (lastUsedPassword) { fetchOnlineData(lastUsedPassword); } }; //
  const handlePasswordKeyDown = (event) => { if (event.key === 'Enter') { fetchOnlineData(password); } }; //

  return ( //
    <div className="app-container history-page-wrapper"> {/* */}
      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}> {/* */}
        <h1>Histórico de Fechamentos</h1> {/* */}
        <p className="menu-subtitle">Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong></p> {/* */}
        <div className="view-toggle-container"> {/* */}
            <div className="view-toggle"> {/* */}
                <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>Dados Locais</button> {/* */}
                <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>Consultar Online</button> {/* */}
            </div>
            {viewMode === 'online' && (<button className="refresh-button" onClick={handleRefresh} title="Atualizar dados online">🔄</button>)} {/* */}
        </div>
        <div className="input-group"> {/* */}
            <input type="text" placeholder="🔎 Buscar por nome ou protocolo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{marginBottom: '20px'}} /> {/* */}
        </div>

        {/* --- Lógica de Loading Modificada --- */}
        {isLoading && viewMode === 'local' ? ( <p>Carregando dados locais...</p> ) :
         isGlobalLoading && viewMode === 'online' ? ( <p>Carregando dados online...</p> ) :
         filteredClosings.length === 0 ? ( <p className="empty-message">Nenhum fechamento encontrado.</p> ) :
         (
            <div className="history-list"> {/* */}
                {filteredClosings.map((closing) => { //
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
                           <div className="card-header"> {/* */}
                                <span className="protocol">{closing.groupProtocol || closing.protocol}</span> {/* */}

                                {/* --- STATUS DE SYNC (JÁ CORRIGIDO ANTERIORMENTE) --- */}
                                {viewMode === 'local' ? ( //
                                    closing.synced === true ? ( //
                                        <span className="sync-status synced"> {/* */}
                                            ✔ Sincronizado
                                        </span>
                                    ) : (
                                        <span className="sync-status pending"> {/* */}
                                            ... Aguardando Envio
                                        </span>
                                    )
                                ) : ( //
                                    // No modo online, consideramos tudo sincronizado (pois veio da nuvem)
                                    <span className="sync-status synced">
                                        ✔ Online
                                    </span>
                                )}

                                <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span> {/* */}
                            </div>
                            <div className="card-body"> {/* */}
                                <p><strong>{title}:</strong> {name}</p> {/* */}
                                <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p> {/* */}
                                <p className="acerto" style={{color: differenceColor}}> {/* */}
                                    <strong>{differenceLabel}:</strong> {formatCurrency(differenceValue)} {/* */}
                                </p>
                            </div>
                            <div className="card-footer"> {/* */}
                                <button className="details-button" onClick={() => handleViewDetails(closing)}>Detalhes</button> {/* */}
                                {viewMode === 'local' && ( //
                                    <button className="edit-button" onClick={() => handleEdit(closing)}> {/* */}
                                        {closing.type === 'individual_fixed_cashier' ? 'Editar Grupo' : 'Editar'} {/* */}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* --- Modais (sem alterações funcionais) --- */}
      {isDetailsModalOpen && selectedClosing && ( //
         <div className="modal-overlay" onClick={closeDetailsModal}> {/* */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}> {/* */}
            <h2>Detalhes do Fechamento</h2> {/* */}
            {(() => {
              const { type } = selectedClosing; //
              const isWaiter = type === 'waiter'; //
              const isCashier = ['cashier', 'individual_fixed_cashier'].includes(type); //

              const name = selectedClosing.waiterName || selectedClosing.cashierName; //
              const title = isWaiter ? 'Garçom' : (type === 'cashier' ? 'Caixa Móvel' : 'Caixa Fixo'); //
              const totalValue = selectedClosing.valorTotal || selectedClosing.valorTotalVenda; //
              const differenceValue = isWaiter ? selectedClosing.diferencaPagarReceber : (typeof selectedClosing.diferenca === 'number' ? selectedClosing.diferenca : 0); //

              return ( //
                <>
                  <p><strong>Protocolo:</strong> {selectedClosing.groupProtocol || selectedClosing.protocol}</p> {/* */}
                  <p><strong>Data:</strong> {new Date(selectedClosing.timestamp).toLocaleString('pt-BR')}</p> {/* */}
                  <p><strong>{title}:</strong> {name}</p> {/* */}
                  <p><strong>Operador:</strong> {selectedClosing.operatorName}</p> {/* */}
                  <p><strong>Nº Máquina:</strong> {selectedClosing.numeroMaquina || 'N/A'}</p> {/* */}
                  <hr/> {/* */}
                  <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p> {/* */}
                  <p><strong>Crédito:</strong> {formatCurrency(selectedClosing.credito)}</p> {/* */}
                  <p><strong>Débito:</strong> {formatCurrency(selectedClosing.debito)}</p> {/* */}
                  <p><strong>PIX:</strong> {formatCurrency(selectedClosing.pix)}</p> {/* */}
                  <p><strong>Cashless:</strong> {formatCurrency(selectedClosing.cashless)}</p> {/* */}
                  {selectedClosing.temEstorno && <p><strong>Estorno:</strong> {formatCurrency(selectedClosing.valorEstorno)}</p>} {/* */}
                  <hr/> {/* */}
                  {isWaiter && <p><strong>Comissão Total:</strong> {formatCurrency(selectedClosing.comissaoTotal)}</p>} {/* */}
                  {isCashier && <p><strong>Dinheiro Físico:</strong> {formatCurrency(selectedClosing.dinheiroFisico)}</p>} {/* */}

                  <p className="total-text" style={{fontSize: '1.2em', marginTop: '15px'}}> {/* */}
                    Diferença Final:
                    <strong style={{ marginLeft: '10px' }}> {/* */}
                        {formatCurrency(differenceValue)} {/* */}
                    </strong>
                  </p>
                </>
              )
            })()}
            <div className="modal-buttons" style={{marginTop: '20px'}}> {/* */}
              <button className="cancel-button" onClick={closeDetailsModal}>Fechar</button> {/* */}
              {selectedClosing.type === 'waiter' && ( //
                  <button
                    className="confirm-button"
                    onClick={() => generateWaiterReceiptPDF(selectedClosing)} //
                  >
                    Imprimir 2ª Via
                  </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && ( //
        <div className="modal-overlay"> {/* */}
          <div className="modal-content" style={{maxWidth: '400px'}}> {/* */}
            <h2>Acessar Histórico Online</h2> {/* */}
            <p>Digite a senha para consultar os dados na nuvem.</p> {/* */}
            <div className="input-group"> {/* */}
                <input
                    type="password"
                    placeholder="Senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKeyDown}
                    autoFocus
                />
            </div>
            {onlineError && <p className="error-message" style={{textAlign: 'center'}}>{onlineError}</p>} {/* */}
            <div className="modal-buttons"> {/* */}
                <button className="cancel-button" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</button> {/* */}
                <button className="confirm-button" onClick={() => fetchOnlineData(password)}> {/* */}
                  Confirmar
                </button>
            </div>
          </div>
        </div>
      )}

      {isGlobalLoading && ( //
        <div className="modal-overlay"> {/* */}
          <div className="loading-container"> {/* */}
            <div className="loading-spinner"></div> {/* */}
            <p>Buscando dados na nuvem...</p> {/* */}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingHistoryPage; //