import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { saveWaiterClosing } from '../services/apiService';
import { attemptBackgroundSync } from '../services/syncService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import '../App.css';
import './WaiterClosingPage.css';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function WaiterClosingPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const formRefs = {
      cpf: useRef(null), numeroCamiseta: useRef(null), numeroMaquina: useRef(null),
      valorTotal: useRef(null), valorEstorno: useRef(null), credito: useRef(null),
      debito: useRef(null), pix: useRef(null), cashless: useRef(null), saveButton: useRef(null),
    };

    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState('');
    const [waiters, setWaiters] = useState([]);
    const [selectedWaiter, setSelectedWaiter] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [filteredWaiters, setFilteredWaiters] = useState([]);
    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroCamiseta, setNumeroCamiseta] = useState('');
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    const [valorTotal, setValorTotal] = useState('');
    const [valorEstorno, setValorEstorno] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    const [comissao8, setComissao8] = useState(0);
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

    const debouncedValorTotal = useDebounce(valorTotal, 300);
    const debouncedCredito = useDebounce(credito, 300);
    const debouncedDebito = useDebounce(debito, 300);
    const debouncedPix = useDebounce(pix, 300);
    const debouncedCashless = useDebounce(cashless, 300);
    const debouncedValorEstorno = useDebounce(valorEstorno, 300);

    const getNumericValue = (digits) => (parseInt(digits || '0', 10)) / 100;

    const handleCurrencyChange = (setter, rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '');
        setter(digitsOnly);
    };

    useEffect(() => {
        const timer = setTimeout(() => { setIsLoading(false); }, 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setWaiters(localWaiters);
        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            const toDigits = (value) => {
              if (value === null || value === undefined) return '';
              return String(Math.round(Number(value) * 100));
            };
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            const waiter = { cpf: closingToEdit.cpf, name: closingToEdit.waiterName };
            setSelectedWaiter(waiter);
            setSearchInput(waiter.name);
            setNumeroCamiseta(closingToEdit.numeroCamiseta || '');
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorTotal(toDigits(closingToEdit.valorTotal));
            setValorEstorno(toDigits(closingToEdit.valorEstorno));
            setCredito(toDigits(closingToEdit.credito));
            setDebito(toDigits(closingToEdit.debito));
            setPix(toDigits(closingToEdit.pix));
            setCashless(toDigits(closingToEdit.cashless));
        }
    }, [location.state]);

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedWaiter) {
            const results = waiters.filter(waiter => {
                const waiterName = (waiter.name || waiter.NOME || '').toLowerCase();
                const waiterCpf = (waiter.cpf || waiter.CPF || '').replace(/\D/g, '');
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
        const numValorTotal = getNumericValue(debouncedValorTotal);
        const numCredito = getNumericValue(debouncedCredito);
        const numDebito = getNumericValue(debouncedDebito);
        const numPix = getNumericValue(debouncedPix);
        const numCashless = getNumericValue(debouncedCashless);
        const numValorEstorno = getNumericValue(debouncedValorEstorno);
        
        const valorEfetivoVenda = numValorTotal - (temEstorno ? numValorEstorno : 0);
        const baseComissao8 = valorEfetivoVenda - numCashless;
        const c8 = baseComissao8 * 0.08;
        const c4 = numCashless * 0.04;
        const cTotal = c8 + c4;
        setComissao8(c8); setComissao4(c4); setComissaoTotal(cTotal);
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

    const handleSelectWaiter = (waiter) => {
        console.log("Garçom Selecionado:", waiter);
        setSelectedWaiter(waiter);
        setSearchInput(waiter.name || waiter.NOME);
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
        
        const waiterCpf = selectedWaiter.cpf || selectedWaiter.CPF;
        const waiterName = selectedWaiter.name || selectedWaiter.NOME;

        if (!waiterCpf) {
            alert("ERRO: O garçom selecionado não possui um CPF válido. Verifique o cadastro.");
            return;
        }

        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const operatorName = localStorage.getItem('loggedInUserName') || 'N/A';
        
        const closingData = {
            type: 'waiter', timestamp: timestamp || new Date().toISOString(), protocol, eventName, operatorName, 
            cpf: waiterCpf,
            waiterName: waiterName,
            numeroCamiseta, numeroMaquina, valorTotal: getNumericValue(valorTotal), credito: getNumericValue(credito),
            debito: getNumericValue(debito), pix: getNumericValue(pix), cashless: getNumericValue(cashless),
            temEstorno, valorEstorno: getNumericValue(valorEstorno), comissaoTotal, valorTotalAcerto, diferencaLabel, diferencaPagarReceber,
        };
        setDataToConfirm(closingData); setModalState('confirm'); setModalVisible(true); 
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            console.log('[WaiterPage] DADOS ENVIADOS PARA SALVAR:', dataToConfirm);
            const response = await saveWaiterClosing(dataToConfirm);
            const savedData = response.data;
            setDataToConfirm(savedData);
            setModalState('success');
            attemptBackgroundSync(savedData);
        } catch (error) {
            setAlertMessage('Ocorreu um erro ao salvar o fechamento.');
            setModalVisible(false);
        }
    };
    
    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedWaiter(null); setSearchInput('');
        setNumeroCamiseta(''); setNumeroMaquina(''); setTemEstorno(false); setValorEstorno('');
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

    const handleDirectSendTest = async () => {
        if (!selectedWaiter) {
            alert("TESTE: Por favor, selecione um garçom primeiro.");
            return;
        }
        console.log('[TESTE DIRETO] Conteúdo do objeto selectedWaiter:', selectedWaiter);

        const waiterCpf = selectedWaiter.cpf || selectedWaiter.CPF;
        const waiterName = selectedWaiter.name || selectedWaiter.NOME;

        if (!waiterCpf) {
            alert("ERRO DE TESTE: O garçom selecionado não possui um CPF válido.");
            return;
        }

        const testClosingData = {
            type: 'waiter',
            timestamp: new Date().toISOString(),
            protocol: `TESTE-${Date.now()}`,
            eventName: localStorage.getItem('activeEvent'),
            cpf: waiterCpf,
            waiterName: waiterName,
            numeroCamiseta,
            numeroMaquina,
            valorTotal: getNumericValue(valorTotal),
            credito: getNumericValue(credito),
            debito: getNumericValue(debito),
            pix: getNumericValue(pix),
            cashless: getNumericValue(cashless),
            temEstorno,
            valorEstorno: getNumericValue(valorEstorno),
            comissaoTotal,
            diferencaLabel,
            diferencaPagarReceber,
            acerto: diferencaLabel === 'Pagar ao Garçom' ? -diferencaPagarReceber : diferencaPagarReceber,
            operatorName: localStorage.getItem('loggedInUserName')
        };
        const payload = {
            eventName: testClosingData.eventName,
            waiterData: [{
                ...testClosingData,
                timestamp: new Date(testClosingData.timestamp).toLocaleString('pt-BR'),
            }],
            cashierData: [],
        };
        console.log('[TESTE DIRETO] Payload final que será enviado:', payload);
        try {
            await axios.post(`${API_URL}/api/cloud-sync`, payload);
            alert('TESTE DE ENVIO DIRETO CONCLUÍDO COM SUCESSO! Verifique a planilha.');
        } catch (error) {
            alert('TESTE FALHOU! Ocorreu um erro ao enviar diretamente. Verifique o console.');
            console.error('[TESTE DIRETO] Erro:', error);
        }
    };
    
    if (isLoading) { return <LoadingSpinner message="Carregando formulário..." />; }

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{protocol ? 'Editar Fechamento' : 'Fechamento Garçom 8%'}</h1>
                
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Buscar Garçom (Nome ou CPF)</label>
                            <input 
                                ref={formRefs.cpf} 
                                onKeyDown={(e) => handleKeyDown(e, 'numeroCamiseta')} 
                                placeholder="Digite o nome ou CPF do garçom" 
                                value={searchInput} 
                                onChange={(e) => { setSearchInput(e.target.value); setSelectedWaiter(null); }}  
                                disabled={!!protocol} 
                            />
                            {filteredWaiters.length > 0 && ( 
                                <div className="suggestions-list">
                                    {filteredWaiters.map(item => (
                                        <div 
                                            key={item.cpf || item.CPF} 
                                            className="suggestion-item" 
                                            onClick={() => handleSelectWaiter(item)}>
                                                {(item.name || item.NOME)} - {(item.cpf || item.CPF)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="input-group">
                            <label>Garçom Selecionado</label>
                            <input 
                                type="text" 
                                value={selectedWaiter ? `${selectedWaiter.name || selectedWaiter.NOME} - ${selectedWaiter.cpf || selectedWaiter.CPF}` : ''} 
                                readOnly 
                                placeholder="Selecione um garçom da lista" 
                            />
                        </div>
                    </div>
                    {showRegisterButton && (<button className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>CPF não encontrado. Cadastrar novo garçom?</button>)}
                    <div className="form-row">
                        <div className="input-group"><label>Número da Camiseta</label><input ref={formRefs.numeroCamiseta} onKeyDown={(e) => handleKeyDown(e, 'numeroMaquina')} value={numeroCamiseta} onChange={(e) => setNumeroCamiseta(e.target.value)} /></div>
                        <div className="input-group"><label>Número da Máquina</label><input ref={formRefs.numeroMaquina} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} /></div>
                    </div>
                </div>

                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Valor Total da Venda</label>
                            <input
                                ref={formRefs.valorTotal} onKeyDown={(e) => handleKeyDown(e, temEstorno ? 'valorEstorno' : 'credito')} 
                                value={formatCurrencyInput(valorTotal)} 
                                onChange={(e) => handleCurrencyChange(setValorTotal, e.target.value)}
                                placeholder="0,00"
                                inputMode="numeric"
                            />
                        </div>
                         <div className="switch-container">
                            <label>Houve Estorno Manual?</label>
                            <label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label>
                        </div>
                    </div>
                    {temEstorno && ( 
                        <div className="input-group" style={{marginTop: '15px'}}>
                            <label>Valor do Estorno</label>
                            <input
                                ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'credito')} 
                                value={formatCurrencyInput(valorEstorno)} 
                                onChange={(e) => handleCurrencyChange(setValorEstorno, e.target.value)}
                                placeholder="0,00"
                                inputMode="numeric"
                            />
                        </div>
                    )}
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                     <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} value={formatCurrencyInput(cashless)} onChange={(e) => handleCurrencyChange(setCashless, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                </div>
                
                <div className="results-container">
                    <p>Comissão (8%): <strong>{formatCurrencyResult(comissao8)}</strong></p>
                    <p>Comissão (4%): <strong>{formatCurrencyResult(comissao4)}</strong></p><hr/>
                    <p className="total-text">Comissão Total: <strong>{formatCurrencyResult(comissaoTotal)}</strong></p>
                    <p className="total-text">{diferencaLabel}: 
                        <strong className="final-value" style={{ color: diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>
                            {formatCurrencyResult(diferencaPagarReceber)}
                        </strong>
                    </p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR E FINALIZAR</button>
                    
                    <button onClick={handleDirectSendTest} style={{backgroundColor: '#dc3545', marginTop: '15px'}} className="login-button">
                        TESTE DE ENVIO DIRETO
                    </button>
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
                                <p><strong>Nº Camisa:</strong> {dataToConfirm.numeroCamiseta}</p>
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

export default WaiterClosingPage;