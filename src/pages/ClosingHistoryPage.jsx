import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const loadLocalClosings = () => {
      const activeEvent = localStorage.getItem('activeEvent');
      const allLocal = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allLocal.filter(c => c.eventName === activeEvent);
      eventClosings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLocalClosings(eventClosings);
      setFilteredClosings(eventClosings);
      setIsLoading(false);
    };
    loadLocalClosings();
  }, []);

  useEffect(() => {
    const sourceData = viewMode === 'local' ? localClosings : onlineClosings;
    if (searchQuery === '') {
      setFilteredClosings(sourceData);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = sourceData.filter(closing => {
        const nameToSearch = closing.waiterName || closing.cashierName || '';
        return nameToSearch.toLowerCase().includes(lowercasedQuery) ||
               closing.protocol?.toLowerCase().includes(lowercasedQuery);
      });
      setFilteredClosings(filtered);
    }
  }, [searchQuery, viewMode, localClosings, onlineClosings]);

  const handleEdit = (closing) => {
    const targetPath = closing.type === 'waiter' ? '/waiter-closing' : '/mobile-cashier-closing';
    navigate(targetPath, { state: { closingToEdit: closing } });
  };
  
  const handleViewDetails = (closing) => {
    setSelectedClosing(closing);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedClosing(null);
  };

  const fetchOnlineData = async (passwordToUse) => {
    setIsPasswordModalOpen(false);
    setIsGlobalLoading(true);
    setOnlineError('');
    try {
      const activeEvent = localStorage.getItem('activeEvent');
      const response = await axios.post(`${API_URL}/api/online-history`, {
        eventName: activeEvent,
        password: passwordToUse,
      });
      
      const sortedData = response.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setOnlineClosings(sortedData);
      setLastUsedPassword(passwordToUse);
      setViewMode('online');
      setPassword('');
    } catch (error) {
      const message = error.response?.data?.message || 'Falha ao buscar dados. Tente novamente.';
      setOnlineError(message);
      setIsPasswordModalOpen(true);
    } finally {
      setIsGlobalLoading(false);
    }
  };
  
  const handleRefresh = () => {
    if (lastUsedPassword) {
      fetchOnlineData(lastUsedPassword);
    }
  };

  const handlePasswordKeyDown = (event) => {
    if (event.key === 'Enter') {
      fetchOnlineData(password);
    }
  };

  return (
    <div className="app-container history-page-wrapper">
      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}>
        <h1>Histórico de Fechamentos</h1>
        <p className="menu-subtitle">
            Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong>
        </p>

        <div className="view-toggle-container">
            <div className="view-toggle">
                <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>
                    Dados Locais
                </button>
                <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>
                    Consultar Online
                </button>
            </div>
            {viewMode === 'online' && (
                <button className="refresh-button" onClick={handleRefresh} title="Atualizar dados online">
                    🔄
                </button>
            )}
        </div>

        <div className="input-group">
            <input
                type="text"
                placeholder="🔎 Buscar por nome ou protocolo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{marginBottom: '20px'}}
            />
        </div>
        
        {isLoading ? ( <p>Carregando...</p> ) : 
         filteredClosings.length === 0 ? ( <p className="empty-message">Nenhum fechamento encontrado.</p> ) : 
         (
            <div className="history-list">
                {filteredClosings.map((closing) => {
                    // --- INÍCIO DA CORREÇÃO: LÓGICA DE UNIFICAÇÃO DOS DADOS PARA EXIBIÇÃO ---
                    const isWaiter = closing.type === 'waiter';
                    
                    // Defensivamente, pega o nome ou do campo de garçom ou do de caixa
                    const name = closing.waiterName || closing.cashierName;
                    const title = isWaiter ? 'Garçom' : 'Caixa';
                    
                    // Pega o valor total ou do campo de garçom ou do de caixa
                    const totalValue = closing.valorTotal || closing.valorTotalVenda;
                    
                    let differenceLabel = '';
                    let differenceValue = 0;
                    let differenceColor = 'black';

                    if (isWaiter) {
                        differenceLabel = closing.diferencaLabel;
                        differenceValue = closing.diferencaPagarReceber;
                        differenceColor = closing.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red';
                    } else { // Lógica para Caixa (Local e Online)
                        // A diferença do caixa pode estar em 'diferenca' (correto) ou 'diferencaPagarReceber' (incorreto)
                        let diff = typeof closing.diferenca === 'number' ? closing.diferenca : closing.diferencaPagarReceber;
                        
                        differenceValue = typeof diff === 'number' ? diff : 0;

                        if (differenceValue > 0) {
                            differenceLabel = 'Sobrou no Caixa';
                            differenceColor = 'green';
                        } else if (differenceValue < 0) {
                            differenceLabel = 'Faltou no Caixa';
                            differenceColor = 'red';
                        } else {
                            differenceLabel = 'Caixa Zerado';
                            differenceColor = 'blue';
                        }
                        differenceValue = Math.abs(differenceValue);
                    }

                    return (
                        <div key={closing.protocol} className="history-card">
                           <div className="card-header">
                                <span className="protocol">{closing.protocol}</span>
                                <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="card-body">
                                <p><strong>{title}:</strong> {name || 'N/A'}</p>
                                <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p>
                                <p className="acerto" style={{color: differenceColor}}>
                                    <strong>{differenceLabel}:</strong> {formatCurrency(differenceValue)}
                                </p>
                            </div>
                            <div className="card-footer">
                                <button className="details-button" onClick={() => handleViewDetails(closing)}>Detalhes</button>
                                {viewMode === 'local' && (
                                    <button className="edit-button" onClick={() => handleEdit(closing)}>Editar</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* O MODAL DE DETALHES TAMBÉM FOI CORRIGIDO PARA SER MAIS ROBUSTO */}
      {isDetailsModalOpen && selectedClosing && (
         <div className="modal-overlay" onClick={closeDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <h2>Detalhes do Fechamento</h2>
            {(() => {
              const isWaiter = selectedClosing.type === 'waiter';
              const name = selectedClosing.waiterName || selectedClosing.cashierName;
              const title = isWaiter ? 'Garçom' : 'Caixa';
              const totalValue = selectedClosing.valorTotal || selectedClosing.valorTotalVenda;
              const differenceValue = typeof selectedClosing.diferenca === 'number' ? selectedClosing.diferenca : selectedClosing.diferencaPagarReceber;

              return (
                <>
                  <p><strong>Protocolo:</strong> {selectedClosing.protocol}</p>
                  <p><strong>Data:</strong> {new Date(selectedClosing.timestamp).toLocaleString('pt-BR')}</p>
                  <p><strong>{title}:</strong> {name}</p>
                  <p><strong>Operador:</strong> {selectedClosing.operatorName}</p>
                  <p><strong>Nº Máquina:</strong> {selectedClosing.numeroMaquina || 'N/A'}</p>
                  <hr/>
                  <p><strong>Venda Total:</strong> {formatCurrency(totalValue)}</p>
                  <p><strong>Crédito:</strong> {formatCurrency(selectedClosing.credito)}</p>
                  <p><strong>Débito:</strong> {formatCurrency(selectedClosing.debito)}</p>
                  <p><strong>PIX:</strong> {formatCurrency(selectedClosing.pix)}</p>
                  <p><strong>Cashless:</strong> {formatCurrency(selectedClosing.cashless)}</p>
                  {selectedClosing.temEstorno && <p><strong>Estorno:</strong> {formatCurrency(selectedClosing.valorEstorno)}</p>}
                  <hr/>
                  {isWaiter && <p><strong>Comissão Total:</strong> {formatCurrency(selectedClosing.comissaoTotal)}</p>}
                  {isWaiter && selectedClosing.valorTotalAcerto !== undefined && <p><strong>Valor Final de Acerto:</strong> {formatCurrency(selectedClosing.valorTotalAcerto)}</p>}
                  {!isWaiter && <p><strong>Valor do Acerto:</strong> {formatCurrency(selectedClosing.valorAcerto)}</p>}
                  <hr/>
                   <p className="total-text" style={{fontSize: '1.2em'}}>
                      Diferença Final:
                      <strong style={{ marginLeft: '10px' }}>
                          {formatCurrency(differenceValue)}
                      </strong>
                  </p>
                </>
              )
            })()}
            <div className="modal-buttons" style={{marginTop: '20px'}}>
              <button className="cancel-button" onClick={closeDetailsModal}>Fechar</button>
              {selectedClosing.type === 'waiter' && (
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

      {/* O restante do código para os modais de senha e loading continua o mesmo */}
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
                <button className="cancel-button" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</button>
                <button className="confirm-button" onClick={() => fetchOnlineData(password)}>
                  Confirmar
                </button>
            </div>
          </div>
        </div>
      )}

      {isGlobalLoading && (
        <div className="modal-overlay">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Buscando dados na nuvem...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingHistoryPage;