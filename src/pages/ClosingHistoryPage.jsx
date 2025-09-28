// src/pages/ClosingHistoryPage.js (Versão Completa com Pop-up e Centralização)

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ClosingHistoryPage.css';
import '../App.css';

const formatCurrency = (value) => {
    if (isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function ClosingHistoryPage() {
  const navigate = useNavigate();
  const [allClosings, setAllClosings] = useState([]);
  const [filteredClosings, setFilteredClosings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para controlar o pop-up (modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState(null);

  useEffect(() => {
    const loadClosings = () => {
      const activeEvent = localStorage.getItem('activeEvent');
      const localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = localClosings.filter(c => c.eventName === activeEvent);
      eventClosings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAllClosings(eventClosings);
      setFilteredClosings(eventClosings);
      setIsLoading(false);
    };
    loadClosings();
  }, []);

  useEffect(() => {
    if (searchQuery === '') {
      setFilteredClosings(allClosings);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = allClosings.filter(closing =>
        closing.waiterName?.toLowerCase().includes(lowercasedQuery)
      );
      setFilteredClosings(filtered);
    }
  }, [searchQuery, allClosings]);

  const handleEdit = (closing) => {
    navigate('/waiter-closing', { state: { closingToEdit: closing } });
  };
  
  // Função para abrir o pop-up com os dados do fechamento clicado
  const handleViewDetails = (closing) => {
    setSelectedClosing(closing);
    setIsModalOpen(true);
  };

  // Função para fechar o pop-up
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedClosing(null);
  };

  return (
    <div className="app-container" style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}>
        <h1>Histórico de Fechamentos Locais</h1>
        <p className="menu-subtitle" style={{textAlign: 'center', marginBottom: '20px'}}>
            Exibindo registros para o evento: <strong>{localStorage.getItem('activeEvent')}</strong>
        </p>

        <div className="input-group">
            <input
                type="text"
                placeholder="🔎 Buscar pelo nome do garçom..."
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
            <div 
              className="history-list" 
              style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                gap: '20px' 
              }}
            >
                {filteredClosings.map((closing) => (
                    <div key={closing.protocol} className="history-card">
                        <div className="card-header">
                            <span className="protocol">{closing.protocol}</span>
                            <span className="date">
                                {closing.timestamp ? new Date(closing.timestamp).toLocaleString('pt-BR') : 'Sem data'}
                            </span>
                        </div>
                        <div className="card-body">
                            <p><strong>Garçom:</strong> {closing.waiterName || 'N/A'}</p>
                            <p><strong>Venda Total:</strong> {formatCurrency(closing.valorTotal)}</p>
                            <p className="acerto" style={{color: closing.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red'}}>
                                <strong>{closing.diferencaLabel}:</strong> {formatCurrency(closing.diferencaPagarReceber)}
                            </p>
                        </div>
                        <div className="card-footer">
                            <button className="details-button" onClick={() => handleViewDetails(closing)}>
                                Detalhes
                            </button>
                            <button className="edit-button" onClick={() => handleEdit(closing)}>
                                Editar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* ESTRUTURA DO POP-UP (MODAL) */}
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
            <p><strong>Valor Final de Acerto:</strong> {formatCurrency(selectedClosing.valorTotalAcerto)}</p>
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

    </div>
  );
}

export default ClosingHistoryPage;