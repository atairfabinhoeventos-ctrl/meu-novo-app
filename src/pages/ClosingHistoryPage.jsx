// src/pages/ClosingHistoryPage.jsx
// (VERSÃO FINAL: CONFIRMAÇÃO DUPLA NA EXCLUSÃO + AVISO DE NUVEM)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, APP_VERSION } from '../config'; 
import './ClosingHistoryPage.css';
import '../App.css';
import AlertModal from '../components/AlertModal.jsx';
import { formatCurrencyResult } from '../utils/formatters';

// --- HELPER PARA GERAR O HTML DO COMPROVANTE ---
const getReceiptHtml = (data) => {
    const logoSrc = '/logo.png';
    const printTime = new Date().toLocaleString('pt-BR');
    const { type, subType } = data;

    const commonStyles = `
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; margin: 0; padding: 10px; background: #fff; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; position: relative; min-height: 60px; display: flex; justify-content: center; align-items: center; }
        .logo-wrapper { position: absolute; left: 0; top: -10px; }
        .logo-img { max-height: 80px; max-width: 150px; width: auto; object-fit: contain; }
        .header-center { text-align: center; padding: 0 10px; }
        .header-right { position: absolute; right: 0; top: 0; text-align: right; font-size: 10px; }
        .title { font-size: 16px; font-weight: 800; text-transform: uppercase; }
        .info-strip { background-color: #f5f5f5; padding: 5px; border: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; }
        .box { border: 1px solid #999; border-radius: 2px; overflow: hidden; margin-bottom: 5px; }
        .box-title { background-color: #e0e0e0; font-weight: bold; padding: 4px; text-align: center; text-transform: uppercase; border-bottom: 1px solid #999; }
        .box-content { padding: 5px; }
        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 3px 0; }
        .row:last-child { border-bottom: none; }
        .row span:last-child { font-weight: bold; }
        .result-container { text-align: center; padding: 10px; border: 2px solid #000; margin-top: 10px; }
        .result-label { font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .result-value { font-size: 18px; font-weight: 900; margin-top: 5px; }
        .footer-sigs { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-block { text-align: center; width: 45%; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; }
        .system-footer { font-size: 9px; color: #555; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 5px; }
    `;

    let title = 'Comprovante';
    let contentBody = '';

    if (type === 'waiter' || type === 'waiter_10') {
        const is10 = subType === '10_percent' || type === 'waiter_10';
        title = is10 ? 'Garçom 10%' : 'Garçom 8%';
        const diffLabel = data.diferencaLabel || (data.diferencaPagarReceber >= 0 ? 'Pagar ao Garçom' : 'Receber do Garçom');
        
        contentBody = `
            <div class="grid" style="display: grid; grid-template-columns: 1.3fr 0.9fr 0.8fr; gap: 8px;">
                <div class="col-stack" style="display:flex; flex-direction:column; gap:8px;">
                    <div class="box">
                        <div class="box-title">Identificação</div>
                        <div class="box-content">
                            <div class="row"><span>Nome:</span> <strong>${data.waiterName}</strong></div>
                            <div class="row"><span>CPF:</span> <span>${data.cpf}</span></div>
                            <div class="row"><span>Máquina:</span> <span>${data.numeroMaquina}</span></div>
                            <div class="row"><span>Camisa:</span> <span>${data.numeroCamiseta}</span></div>
                        </div>
                    </div>
                    <div class="box">
                        <div class="box-title">Detalhes da Venda</div>
                        <div class="box-content">
                            <div class="row"><span>Crédito:</span> <span>${formatCurrencyResult(data.credito)}</span></div>
                            <div class="row"><span>Débito:</span> <span>${formatCurrencyResult(data.debito)}</span></div>
                            <div class="row"><span>PIX:</span> <span>${formatCurrencyResult(data.pix)}</span></div>
                            <div class="row"><span>Cashless:</span> <span>${formatCurrencyResult(data.cashless)}</span></div>
                            ${data.temEstorno ? `<div class="row" style="color:red"><span>Estorno:</span> <span>-${formatCurrencyResult(data.valorEstorno)}</span></div>` : ''}
                            <div class="row" style="background:#f0f0f0; font-weight:bold; padding:5px 0;"><span>VENDA BRUTA:</span> <span>${formatCurrencyResult(data.valorTotal)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-title">Comissões</div>
                    <div class="box-content">
                        ${data.comissao8 > 0 ? `<div class="row"><span>Venda (8%):</span> <span>${formatCurrencyResult(data.comissao8)}</span></div>` : ''}
                        <div class="row"><span>Cashless (4%):</span> <span>${formatCurrencyResult(data.comissao4)}</span></div>
                        ${data.comissao10 > 0 ? `<div class="row"><span>Venda (10%):</span> <span>${formatCurrencyResult(data.comissao10)}</span></div>` : ''}
                        <div class="row" style="background:#e0e0e0; font-weight:bold; padding:5px 0; margin-top:auto;"><span>TOTAL:</span> <span>${formatCurrencyResult(data.comissaoTotal)}</span></div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-title">Acerto Financeiro</div>
                    <div class="box-content">
                        <div class="result-container">
                            <div class="result-label">${diffLabel}</div>
                            <div class="result-value">${formatCurrencyResult(data.diferencaPagarReceber)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'waiter_zig') {
        title = 'ZIG Cashless 8%';
        const diffLabel = data.diferencaLabel || (data.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom'); 
        
        contentBody = `
            <div class="grid" style="display: grid; grid-template-columns: 1.3fr 0.8fr 0.9fr; gap: 8px;">
                <div class="col-stack" style="display:flex; flex-direction:column; gap:8px;">
                    <div class="box">
                        <div class="box-title">Identificação</div>
                        <div class="box-content">
                            <div class="row"><span>Nome:</span> <strong>${data.waiterName}</strong></div>
                            <div class="row"><span>CPF:</span> <span>${data.cpf}</span></div>
                            <div class="row"><span>Máquina:</span> <span>${data.numeroMaquina}</span></div>
                            <div class="row"><span>Camisa:</span> <span>${data.numeroCamiseta}</span></div>
                        </div>
                    </div>
                    <div class="box">
                        <div class="box-title">Detalhes da Venda</div>
                        <div class="box-content">
                            <div class="row"><span>Crédito:</span> <span>${formatCurrencyResult(data.credito)}</span></div>
                            <div class="row"><span>Débito:</span> <span>${formatCurrencyResult(data.debito)}</span></div>
                            <div class="row"><span>PIX:</span> <span>${formatCurrencyResult(data.pix)}</span></div>
                            ${data.temEstorno ? `<div class="row" style="color:red"><span>Estorno:</span> <span>-${formatCurrencyResult(data.valorEstorno)}</span></div>` : ''}
                            <div class="row" style="background:#f0f0f0; font-weight:bold; padding:5px 0;"><span>RECARGA:</span> <span>${formatCurrencyResult(data.valorTotal)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="col-stack" style="display:flex; flex-direction:column; gap:8px;">
                    <div class="box">
                        <div class="box-title">Produtos</div>
                        <div class="box-content" style="text-align:center;">
                            <div style="font-size:10px;">VENDA TOTAL</div>
                            <div style="font-weight:bold;">${formatCurrencyResult(data.valorTotalProdutos)}</div>
                        </div>
                    </div>
                    <div class="box">
                        <div class="box-title">Comissões</div>
                        <div class="box-content">
                            <div class="row"><span>Comissão (8%):</span> <span>${formatCurrencyResult(data.comissao8)}</span></div>
                            <div class="row" style="background:#e0e0e0; font-weight:bold; padding:5px 0;"><span>TOTAL:</span> <span>${formatCurrencyResult(data.comissaoTotal)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-title">Acerto Financeiro</div>
                    <div class="box-content">
                        <div class="result-container">
                            <div class="result-label">${diffLabel}</div>
                            <div class="result-value">${formatCurrencyResult(data.diferencaPagarReceber)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'cashier') {
        title = 'Caixa Móvel';
        const diffLabel = data.diferenca >= 0 ? 'SOBRA' : 'FALTA';
        const diffColor = data.diferenca >= 0 ? 'blue' : 'red';
        
        contentBody = `
            <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="box">
                    <div class="box-title">Detalhes da Venda</div>
                    <div class="box-content">
                        <div class="row"><span>Caixa:</span> <strong>${data.cashierName}</strong></div>
                        <div class="row"><span>CPF:</span> <span>${data.cpf}</span></div>
                        <div class="row"><span>Máquina:</span> <span>${data.numeroMaquina}</span></div>
                        <hr/>
                        <div class="row"><span>Crédito:</span> <span>${formatCurrencyResult(data.credito)}</span></div>
                        <div class="row"><span>Débito:</span> <span>${formatCurrencyResult(data.debito)}</span></div>
                        <div class="row"><span>PIX:</span> <span>${formatCurrencyResult(data.pix)}</span></div>
                        <div class="row"><span>Cashless:</span> <span>${formatCurrencyResult(data.cashless)}</span></div>
                        <div class="row" style="background:#f0f0f0; font-weight:bold;"><span>VENDA BRUTA:</span> <span>${formatCurrencyResult(data.valorTotalVenda)}</span></div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-title">Acerto Financeiro</div>
                    <div class="box-content">
                        <div class="row"><span>Fundo Troco:</span> <span>${formatCurrencyResult(data.valorTroco)}</span></div>
                        <div class="row"><span>A Apresentar:</span> <span>${formatCurrencyResult(data.valorAcerto)}</span></div>
                        <div class="row"><span>Contado:</span> <span>${formatCurrencyResult(data.dinheiroFisico)}</span></div>
                        <div class="result-container" style="border-color:${diffColor}">
                            <div class="result-label" style="color:${diffColor}">${diffLabel}</div>
                            <div class="result-value" style="color:${diffColor}">${formatCurrencyResult(data.diferenca)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="border-top: 2px dashed #000; margin-top: 20px; padding-top: 20px;">
                <div style="border: 2px solid #000; padding: 15px; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0;">RECIBO PAGAMENTO</h2>
                    <div style="background:#eee; padding:5px 15px; font-weight:bold; font-size:16px;">R$ 215,00</div>
                </div>
                <p style="margin-top:10px;">Recebi de FABINHO EVENTOS a importância de R$ 215,00 referente a 01 diária.</p>
                <div style="margin-top:30px; text-align:center; border-top:1px solid #000; width:50%; margin-left:auto; margin-right:auto;">${data.cashierName}</div>
            </div>
        `;
    } else if (type === 'fixed_cashier') {
        title = 'Caixa Fixo (Grupo)';
        const diffColor = data.diferencaCaixa >= 0 ? '#000' : 'red';
        
        let rowsHtml = '';
        if (data.caixas) {
            rowsHtml = data.caixas.map(c => `
                <tr>
                    <td style="border:1px solid #ccc; padding:3px;">${c.cashierName.split(' ')[0]}</td>
                    <td style="border:1px solid #ccc; padding:3px;">${c.numeroMaquina}</td>
                    <td style="border:1px solid #ccc; padding:3px;">${formatCurrencyResult(c.credito)}</td>
                    <td style="border:1px solid #ccc; padding:3px;">${formatCurrencyResult(c.debito)}</td>
                    <td style="border:1px solid #ccc; padding:3px;">${formatCurrencyResult(c.pix)}</td>
                    <td style="border:1px solid #ccc; padding:3px;">${formatCurrencyResult(c.cashless)}</td>
                </tr>
            `).join('');
        }

        contentBody = `
            <div class="summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="box">
                    <div class="box-title">Totais do Grupo</div>
                    <div class="box-content">
                        <div class="row"><span>Dinheiro Contado:</span> <strong>${formatCurrencyResult(data.totalDinheiroFisicoGrupo)}</strong></div>
                        <div class="row" style="color: blue;"><span>(+) Fundo Troco:</span> <strong>${formatCurrencyResult(data.valorTroco)}</strong></div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-title">Conferência</div>
                    <div class="box-content">
                        <div class="result-container" style="margin-top:0; border:none; padding:0;">
                            <div class="result-label">DIFERENÇA</div>
                            <div class="result-value" style="color:${diffColor}">${formatCurrencyResult(data.diferencaCaixa)}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="font-weight:bold; margin-bottom:5px;">Detalhamento por Freelancer</div>
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead>
                    <tr style="background:#e0e0e0;">
                        <th style="border:1px solid #999; padding:3px;">Nome</th>
                        <th style="border:1px solid #999; padding:3px;">Maq.</th>
                        <th style="border:1px solid #999; padding:3px;">Crédito</th>
                        <th style="border:1px solid #999; padding:3px;">Débito</th>
                        <th style="border:1px solid #999; padding:3px;">PIX</th>
                        <th style="border:1px solid #999; padding:3px;">Cashless</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }

    return `
        <html>
        <head>
            <style>${commonStyles}</style>
        </head>
        <body>
            <div class="header">
                <div class="logo-wrapper"><img src="${logoSrc}" class="logo-img"/></div>
                <div class="header-center">
                    <div class="title">Recibo de Fechamento</div>
                    <div>${title}</div>
                </div>
                <div class="header-right">
                    <div style="border:1px solid #000; padding:2px 5px;">PROT: ${data.protocol || 'N/A'}</div>
                </div>
            </div>
            <div class="info-strip">
                <div><strong>Evento:</strong> ${data.eventName}</div>
                <div><strong>Operador:</strong> ${data.operatorName}</div>
                <div><strong>Data:</strong> ${new Date(data.timestamp).toLocaleDateString('pt-BR')}</div>
            </div>
            ${contentBody}
            <div class="footer-sigs">
                <div class="sig-block">${data.waiterName || data.cashierName || 'Responsável'}</div>
                <div class="sig-block">Assinatura Conferente</div>
            </div>
            <div class="system-footer">Sistema v${APP_VERSION || '1.0'} | Impresso em: ${printTime}</div>
        </body>
        </html>
    `;
};

// --- HELPER PROTOCOLO ---
const getProtocolBase = (closing) => {
    return closing?.groupProtocol || closing?.protocol || null;
};

function ClosingHistoryPage() {
  const navigate = useNavigate();
  const [localClosings, setLocalClosings] = useState([]);
  const [onlineClosings, setOnlineClosings] = useState([]);
  const [filteredClosings, setFilteredClosings] = useState([]);
  const [viewMode, setViewMode] = useState('local');
  const [filterType, setFilterType] = useState('all'); 
  const [expandedGroups, setExpandedGroups] = useState(new Set()); 

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modais de Visualização e Senha
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [onlineError, setOnlineError] = useState('');
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  
  // Modais de Exclusão (Confirmação Dupla)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);       // Confirmação 1
  const [isDoubleConfirmOpen, setIsDoubleConfirmOpen] = useState(false);       // Confirmação 2 (Dupla)
  const [isDeletePasswordOpen, setIsDeletePasswordOpen] = useState(false);     // Exclusão Online (Senha)
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const loadLocalClosings = useCallback(() => {
    setIsLoading(true);
    try {
        const activeEvent = localStorage.getItem('activeEvent');
        const allLocal = JSON.parse(localStorage.getItem('localClosings')) || [];
        const eventClosings = allLocal.filter(c => c.eventName === activeEvent);
        eventClosings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLocalClosings(eventClosings);
    } catch (error) {
        setLocalClosings([]);
    } finally {
       setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadLocalClosings(); }, [loadLocalClosings]);

  useEffect(() => {
    const handleLocalDataChange = () => loadLocalClosings();
    window.addEventListener('localDataChanged', handleLocalDataChange);
    return () => window.removeEventListener('localDataChanged', handleLocalDataChange);
  }, [loadLocalClosings]);

  // Filtros
  useEffect(() => {
    const sourceData = viewMode === 'local' ? localClosings : onlineClosings;
    let filtered = sourceData;

    if (filterType !== 'all') {
        filtered = filtered.filter(item => {
            if (filterType === 'waiter_8') return item.type === 'waiter' && item.subType !== '10_percent';
            if (filterType === 'waiter_10') return item.type === 'waiter_10' || (item.type === 'waiter' && item.subType === '10_percent');
            if (filterType === 'waiter_zig') return item.type === 'waiter_zig';
            if (filterType === 'cashier') return item.type === 'cashier';
            if (filterType === 'fixed_cashier') return item.type === 'fixed_cashier';
            return true;
        });
    }

    if (searchQuery !== '') {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(closing => {
        if (closing.type === 'fixed_cashier' && closing.caixas) {
            const foundInGroup = closing.caixas.some(c => c.cashierName.toLowerCase().includes(lowercasedQuery));
            if (foundInGroup) return true;
        }
        const nameToSearch = (closing.waiterName || closing.cashierName || '').toLowerCase();
        return nameToSearch.includes(lowercasedQuery) ||
               (closing.protocol && closing.protocol.toLowerCase().includes(lowercasedQuery));
      });
    }
    setFilteredClosings(filtered);
  }, [searchQuery, viewMode, localClosings, onlineClosings, filterType]);

  const toggleGroupExpand = (protocol) => {
      const newSet = new Set(expandedGroups);
      if (newSet.has(protocol)) newSet.delete(protocol);
      else newSet.add(protocol);
      setExpandedGroups(newSet);
  };

  const handleEdit = (closing) => {
    let targetPath = '';
    if (closing.type === 'fixed_cashier') targetPath = '/fixed-cashier-closing';
    else if (closing.type === 'waiter_zig') targetPath = '/zig-cashless-closing';
    else if (closing.type === 'waiter' || closing.type === 'waiter_10') {
        targetPath = (closing.type === 'waiter_10' || closing.subType === '10_percent') ? '/waiter-closing-10' : '/waiter-closing';
    } else if (closing.type === 'cashier') targetPath = '/mobile-cashier-closing';

    if (targetPath) navigate(targetPath, { state: { closingToEdit: closing } });
  };

  const handleViewDetails = (closing) => { setSelectedClosing(closing); setIsDetailsModalOpen(true); };
  
  const handlePrintReceipt = (closing) => {
      const htmlContent = getReceiptHtml(closing);
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
  };

  // Renderização da Lista
  const renderList = () => {
      if (filteredClosings.length === 0) return <p className="empty-message">Nenhum fechamento encontrado.</p>;

      return filteredClosings.map((closing) => {
          const isGroup = closing.type === 'fixed_cashier';
          const isExpanded = expandedGroups.has(closing.protocol);
          
          let title = '';
          let name = closing.waiterName || closing.cashierName;
          
          if (closing.type === 'waiter') title = closing.subType === '10_percent' ? 'Garçom 10%' : 'Garçom 8%';
          else if (closing.type === 'waiter_10') title = 'Garçom 10%';
          else if (closing.type === 'waiter_zig') title = 'Garçom ZIG';
          else if (closing.type === 'cashier') title = 'Caixa Móvel';
          else if (closing.type === 'fixed_cashier') { title = 'Caixa Fixo (Grupo)'; name = 'Múltiplos Operadores'; }

          let totalValue = closing.valorTotal || closing.valorTotalVenda || closing.valorTotalProdutos || 0;
          let diffLabel = '', diffValue = 0, diffColor = 'black';

          if (title.includes('Garçom')) {
             diffValue = closing.diferencaPagarReceber;
             diffLabel = closing.diferencaLabel || (diffValue >= 0 ? 'Pagar ao Garçom' : 'Receber do Garçom');
             diffColor = diffLabel.includes('Pagar') ? 'blue' : 'red';
          } else {
             diffValue = closing.diferenca || closing.diferencaCaixa || 0;
             if (diffValue > 0) { diffLabel = 'Sobra'; diffColor = 'green'; }
             else if (diffValue < 0) { diffLabel = 'Falta'; diffColor = 'red'; }
             else { diffLabel = 'Zerado'; diffColor = 'blue'; }
             diffValue = Math.abs(diffValue);
          }

          if (isGroup && closing.caixas) {
              totalValue = closing.caixas.reduce((acc, curr) => acc + (curr.valorTotalVenda || 0), 0);
          }

          return (
              <React.Fragment key={closing.protocol}>
                  <div className="history-card" style={isGroup ? {borderLeft: '5px solid #1E63B8'} : {}}>
                      <div className="card-header">
                          <span className="protocol">{closing.protocol}</span>
                          <span className={`sync-status ${viewMode === 'online' || closing.synced ? 'synced' : 'pending'}`}>
                              {viewMode === 'online' || closing.synced ? '✔ Sincronizado' : '... Pendente'}
                          </span>
                          <span className="date">{new Date(closing.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="card-body">
                          <p><strong>{title}:</strong> {name}</p>
                          <p><strong>Venda Total:</strong> {formatCurrencyResult(totalValue)}</p>
                          <p className="acerto" style={{color: diffColor}}>
                              <strong>{diffLabel}:</strong> {formatCurrencyResult(diffValue)}
                          </p>
                      </div>
                      <div className="card-footer">
                          {isGroup && (
                              <button className="edit-button" onClick={() => toggleGroupExpand(closing.protocol)}>
                                  {isExpanded ? '▲ Recolher' : '▼ Expandir'}
                              </button>
                          )}
                          <button className="delete-button" onClick={() => viewMode === 'local' ? handleInitiateLocalDelete(closing) : handleInitiateOnlineDelete(closing)}>🗑️</button>
                          {viewMode === 'local' && <button className="edit-button" onClick={() => handleEdit(closing)}>✏️</button>}
                          <button className="details-button" onClick={() => handleViewDetails(closing)}>📄 Detalhes</button>
                      </div>
                  </div>

                  {isGroup && isExpanded && closing.caixas && (
                      <div className="group-expansion-container">
                          {closing.caixas.map((sub, idx) => (
                              <div key={idx} className="sub-card">
                                  <div style={{fontWeight:'bold'}}>{sub.cashierName}</div>
                                  <div style={{fontSize:'0.9em'}}>Máquina: {sub.numeroMaquina}</div>
                                  <div style={{fontSize:'0.9em'}}>Venda: {formatCurrencyResult(sub.valorTotalVenda)}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </React.Fragment>
          );
      });
  };

  const fetchOnlineData = async (pwd) => {
      setIsGlobalLoading(true); setIsPasswordModalOpen(false);
      try {
          const evt = localStorage.getItem('activeEvent');
          const res = await axios.post(`${API_URL}/api/online-history`, { eventName: evt, password: pwd });
          setOnlineClosings(res.data); setViewMode('online');
      } catch (err) { setOnlineError('Erro ao buscar dados.'); setIsPasswordModalOpen(true); }
      finally { setIsGlobalLoading(false); }
  };

  // --- LÓGICA DE EXCLUSÃO (DUPLA CONFIRMAÇÃO) ---
  
  // 1. Início da Exclusão Local
  const handleInitiateLocalDelete = (item) => { 
      setItemToDelete(item); 
      setIsDeleteConfirmOpen(true); 
  };

  // 2. Passagem para a Segunda Confirmação (Alerta de Nuvem)
  const proceedToDoubleCheck = () => {
      setIsDeleteConfirmOpen(false);
      setIsDoubleConfirmOpen(true);
  };

  // 3. Execução Final da Exclusão Local
  const handleFinalLocalDelete = async () => {
      const current = JSON.parse(localStorage.getItem('localClosings')) || [];
      const updated = current.filter(c => c.protocol !== itemToDelete.protocol);
      localStorage.setItem('localClosings', JSON.stringify(updated));
      loadLocalClosings(); 
      setIsDoubleConfirmOpen(false); 
      setItemToDelete(null);
  };

  // Exclusão Online (Direta com Senha)
  const handleInitiateOnlineDelete = (item) => { setItemToDelete(item); setIsDeletePasswordOpen(true); };
  
  const handleConfirmOnlineDelete = async () => { 
      setIsDeletePasswordOpen(false);
      setIsDeleting(true);
      try {
          const activeEvent = localStorage.getItem('activeEvent');
          const protocolBase = getProtocolBase(itemToDelete);
          await axios.post(`${API_URL}/api/delete-closing`, { eventName: activeEvent, protocolToDelete: protocolBase, password: deletePassword });
          setOnlineClosings(prev => prev.filter(c => getProtocolBase(c) !== protocolBase));
          setAlertMessage('Excluído com sucesso.');
      } catch (e) {
          setAlertMessage('Erro ao excluir online.');
      } finally { setIsDeleting(false); }
  };

  return (
    <div className="app-container history-page-wrapper">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />

      <div className="login-form form-scrollable" style={{maxWidth: '1000px'}}>
        <h1>Histórico de Fechamentos</h1>
        
        <div className="filters-bar" style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px'}}>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{padding:'10px', borderRadius:'5px', border:'1px solid #ccc', flex:1}}>
                <option value="all">Todos os Tipos</option>
                <option value="waiter_8">Garçom 8%</option>
                <option value="waiter_10">Garçom 10%</option>
                <option value="waiter_zig">Garçom ZIG</option>
                <option value="cashier">Caixa Móvel</option>
                <option value="fixed_cashier">Caixa Fixo (Grupo)</option>
            </select>
            <input type="text" placeholder="🔎 Buscar por nome..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{flex:2, padding:'10px', borderRadius:'5px', border:'1px solid #ccc'}} />
        </div>

        <div className="view-toggle-container">
            <button className={`toggle-button ${viewMode === 'local' ? 'active' : ''}`} onClick={() => setViewMode('local')}>Locais</button>
            <button className={`toggle-button ${viewMode === 'online' ? 'active' : ''}`} onClick={() => onlineClosings.length > 0 ? setViewMode('online') : setIsPasswordModalOpen(true)}>Online</button>
        </div>

        <div className="history-list">
            {renderList()}
        </div>
      </div>

      {isDetailsModalOpen && selectedClosing && (
         <div className="modal-overlay" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '900px', width: '95%', height: '90vh', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            <div style={{padding: '15px', background: '#eee', borderBottom: '1px solid #ccc', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3 style={{margin:0}}>Visualização do Comprovante</h3>
                <button onClick={() => setIsDetailsModalOpen(false)} style={{background:'transparent', border:'none', fontSize:'20px', cursor:'pointer'}}>×</button>
            </div>
            
            <div style={{flex: 1, overflow: 'hidden', background: '#fff', padding: '10px'}}>
                <iframe 
                    srcDoc={getReceiptHtml(selectedClosing)} 
                    style={{width: '100%', height: '100%', border: '1px solid #eee'}} 
                    title="Recibo"
                />
            </div>

            <div className="modal-buttons" style={{padding: '15px', background: '#eee', borderTop: '1px solid #ccc', margin: 0}}>
              <button className="cancel-button" onClick={() => setIsDetailsModalOpen(false)}>Fechar</button>
              <button className="confirm-button" onClick={() => handlePrintReceipt(selectedClosing)}>🖨️ Imprimir 2ª Via</button>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center', padding: '30px'}}>
             <div style={{fontSize: '40px', marginBottom: '15px'}}>🔒</div>
             <h2 style={{color: '#333', marginBottom: '10px'}}>Acesso Restrito</h2>
             <p style={{color: '#666', marginBottom: '20px'}}>Este histórico é armazenado na nuvem.<br/>Digite a senha do evento para continuar.</p>
             
             <div className="input-group" style={{marginBottom: '20px', position: 'relative'}}>
                <input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchOnlineData(password)}
                    placeholder="Digite a senha aqui..."
                    style={{width: '100%', padding: '12px 40px 12px 12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center'}}
                    autoFocus
                />
                <span 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px', userSelect: 'none'}}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                    {showPassword ? "🙈" : "👁️"}
                </span>
             </div>
             
             {onlineError && <div style={{color: 'red', fontSize: '14px', marginBottom: '15px', background: '#ffe6e6', padding: '8px', borderRadius: '4px'}}>{onlineError}</div>}

             <div className="modal-buttons" style={{justifyContent: 'center', gap: '10px'}}>
               <button className="cancel-button" onClick={() => { setIsPasswordModalOpen(false); setOnlineError(''); setPassword(''); setShowPassword(false); }} style={{padding: '10px 20px', fontSize: '14px'}}>Cancelar</button>
               <button className="confirm-button" onClick={() => fetchOnlineData(password)} style={{padding: '10px 30px', fontSize: '14px', backgroundColor: '#1E63B8', color: '#fff'}}>Acessar</button>
             </div>
          </div>
        </div>
      )}
      
      {/* 1ª Confirmação de Exclusão */}
      {isDeleteConfirmOpen && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h2>Confirmar Exclusão</h2>
                  <p>Deseja iniciar a exclusão do registro {getProtocolBase(itemToDelete)}?</p>
                  <div className="modal-buttons">
                      <button className="cancel-button" onClick={() => setIsDeleteConfirmOpen(false)}>Cancelar</button>
                      <button className="delete-button-confirm" onClick={proceedToDoubleCheck}>Continuar</button>
                  </div>
              </div>
          </div>
      )}

      {/* 2ª Confirmação (Alerta de Nuvem) */}
      {isDoubleConfirmOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{border: '2px solid red'}}>
                  <h2 style={{color: 'red'}}>⚠️ AVISO IMPORTANTE</h2>
                  <p style={{fontSize: '16px', lineHeight: '1.5'}}>
                      Ao excluir este registro localmente, ele também será removido automaticamente da nuvem/servidor na próxima sincronização.
                  </p>
                  <p style={{fontSize: '16px', fontWeight: 'bold', marginTop: '10px'}}>
                      Esta ação é irreversível. Deseja realmente excluir?
                  </p>
                  <div className="modal-buttons">
                      <button className="cancel-button" onClick={() => setIsDoubleConfirmOpen(false)}>Cancelar</button>
                      <button className="delete-button-confirm" style={{backgroundColor: 'red', fontWeight: 'bold'}} onClick={handleFinalLocalDelete}>Sim, Excluir Definitivamente</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Modal de Exclusão Online */}
      {isDeletePasswordOpen && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h2>Exclusão Online</h2>
                  <p>Digite a senha para confirmar a exclusão definitiva:</p>
                  <p style={{fontSize: '12px', color: 'red'}}>Isso apagará o registro do servidor permanentemente.</p>
                  <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                  <div className="modal-buttons">
                      <button className="cancel-button" onClick={() => setIsDeletePasswordOpen(false)}>Cancelar</button>
                      <button className="delete-button-confirm" onClick={handleConfirmOnlineDelete}>Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      {(isGlobalLoading || isDeleting) && <div className="modal-overlay"><div className="loading-container"><div className="loading-spinner"></div></div></div>}
    </div>
  );
}

export default ClosingHistoryPage;