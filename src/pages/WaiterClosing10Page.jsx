// src/pages/WaiterClosing10Page.jsx (VERSÃO COMPLETA COM MELHORIAS)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveWaiterClosing } from '../services/apiService'; // Reutiliza a mesma função de salvar
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import '../App.css';
import './WaiterClosingPage.css'; // Reutiliza o mesmo CSS

// Hook de "Debounce" para otimizar os cálculos
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function WaiterClosing10Page() {
    const navigate = useNavigate();
    const location = useLocation(); 

    const formRefs = {
      cpf: useRef(null),
      numeroMaquina: useRef(null),
      valorTotal: useRef(null),
      valorEstorno: useRef(null),
      credito: useRef(null),
      debito: useRef(null),
      pix: useRef(null),
      cashless: useRef(null),
      saveButton: useRef(null),
    };

    const [alertMessage, setAlertMessage] = useState('');
    const [waiters, setWaiters] = useState([]);
    const [selectedWaiter, setSelectedWaiter] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [filteredWaiters, setFilteredWaiters] = useState([]);
    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    const [valorEstorno, setValorEstorno] = useState('');
    const [valorTotal, setValorTotal] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    const [comissao10, setComissao10] = useState(0);
    const [comissao4, setComissao4] = useState(0);
    const [comissaoTotal, setComissaoTotal] = useState(0);
    const [valorTotalAcerto, setValorTotalAcerto] = useState(0);
    const [diferencaPagarReceber, setDiferencaPagarReceber] = useState(0);
    const [diferencaLabel, setDiferencaLabel] = useState('Aguardando valores...');
    const [modalVisible, setModalVisible] = useState(false);
    const [modalState, setModalState] = useState('confirm');
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newWaiterName, setNewWaiterName] = useState('');

    const debouncedValorTotal = useDebounce(valorTotal, 500);
    const debouncedCredito = useDebounce(credito, 500);
    const debouncedDebito = useDebounce(debito, 500);
    const debouncedPix = useDebounce(pix, 500);
    const debouncedCashless = useDebounce(cashless, 500);
    const debouncedValorEstorno = useDebounce(valorEstorno, 500);

    const parseCurrency = (value) => {
      const stringValue = String(value);
      const cleanValue = stringValue.replace(/\D/g, '');
      if (cleanValue === '') return 0;
      if (!stringValue.includes(',') && !stringValue.includes('.')) {
        return parseInt(cleanValue, 10);
      }
      return parseInt(cleanValue, 10) / 100;
    };

    useEffect(() => {
        const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setWaiters(localWaiters);
        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            const waiter = { cpf: closingToEdit.cpf, name: closingToEdit.waiterName };
            setSelectedWaiter(waiter);
            setSearchInput(waiter.name);
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorEstorno(String(closingToEdit.valorEstorno).replace('.', ','));
            setValorTotal(String(closingToEdit.valorTotal).replace('.', ','));
            setCredito(String(closingToEdit.credito).replace('.', ','));
            setDebito(String(closingToEdit.debito).replace('.', ','));
            setPix(String(closingToEdit.pix).replace('.', ','));
            setCashless(String(closingToEdit.cashless).replace('.', ','));
        }
    }, []);

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedWaiter) {
            const results = waiters.filter(waiter => {
                const waiterName = waiter.name.toLowerCase();
                const waiterCpf = waiter.cpf.replace(/\D/g, '');
                const isNumericQuery = /^\d+$/.test(query.replace(/[.-]/g, ''));
                if (isNumericQuery) { return waiterCpf.startsWith(query.replace(/\D/g, '')); } 
                else { return waiterName.includes(query); }
            });
            setFilteredWaiters(results);
            const cleanQueryCpf = query.replace(/\D/g, '');
            const isPotentialCpf = /^\d{11}$/.test(cleanQueryCpf);
            if (isPotentialCpf && results.length === 0) { setShowRegisterButton(true); } 
            else { setShowRegisterButton(false); }
        } else { setFilteredWaiters([]); setShowRegisterButton(false); }
    }, [searchInput, waiters, selectedWaiter]);
    
    useEffect(() => {
        const numValorTotal = parseCurrency(debouncedValorTotal);
        const numCredito = parseCurrency(debouncedCredito);
        const numDebito = parseCurrency(debouncedDebito);
        const numPix = parseCurrency(debouncedPix);
        const numCashless = parseCurrency(debouncedCashless);
        const numValorEstorno = parseCurrency(debouncedValorEstorno);
        const valorEfetivoVenda = numValorTotal - (temEstorno ? numValorEstorno : 0);
        const baseComissao10 = valorEfetivoVenda - numCashless;
        const c10 = baseComissao10 * 0.10;
        const c4 = numCashless * 0.04;
        const cTotal = c10 + c4;
        setComissao10(c10);
        setComissao4(c4);
        setComissaoTotal(cTotal);
        const totalAcerto = valorEfetivoVenda - cTotal;
        setValorTotalAcerto(totalAcerto);
        const dinheiroDevido = valorEfetivoVenda - (numCredito + numDebito + numPix + numCashless);
        const diferenca = dinheiroDevido - cTotal;
        if (diferenca < 0) {
          setDiferencaLabel('Pagar ao Garçom');
          setDiferencaPagarReceber(diferenca * -1);
        } else {
          setDiferencaLabel('Receber do Garçom');
          setDiferencaPagarReceber(diferenca);
        }
    }, [debouncedValorTotal, debouncedCredito, debouncedDebito, debouncedPix, debouncedCashless, debouncedValorEstorno, temEstorno]);

    const handlePaymentChange = (setter, value, fieldName) => {
      const numValorTotal = parseCurrency(valorTotal);
      if (numValorTotal > 0) {
        const values = { credito, debito, pix, cashless };
        values[fieldName] = value; 
        const somaPagamentos = parseCurrency(values.credito) + parseCurrency(values.debito) + parseCurrency(values.pix) + parseCurrency(values.cashless);
        if (somaPagamentos > numValorTotal) {
          setAlertMessage('Erro de Digitação: A soma dos pagamentos não pode ser maior que a Venda Total.');
          setter(''); 
          return;
        }
      }
      setter(value);
    };

    const handleSelectWaiter = (waiter) => {
        setSelectedWaiter(waiter);
        setSearchInput(waiter.name);
        setFilteredWaiters([]);
    };

    const handleRegisterNewWaiter = () => {
        const cleanCpf = searchInput.replace(/\D/g, '');
        if (!newWaiterName.trim()) { setAlertMessage('Por favor, insira o nome do novo garçom.'); return; }
        const newWaiter = { cpf: formatCpf(cleanCpf), name: newWaiterName.trim() };
        let currentWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        currentWaiters.push(newWaiter);
        localStorage.setItem('master_waiters', JSON.stringify(currentWaiters));
        setWaiters(currentWaiters);
        handleSelectWaiter(newWaiter);
        setRegisterModalVisible(false);
        setNewWaiterName('');
        setAlertMessage(`Garçom "${newWaiter.name}" cadastrado localmente com sucesso!`);
    };
    
    const handleOpenConfirmation = () => {
        if (!selectedWaiter) { setAlertMessage('Por favor, selecione um garçom válido da lista.'); return; }
        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const operatorName = localStorage.getItem('loggedInUserName') || 'N/A';
        const closingData = {
            timestamp: timestamp || new Date().toISOString(), protocol, eventName, operatorName, cpf: selectedWaiter.cpf, waiterName: selectedWaiter.name,
            numeroMaquina, valorTotal: parseCurrency(valorTotal), credito: parseCurrency(credito),
            debito: parseCurrency(debito), pix: parseCurrency(pix), cashless: parseCurrency(cashless),
            temEstorno, valorEstorno: parseCurrency(valorEstorno), comissaoTotal, valorTotalAcerto, diferencaLabel, diferencaPagarReceber,
        };
        setDataToConfirm(closingData); setModalState('confirm'); setModalVisible(true); 
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            const response = await saveWaiterClosing(dataToConfirm); // Reutiliza a mesma função
            setDataToConfirm(prevData => ({...prevData, protocol: response.data.protocol}));
            setModalState('success');
        } catch (error) {
            setAlertMessage('Ocorreu um erro ao salvar o fechamento.');
            setModalVisible(false);
        }
    };
    
    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedWaiter(null); setSearchInput('');
        setNumeroMaquina(''); setTemEstorno(false); setValorEstorno('');
        setValorTotal(''); setCredito(''); setDebito(''); setPix(''); setCashless('');
    };

    const handleRegisterNew = () => { setModalVisible(false); resetForm(); };
    const handleBackToMenu = () => { navigate('/financial-selection'); };
    
    const handleKeyDown = (e, nextField) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (formRefs[nextField] && formRefs[nextField].current) {
          formRefs[nextField].current.focus();
        }
      }
    };
    
    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />

            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{protocol ? 'Editar Fechamento' : 'Fechamento Garçom 10%'}</h1>
                
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Buscar Garçom (Nome ou CPF)</label>
                            <input ref={formRefs.cpf} onKeyDown={(e) => handleKeyDown(e, 'numeroMaquina')} placeholder="Digite o nome ou CPF do garçom" value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setSelectedWaiter(null); }}  disabled={!!protocol} />
                            {filteredWaiters.length > 0 && ( <div className="suggestions-list">{filteredWaiters.map(item => (<div key={item.cpf} className="suggestion-item" onClick={() => handleSelectWaiter(item)}>{item.name} - {item.cpf}</div>))}</div>)}
                        </div>
                        <div className="input-group">
                            <label>Garçom Selecionado</label>
                            <input type="text" value={selectedWaiter ? `${selectedWaiter.name} - ${selectedWaiter.cpf}` : ''} readOnly placeholder="Selecione um garçom da lista" />
                        </div>
                    </div>
                    {showRegisterButton && (<button className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>CPF não encontrado. Cadastrar novo garçom?</button>)}
                    <div className="form-row">
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input ref={formRefs.numeroMaquina} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} />
                        </div>
                        <div className="switch-container">
                            <label>Houve Estorno Manual?</label>
                            <label className="switch">
                                <input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                     {temEstorno && ( 
                        <div className="input-group" style={{marginTop: '15px'}}>
                            <label>Valor do Estorno</label>
                            <input ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={formatCurrencyInput(valorEstorno)} onChange={(e) => setValorEstorno(e.target.value)} />
                        </div>
                    )}
                </div>

                <div className="form-section" style={{ display: 'block' }}>
                    <div className="input-group">
                      <label>Valor Total da Venda</label>
                      <input ref={formRefs.valorTotal} onKeyDown={(e) => handleKeyDown(e, 'credito')} value={formatCurrencyInput(valorTotal)} onChange={(e) => setValorTotal(e.target.value)} />
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handlePaymentChange(setCredito, e.target.value, 'credito')} /></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handlePaymentChange(setDebito, e.target.value, 'debito')} /></div>
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handlePaymentChange(setPix, e.target.value, 'pix')} /></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} value={formatCurrencyInput(cashless)} onChange={(e) => handlePaymentChange(setCashless, e.target.value, 'cashless')} /></div>
                    </div>
                </div>
                
                <div className="results-container">
                    <p>Comissão (10%): <strong>{formatCurrencyResult(comissao10)}</strong></p>
                    <p>Comissão (4%): <strong>{formatCurrencyResult(comissao4)}</strong></p><hr/>
                    <p className="total-text">Comissão Total: <strong>{formatCurrencyResult(comissaoTotal)}</strong></p>
                    <p className="total-text">{diferencaLabel}: 
                        <strong className="final-value" style={{ color: diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}> {formatCurrencyResult(diferencaPagarReceber)}</strong>
                    </p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR E FINALIZAR</button>
                </div>
            </div>

            {registerModalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Cadastrar Novo Garçom</h2>
                        <div className="input-group">
                            <label>CPF</label>
                            <input type="text" value={formatCpf(searchInput)} readOnly />
                        </div>
                        <div className="input-group">
                            <label>Nome do Garçom</label>
                            <input type="text" value={newWaiterName} onChange={(e) => setNewWaiterName(e.target.value)} placeholder="Digite o nome completo" />
                        </div>
                        <div className="modal-buttons">
                            <button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button>
                            <button className="login-button" onClick={handleRegisterNewWaiter}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        {modalState === 'confirm' && ( <>
                            <h2>Deseja Confirmar o Fechamento?</h2>
                            {dataToConfirm && ( <>
                                <p><strong>Evento:</strong> {dataToConfirm.eventName}</p>
                                <p><strong>Garçom:</strong> {dataToConfirm.waiterName}</p>
                                <p><strong>Nº Máquina:</strong> {dataToConfirm.numeroMaquina}</p>
                                <hr />
                                <p>Valor Total da Venda: <strong>{formatCurrencyResult(dataToConfirm.valorTotal)}</strong></p>
                                <p>Valor Total Comissão: <strong>{formatCurrencyResult(dataToConfirm.comissaoTotal)}</strong></p>
                                <p>Valor Total de Acerto: <strong>{formatCurrencyResult(dataToConfirm.valorTotalAcerto)}</strong></p>
                                <hr />
                                <p className="total-text">{dataToConfirm.diferencaLabel}: 
                                    <strong style={{ color: dataToConfirm.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>
                                        {formatCurrencyResult(dataToConfirm.diferencaPagarReceber)}
                                    </strong>
                                </p>
                            </>)}
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Não</button>
                                <button className="login-button" onClick={handleConfirmAndSave}>Sim, Salvar</button>
                            </div>
                        </>)}

                        {modalState === 'saving' && ( <>
                            <div className="spinner"></div>
                            <p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p>
                        </>)}

                        {modalState === 'success' && ( <>
                            <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                            <h2>Fechamento Salvo com Sucesso!</h2>
                            <p>Protocolo Local: <strong>{dataToConfirm?.protocol}</strong></p>
                            <div className="modal-buttons">
                                <button className="modal-button primary" onClick={handleRegisterNew}>
                                    <span className="button-icon">➕</span>
                                    <span>Registrar Novo Fechamento</span>
                                </button>
                                <button className="modal-button secondary" onClick={handleBackToMenu}>
                                    <span className="button-icon">📋</span>
                                    <span>Voltar ao Menu Principal</span>
                                </button>
                            </div>
                        </>)}
                    </div>
                </div>
            )}
        </div>
    );
}

export default WaiterClosing10Page;