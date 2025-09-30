import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
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
  const [viewMode, setViewMode] = useState('local'); // 'local' ou 'online'
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [onlineError, setOnlineError] = useState('');
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);

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
      const filtered = sourceData.filter(closing =>
        closing.waiterName?.toLowerCase().includes(lowercasedQuery) ||
        closing.protocol?.toLowerCase().includes(lowercasedQuery)
      );
      setFilteredClosings(filtered);
    }
  }, [searchQuery, viewMode, localClosings, onlineClosings]);

  const handleEdit = (closing) => {
    navigate('/waiter-closing', { state: { closingToEdit: closing } });
  };
  
  const handleViewDetails = (closing) => {
    setSelectedClosing(closing);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedClosing(null);
  };

  const handleOnlineSearch = async () => {
    setIsLoadingOnline(true);
    setOnlineError('');
    try {
      const activeEvent = localStorage.getItem('activeEvent');
      const response = await axios.post(`${API_URL}/api/online-history`, {
        eventName: activeEvent,
        password: password,
      });
      setOnlineClosings(response.data);
      setViewMode('online');
      setIsPasswordModalOpen(false);
      setPassword('');
    } catch (error) {
      const message = error.response?.data?.message || 'Falha ao buscar dados. Tente novamente.';
      setOnlineError(message);
    } finally {
      setIsLoadingOnline(false);
    }
  };

  return (
    <div className="app-container" style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}>
        <h1>Histórico de Fechamentos</h1>
        <p className="menu-subtitle" style={{textAlign: 'center', marginBottom: '20px'}}>
            Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong>
        </p>

        <div className="view-toggle">
            <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>
                Dados Locais
            </button>
            <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>
                Consultar Online
            </button>
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
        
        {isLoading ? (
            <p>Carregando...</p>
        ) : filteredClosings.length === 0 ? (
            <p className="empty-message">Nenhum fechamento encontrado com os critérios de busca.</p>
        ) : (
            <div className="history-list">
                {filteredClosings.map((closing) => (
                    <div key={closing.protocol} className="history-card">
                        <div className="card-header">
                            <span className="protocol">{closing.protocol}</span>
                            <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="card-body">
                            <p><strong>Garçom:</strong> {closing.waiterName || 'N/A'}</p>
                            <p><strong>Venda Total:</strong> {formatCurrency(closing.valorTotal)}</p>
                            <p className="acerto" style={{color: closing.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red'}}>
                                <strong>{closing.diferencaLabel}:</strong> {formatCurrency(closing.diferencaPagarReceber)}
                            </p>
                        </div>
                        <div className="card-footer">
                            <button className="details-button" onClick={() => handleViewDetails(closing)}>Detalhes</button>
                            {viewMode === 'local' && (
                                <button className="edit-button" onClick={() => handleEdit(closing)}>Editar</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* ===== INÍCIO DO CÓDIGO CORRIGIDO ===== */}
      {isModalOpen && selectedClosing && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '500px'}}>
            <h2>Detalhes do Fechamento</h2>
            <p><strong>Protocolo:</strong> {selectedClosing.protocol}</p>
            <p><strong>Data:</strong> {new Date(selectedClosing.timestamp).toLocaleString('pt-BR')}</p>
            <p><strong>Garçom:</strong> {selectedClosing.waiterName}</p>
            <p><strong>Operador:</strong> {selectedClosing.operatorName}</p>
            <p><strong>Nº Máquina:</strong> {selectedClosing.numeroMaquina || 'N/A'}</p>
            <hr/>
            <p><strong>Venda Total:</strong> {formatCurrency(selectedClosing.valorTotal)}</p>
            <p><strong>Crédito:</strong> {formatCurrency(selectedClosing.credito)}</p>
            <p><strong>Débito:</strong> {formatCurrency(selectedClosing.debito)}</p>
            <p><strong>PIX:</strong> {formatCurrency(selectedClosing.pix)}</p>
            <p><strong>Cashless:</strong> {formatCurrency(selectedClosing.cashless)}</p>
            {selectedClosing.temEstorno && <p><strong>Estorno:</strong> {formatCurrency(selectedClosing.valorEstorno)}</p>}
             <hr/>
            <p><strong>Comissão Total:</strong> {formatCurrency(selectedClosing.comissaoTotal)}</p>
            {selectedClosing.valorTotalAcerto !== undefined && <p><strong>Valor Final de Acerto:</strong> {formatCurrency(selectedClosing.valorTotalAcerto)}</p>}
            <hr/>
             <p className="total-text" style={{fontSize: '1.2em'}}>
                {selectedClosing.diferencaLabel}: 
                <strong style={{ color: selectedClosing.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red', marginLeft: '10px' }}>
                    {formatCurrency(selectedClosing.diferencaPagarReceber)}
                </strong>
            </p>
            <div className="modal-buttons" style={{marginTop: '20px'}}>
              <button className="cancel-button" onClick={closeModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {/* ===== FIM DO CÓDIGO CORRIGIDO ===== */}

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
                    autoFocus
                />
            </div>
            {onlineError && <p className="error-message" style={{textAlign: 'center'}}>{onlineError}</p>}
            <div className="modal-buttons">
                <button className="cancel-button" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</button>
                <button className="confirm-button" onClick={handleOnlineSearch} disabled={isLoadingOnline}>
                    {isLoadingOnline ? 'Consultando...' : 'Confirmar'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingHistoryPage;