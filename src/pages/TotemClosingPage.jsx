// src/pages/TotemClosingPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveFixedCashierClosing } from '../services/apiService'; // Reutilizamos a API do Caixa Fixo
import { formatCurrencyInput, formatCurrencyResult } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { APP_VERSION } from '../config'; 
import '../App.css';
import './FixedCashierClosingPage.css'; // Reutilizamos o CSS do Caixa Fixo

// Gera a lista de TOTEM 1 a TOTEM 100
const TOTEM_OPTIONS = Array.from({ length: 100 }, (_, i) => `TOTEM ${i + 1}`);

// --- COMPONENTE INTERNO PARA CADA TOTEM ---
const TotemFormItem = ({
    item, index, handleInputChange, handleKeyDown, formRefs, isEditing, onRemoveTotem, showRemoveButton
}) => {
    // Estados locais para controlar a busca e o crachá
    const [searchInput, setSearchInput] = useState(item.name || '');
    const [filteredTotens, setFilteredTotens] = useState([]);
    const [isTotemSelected, setIsTotemSelected] = useState(!!item.name);

    useEffect(() => {
        if (isEditing && item.name) {
            setSearchInput(item.name);
            setIsTotemSelected(true);
        }
    }, [item, isEditing]);

    // Lógica de Busca Inteligente
    useEffect(() => {
        const rawQuery = searchInput.trim().toUpperCase();
        if (rawQuery.length > 0 && !isTotemSelected) {
            const queryDigitsOnly = rawQuery.replace(/\D/g, '');
            
            const results = TOTEM_OPTIONS.filter(t => {
                const isTextMatch = t.includes(rawQuery);
                const isNumMatch = queryDigitsOnly && t.replace('TOTEM ', '').startsWith(queryDigitsOnly);
                return isTextMatch || isNumMatch;
            });
            setFilteredTotens(results);
        } else {
            setFilteredTotens([]);
        }
    }, [searchInput, isTotemSelected]);

    const onSelect = (totemName) => {
        handleInputChange(item.id, 'name', totemName);
        setSearchInput(totemName);
        setIsTotemSelected(true);
        setFilteredTotens([]);
        // Pula o foco automaticamente para o Nº da Máquina
        setTimeout(() => formRefs.current[`numeroMaquina_${item.id}`]?.focus(), 100);
    };

    const handleClearSelection = () => {
        setIsTotemSelected(false);
        setSearchInput('');
        handleInputChange(item.id, 'name', '');
        setTimeout(() => formRefs.current[`search_${item.id}`]?.focus(), 100);
    };

    const cleanAndSet = (field, value) => {
        const digitsOnly = String(value).replace(/\D/g, '');
        handleInputChange(item.id, field, digitsOnly);
    };

    return (
        <div className="caixa-item-container">
            <div className="caixa-header">
                <h3 className="caixa-title">Totem {index + 1}</h3>
                {showRemoveButton && (
                    <button type="button" className="remove-caixa-button" onClick={() => onRemoveTotem(item.id)}>Remover</button>
                )}
            </div>

            <div className="form-section">
                {/* LINHA 1: Busca ou Crachá Preenchido */}
                <div className="form-row">
                    {!isTotemSelected ? (
                        <div className="input-group" style={{ position: 'relative', width: '100%' }}>
                            <label style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#333' }}>Buscar Totem</label>
                            <input 
                                ref={(el) => formRefs.current[`search_${item.id}`] = el}
                                value={searchInput} 
                                onChange={(e) => setSearchInput(e.target.value)} 
                                disabled={isEditing} 
                                placeholder="Digite o número (Ex: 5 ou TOTEM 5)..." 
                            />
                            {filteredTotens.length > 0 && (
                                <div className="suggestions-list">
                                    {filteredTotens.map((t, sugIndex) => (
                                        <div key={`totem-${item.id}-${sugIndex}`} className="suggestion-item" onClick={() => onSelect(t)}>
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="input-group" style={{ width: '100%' }}>
                            <label>Totem Selecionado</label>
                            {/* CRACHÁ AZUL TRAVADO 100% LARGURA */}
                            <div style={{
                                backgroundColor: '#e8f4fd', border: '1px solid #b6d4fe', 
                                borderRadius: '8px', padding: '12px 15px', color: '#084298',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.05)'
                            }}>
                                <span style={{ fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>
                                    {item.name}
                                </span>
                                
                                {!isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={handleClearSelection}
                                        style={{
                                            background: 'transparent', color: '#dc3545', border: '1px solid #dc3545',
                                            borderRadius: '6px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 'bold',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dc3545'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#dc3545'; }}
                                    >
                                        🔄 Trocar
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* LINHA 2: Máquina */}
                <div className="form-row" style={{ marginTop: '15px' }}>
                    <div className="input-group">
                        <label style={{ fontWeight: 'bold', color: '#333' }}>Nº da Máquina / Identificação Externa</label>
                        <input 
                            ref={formRefs.current[`numeroMaquina_${item.id}`]} 
                            onKeyDown={(e) => handleKeyDown(e, `credito_${item.id}`)} 
                            value={item.numeroMaquina} 
                            onChange={(e) => handleInputChange(item.id, 'numeroMaquina', e.target.value.toUpperCase())} 
                            placeholder="Ex: T1"
                            style={{ 
                                fontSize: '1.2rem', 
                                fontWeight: 'bold', 
                                textAlign: 'center', 
                                border: '2px solid #aaa',
                                padding: '12px'
                            }}
                        />
                    </div>
                </div>

                {/* LINHA 3: Valores Financeiros */}
                <h3 style={{marginTop: 25, marginBottom: 15, color: '#555', fontSize: '16px', textTransform: 'uppercase', borderBottom: '2px solid #eee', paddingBottom: '5px', fontWeight: 'bold'}}>
                    Recebimentos do Totem
                </h3>
                <div className="form-row">
                    <div className="input-group">
                        <label style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#333' }}>Crédito</label>
                        <input 
                            ref={formRefs.current[`credito_${item.id}`]} 
                            onKeyDown={(e) => handleKeyDown(e, `debito_${item.id}`)} 
                            value={formatCurrencyInput(item.credito)} 
                            onChange={(e) => cleanAndSet('credito', e.target.value)} 
                            inputMode="numeric" 
                            placeholder="R$ 0,00" 
                            style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'right', border: '1px solid #999', backgroundColor: '#fafafa', padding: '12px' }}
                        />
                    </div>
                    <div className="input-group">
                        <label style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#333' }}>Débito</label>
                        <input 
                            ref={formRefs.current[`debito_${item.id}`]} 
                            onKeyDown={(e) => handleKeyDown(e, `cashless_${item.id}`)} 
                            value={formatCurrencyInput(item.debito)} 
                            onChange={(e) => cleanAndSet('debito', e.target.value)} 
                            inputMode="numeric" 
                            placeholder="R$ 0,00" 
                            style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'right', border: '1px solid #999', backgroundColor: '#fafafa', padding: '12px' }}
                        />
                    </div>
                </div>
                <div className="form-row">
                    <div className="input-group">
                        <label style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#333' }}>Cashless</label>
                        <input 
                            ref={formRefs.current[`cashless_${item.id}`]} 
                            onKeyDown={(e) => handleKeyDown(e, `addTotemButton`)} 
                            value={formatCurrencyInput(item.cashless)} 
                            onChange={(e) => cleanAndSet('cashless', e.target.value)} 
                            inputMode="numeric" 
                            placeholder="R$ 0,00" 
                            style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'right', border: '1px solid #999', backgroundColor: '#fafafa', padding: '12px' }}
                        />
                    </div>
                    <div className="input-group">
                        <label style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#084298' }}>Valor Total (Automático)</label>
                        <input 
                            value={formatCurrencyResult(item.valorTotalVenda / 100)} 
                            readOnly 
                            style={{ 
                                backgroundColor: '#e8f4fd', 
                                fontSize: '1.25rem', 
                                fontWeight: '900', 
                                color: '#084298', 
                                textAlign: 'right', 
                                border: '2px solid #b6d4fe',
                                padding: '12px'
                            }} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
function TotemClosingPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const closingToEdit = state?.closingToEdit;

    const [isSaving, setIsSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataToConfirm, setDataToConfirm] = useState(null);
    
    // ESTADO INICIAL DOS TOTENS
    const [totensDoGrupo, setTotensDoGrupo] = useState([{ 
        id: 1, name: '', numeroMaquina: '', credito: '', debito: '', cashless: '', valorTotalVenda: 0 
    }]);
    
    const [alertMessage, setAlertMessage] = useState('');
    const [protocol, setProtocol] = useState(null);
    const [modalState, setModalState] = useState('confirm');

    const formRefs = useRef({});

    const parseCurrency = (value) => {
      const stringValue = String(value);
      const cleanValue = stringValue.replace(/\D/g, '');
      if (cleanValue === '') return 0;
      return parseInt(cleanValue, 10) / 100;
    };

    const formatForInput = (value) => String(Math.round((value || 0) * 100));

    useEffect(() => {
        if (closingToEdit) {
            setProtocol(closingToEdit.protocol);
            const totensEdit = closingToEdit.caixas.map((caixa, index) => {
                return {
                    id: index + 1,
                    name: caixa.cashierName,
                    numeroMaquina: caixa.numeroMaquina,
                    credito: formatForInput(caixa.credito),
                    debito: formatForInput(caixa.debito),
                    cashless: formatForInput(caixa.cashless),
                    valorTotalVenda: formatForInput(caixa.valorTotalVenda),
                    protocol: caixa.protocol
                };
            });
            setTotensDoGrupo(totensEdit);
        }
    }, [closingToEdit]);

    // CÁLCULO AUTOMÁTICO DO VALOR TOTAL
    const handleInputChange = (totemId, field, value) => {
        setTotensDoGrupo(prev => prev.map(totem => {
            if (totem.id === totemId) {
                const updatedTotem = { ...totem, [field]: value };
                // Se mexeu em valor, recalcula o total
                if (['credito', 'debito', 'cashless'].includes(field)) {
                    const c = parseCurrency(updatedTotem.credito);
                    const d = parseCurrency(updatedTotem.debito);
                    const ca = parseCurrency(updatedTotem.cashless);
                    updatedTotem.valorTotalVenda = (c + d + ca) * 100; // Guarda em centavos p/ o state
                }
                return updatedTotem;
            }
            return totem;
        }));
    };

    const handleAddTotem = () => {
        const newId = totensDoGrupo.length > 0 ? Math.max(...totensDoGrupo.map(c => c.id)) + 1 : 1;
        setTotensDoGrupo([...totensDoGrupo, { id: newId, name: '', numeroMaquina: '', credito: '', debito: '', cashless: '', valorTotalVenda: 0 }]);
    };

    const handleRemoveTotem = (idToRemove) => {
        if (totensDoGrupo.length <= 1) return;
        setTotensDoGrupo(prev => prev.filter(t => t.id !== idToRemove));
    };

    // Cálculos Globais
    let totalCreditoGrupo = 0;
    let totalDebitoGrupo = 0;
    let totalCashlessGrupo = 0;
    let totalVendaGrupo = 0;

    totensDoGrupo.forEach(t => {
        totalCreditoGrupo += parseCurrency(t.credito);
        totalDebitoGrupo += parseCurrency(t.debito);
        totalCashlessGrupo += parseCurrency(t.cashless);
        totalVendaGrupo += (parseCurrency(t.credito) + parseCurrency(t.debito) + parseCurrency(t.cashless));
    });

    const handleOpenConfirmation = () => {
        if (totensDoGrupo.some(t => !t.name || !t.numeroMaquina)) {
            setAlertMessage('Por favor, preencha o Nome do Totem e o Nº da Máquina para todos os itens.');
            return;
        }
        
        setDataToConfirm({
            totens: totensDoGrupo,
            protocol: null, 
            totalVendaGrupo
        });
        setModalState('confirm'); 
        setModalVisible(true);
    };

    const handleFinalSave = async () => {
        setIsSaving(true);
        setModalState('saving');
        
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');

            const caixasParaSalvar = totensDoGrupo.map((totem, index) => {
                const totalTotem = parseCurrency(totem.credito) + parseCurrency(totem.debito) + parseCurrency(totem.cashless);
                return {
                    protocol: totem.protocol, 
                    cpf: '00000000000', // Padrão sem CPF para totem
                    cashierName: totem.name,
                    numeroMaquina: totem.numeroMaquina,
                    temEstorno: false,
                    valorEstorno: 0,
                    valorTotalVenda: totalTotem,
                    credito: parseCurrency(totem.credito),
                    debito: parseCurrency(totem.debito),
                    pix: 0,
                    cashless: parseCurrency(totem.cashless),
                    dinheiroFisico: 0, 
                    valorAcerto: totalTotem,
                    diferenca: 0, 
                };
            });

            const closingData = {
                type: 'fixed_cashier', // Mantemos 'fixed_cashier' para agrupar na planilha de Caixas
                eventName, operatorName,
                valorTroco: 0, 
                totalDinheiroFisicoGrupo: 0, 
                diferencaCaixa: 0, 
                caixas: caixasParaSalvar, 
                protocol: protocol,
                timestamp: closingToEdit?.timestamp
            };

            // Reaproveita a API de Caixa Fixo pois a estrutura JSON é idêntica
            const response = await saveFixedCashierClosing(closingData);
            const savedData = response.data || response; 
            
            setDataToConfirm(prev => ({ ...prev, ...savedData }));
            setModalState('success');

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            setAlertMessage('Ocorreu um erro ao salvar o fechamento dos totens.');
            setModalVisible(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        if (!dataToConfirm || !dataToConfirm.totens) return;
        const logoSrc = '/logo.png'; 
        const printTime = new Date().toLocaleString('pt-BR'); 

        const linhasTabelaHTML = dataToConfirm.totens.map(t => {
            const vCred = parseCurrency(t.credito);
            const vDeb = parseCurrency(t.debito);
            const vCash = parseCurrency(t.cashless);
            const total = vCred + vDeb + vCash;

            return `
                <tr>
                    <td style="text-align:left;"><strong>${t.name}</strong></td>
                    <td>${t.numeroMaquina}</td>
                    <td>${formatCurrencyResult(vCred)}</td>
                    <td>${formatCurrencyResult(vDeb)}</td>
                    <td>${formatCurrencyResult(vCash)}</td>
                    <td style="background:#f0f0f0; font-weight:bold;">${formatCurrencyResult(total)}</td>
                </tr>
            `;
        }).join('');

        const content = `
            <html>
            <head>
                <title>A4 - Totens ${dataToConfirm.protocol}</title>
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; width: 210mm; height: 140mm; margin: 0; padding: 25px; box-sizing: border-box; background: #fff; }
                    .container { width: 100%; height: 100%; border: 2px solid #000; padding: 15px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; }
                    .header { position: relative; display: flex; justify-content: center; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; min-height: 60px; }
                    .logo-wrapper { position: absolute; left: 0; top: -25px; z-index: 10; }
                    .logo-img { max-height: 115px; max-width: 250px; width: auto; object-fit: contain; } 
                    .header-right { position: absolute; right: 0; top: 0; text-align: right; font-size: 10px; display:flex; flex-direction:column; align-items: flex-end; }
                    .header-center { text-align: center; padding: 0 10px; z-index: 1; }
                    .title { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
                    .protocol-box { border: 1px solid #000; padding: 2px 6px; font-weight: bold; margin-bottom: 2px; display: inline-block; font-size: 12px; }
                    .info-strip { background-color: #f5f5f5; padding: 6px; border: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 15px; font-weight: bold; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
                    .details-table th { background: #333; color: #fff; border: 1px solid #000; padding: 6px; text-transform: uppercase; }
                    .details-table td { border: 1px solid #ccc; padding: 6px; text-align: center; }
                    .resumo-total { background: #e8f4fd; border: 2px solid #b6d4fe; padding: 10px; text-align: center; margin-top: auto; border-radius: 8px; }
                    .footer-sigs { margin-top: 30px; display: flex; justify-content: center; align-items: flex-end; }
                    .sig-block { text-align: center; width: 60%; }
                    .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    .system-footer { font-size: 9px; color: #555; text-align: center; width: 100%; border-top: 1px solid #eee; padding-top: 5px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo-wrapper"><img src="${logoSrc}" class="logo-img" onerror="this.style.display='none'"/></div>
                        <div class="header-center">
                            <div class="title">Fechamento de Totens</div>
                            <div style="font-size: 12px; margin-top:2px;">Consolidado de Terminais de Autoatendimento</div>
                        </div>
                        <div class="header-right">
                            <div class="protocol-box">PROT: ${dataToConfirm.protocol}</div>
                            <svg id="barcodeA4"></svg>
                        </div>
                    </div>

                    <div class="info-strip">
                        <div>EVENTO: ${dataToConfirm.eventName || localStorage.getItem('activeEvent')}</div>
                        <div>RESPONSÁVEL: ${dataToConfirm.operatorName || localStorage.getItem('loggedInUserName')}</div>
                        <div>DATA: ${new Date(dataToConfirm.timestamp || Date.now()).toLocaleDateString('pt-BR')}</div>
                    </div>

                    <table class="details-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">Identificação</th>
                                <th>Máquina</th>
                                <th>Total Crédito</th>
                                <th>Total Débito</th>
                                <th>Total Cashless</th>
                                <th>Venda Total (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${linhasTabelaHTML}
                        </tbody>
                    </table>

                    <div class="resumo-total">
                        <div style="font-size: 12px; color: #555; font-weight: bold; text-transform: uppercase; margin-bottom: 5px;">Movimentação Global dos Totens</div>
                        <div style="font-size: 24px; font-weight: 900; color: #084298;">${formatCurrencyResult(dataToConfirm.totalVendaGrupo)}</div>
                    </div>

                    <div class="footer-sigs">
                        <div class="sig-block">
                            <div class="sig-line">Assinatura do Responsável (Conferência)</div>
                        </div>
                    </div>

                    <div class="system-footer">Sis.Versão: ${APP_VERSION || '1.0'} | Impresso em: ${printTime}</div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <script>JsBarcode("#barcodeA4", "${dataToConfirm.protocol}", {format: "CODE128", displayValue: false, height: 25, width: 1, margin: 0});</script>
            </body>
            </html>
        `;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(content);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 800);
    };

    const handleKeyDown = (e, nextField) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextRef = formRefs.current[nextField];
        if (nextRef && nextRef.current) {
          nextRef.current.focus();
        } else if (nextField === 'saveButton') {
           handleOpenConfirmation();
        } else if (nextField === 'addTotemButton' && !closingToEdit) {
            handleAddTotem();
            setTimeout(() => {
                const nextTotemId = totensDoGrupo.length + 1; 
                const nextMaqRef = formRefs.current[`numeroMaquina_${nextTotemId}`];
                if (nextMaqRef && nextMaqRef.current) nextMaqRef.current.focus();
            }, 100);
        }
      }
    };

    useEffect(() => {
        formRefs.current.addTotemButton = formRefs.current.addTotemButton || React.createRef();
        formRefs.current.saveButton = formRefs.current.saveButton || React.createRef();

        totensDoGrupo.forEach(t => {
            formRefs.current[`numeroMaquina_${t.id}`] = formRefs.current[`numeroMaquina_${t.id}`] || React.createRef();
            formRefs.current[`credito_${t.id}`] = formRefs.current[`credito_${t.id}`] || React.createRef();
            formRefs.current[`debito_${t.id}`] = formRefs.current[`debito_${t.id}`] || React.createRef();
            formRefs.current[`cashless_${t.id}`] = formRefs.current[`cashless_${t.id}`] || React.createRef();
        });
    }, [totensDoGrupo]);

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '1000px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{closingToEdit ? 'Editar Fechamento de Totens' : 'Fechamento de Totens'}</h1>

                {totensDoGrupo.map((totem, index) => (
                    <TotemFormItem
                        key={totem.id} item={totem} index={index}
                        handleInputChange={handleInputChange} handleKeyDown={handleKeyDown}
                        formRefs={formRefs} isEditing={!!closingToEdit} 
                        onRemoveTotem={handleRemoveTotem} showRemoveButton={totensDoGrupo.length > 1 && !closingToEdit}
                    />
                ))}

                <div className="footer-actions">
                     <button
                         ref={formRefs.current.addTotemButton}
                         onKeyDown={(e) => handleKeyDown(e, 'saveButton')}
                         className="add-button" onClick={handleAddTotem} disabled={!!closingToEdit}
                     >
                         + Adicionar Outro Totem
                     </button>

                    <div className="results-container" style={{borderTop: '2px solid #007bff', paddingTop: '20px'}}>
                        <p style={{ fontSize: '14px', color: '#555' }}>Total Crédito: <strong>{formatCurrencyResult(totalCreditoGrupo)}</strong></p>
                        <p style={{ fontSize: '14px', color: '#555' }}>Total Débito: <strong>{formatCurrencyResult(totalDebitoGrupo)}</strong></p>
                        <p style={{ fontSize: '14px', color: '#555' }}>Total Cashless: <strong>{formatCurrencyResult(totalCashlessGrupo)}</strong></p>
                        <hr style={{ margin: '10px 0' }}/>
                        <p className="total-text" style={{ fontSize: '18px' }}>
                            Venda Total dos Totens: <strong style={{ color: '#084298' }}>{formatCurrencyResult(totalVendaGrupo)}</strong>
                        </p>
                        <button ref={formRefs.current.saveButton} className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'SALVAR TOTENS'}
                        </button>
                    </div>
                </div>
            </div>

            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                        {modalState === 'confirm' && (
                            <>
                                <h2>Confirmar Fechamento de Totens</h2>
                                {dataToConfirm && (
                                    <>
                                        <p><strong>Terminais Informados:</strong></p>
                                        <ul className="cashier-list">
                                            {dataToConfirm.totens.map(t => (
                                                <li key={t.name} style={{ marginBottom: '8px' }}>
                                                    <strong>{t.name}</strong> (Máq: {t.numeroMaquina})
                                                    <span style={{ display: 'block', fontSize: '0.85em', color: '#555' }}>
                                                        Total Computado: {formatCurrencyResult((parseCurrency(t.credito) + parseCurrency(t.debito) + parseCurrency(t.cashless)))}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <hr/>
                                        <p className="total-text">Venda Total Consolidada:
                                            <strong style={{color: '#084298', marginLeft: '10px' }}>
                                                {formatCurrencyResult(dataToConfirm.totalVendaGrupo)}
                                            </strong>
                                        </p>
                                    </>
                                )}
                                <div className="modal-buttons">
                                    <button className="cancel-button" onClick={() => setModalVisible(false)}>Cancelar</button>
                                    <button className="login-button" onClick={handleFinalSave} disabled={isSaving}>
                                        {isSaving ? "Salvando..." : "Confirmar e Salvar"}
                                    </button>
                                </div>
                            </>
                        )}
                        
                        {modalState === 'saving' && (
                            <><div className="spinner"></div><p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p></>
                        )}

                        {modalState === 'success' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                                <h2>Fechamento Salvo com Sucesso!</h2>
                                <p>Protocolo Local: <strong>{dataToConfirm?.protocol}</strong></p>
                                
                                <div className="modal-buttons" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%' }}>
                                    <button className="login-button" style={{ backgroundColor: '#2196F3', width: '100%', padding: '15px 0' }} onClick={handlePrint}>
                                        <span style={{ fontSize: '16px' }}>📄 Imprimir Relatório de Totens (A4)</span>
                                    </button>
                                    <button className="modal-button primary" style={{ width: '100%' }} onClick={() => { setModalVisible(false); setTotensDoGrupo([{ id: 1, name: '', numeroMaquina: '', credito: '', debito: '', cashless: '', valorTotalVenda: 0 }]); setProtocol(null); }}>
                                        <span className="button-icon">➕</span> Registrar Novos Totens
                                    </button>
                                    <button className="modal-button secondary" style={{ width: '100%' }} onClick={() => navigate('/financial-selection')}>
                                        <span className="button-icon">📋</span> Voltar ao Menu Principal
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TotemClosingPage;