// src/pages/MobileCashierClosingPage.jsx (CORRIGIDO: BUSCA EM MASTER_WAITERS)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveMobileCashierClosing } from '../services/apiService';
import { attemptBackgroundSyncNewPersonnel } from '../services/syncService'; 
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

function MobileCashierClosingPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const formRefs = {
        cpf: useRef(null), 
        numeroCamiseta: useRef(null), 
        valorTotal: useRef(null), 
        valorEstorno: useRef(null), 
        credito: useRef(null),
        debito: useRef(null), 
        pix: useRef(null), 
        cashless: useRef(null), 
        valorTroco: useRef(null),
        dinheiroFisico: useRef(null),
        saveButton: useRef(null),
    };

    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState('');
    
    // Dados do Caixa (Agora busca de master_waiters para unificar)
    const [cashiers, setCashiers] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [filteredCashiers, setFilteredCashiers] = useState([]);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newCashierName, setNewCashierName] = useState('');

    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    
    const [valorTotal, setValorTotal] = useState('');
    const [valorEstorno, setValorEstorno] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    const [valorTroco, setValorTroco] = useState(''); 
    const [dinheiroFisico, setDinheiroFisico] = useState(''); 

    const [valorTotalAcerto, setValorTotalAcerto] = useState(0);
    const [diferenca, setDiferenca] = useState(0);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalState, setModalState] = useState('confirm');
    const [dataToConfirm, setDataToConfirm] = useState(null);

    const debouncedValorTotal = useDebounce(valorTotal, 300);
    const debouncedCredito = useDebounce(credito, 300);
    const debouncedDebito = useDebounce(debito, 300);
    const debouncedPix = useDebounce(pix, 300);
    const debouncedCashless = useDebounce(cashless, 300);
    const debouncedValorEstorno = useDebounce(valorEstorno, 300);
    const debouncedValorTroco = useDebounce(valorTroco, 300);
    const debouncedDinheiroFisico = useDebounce(dinheiroFisico, 300);

    const getNumericValue = (digits) => (parseInt(digits || '0', 10)) / 100;

    const handleCurrencyChange = (setter, rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '');
        setter(digitsOnly);
    };

    useEffect(() => {
        const timer = setTimeout(() => { setIsLoading(false); }, 500);
        
        // --- CORREÇÃO AQUI: Busca de 'master_waiters' em vez de 'master_cashiers' ---
        // Isso garante que a lista baixada da nuvem (que vem como waiters) apareça aqui.
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setCashiers(localPersonnel);

        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            const toDigits = (value) => value ? String(Math.round(Number(value) * 100)) : '';
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            const cashier = { cpf: closingToEdit.cpf, name: closingToEdit.cashierName };
            setSelectedCashier(cashier);
            setSearchInput(cashier.name);
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorTotal(toDigits(closingToEdit.valorTotalVenda));
            setValorEstorno(toDigits(closingToEdit.valorEstorno));
            setCredito(toDigits(closingToEdit.credito));
            setDebito(toDigits(closingToEdit.debito));
            setPix(toDigits(closingToEdit.pix));
            setCashless(toDigits(closingToEdit.cashless));
            setValorTroco(toDigits(closingToEdit.valorTroco));
            setDinheiroFisico(toDigits(closingToEdit.dinheiroFisico));
        }
        return () => clearTimeout(timer);
    }, [location.state]);

    // Busca de Caixa (na lista de master_waiters carregada)
    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedCashier) {
            const results = cashiers.filter(c => {
                const name = (c.name || '').toLowerCase();
                const cpf = (c.cpf || '').replace(/\D/g, '');
                return /^\d+$/.test(query.replace(/[.-]/g, '')) ? cpf.startsWith(query.replace(/\D/g, '')) : name.includes(query);
            });
            setFilteredCashiers(results);
            const isPotentialCpf = /^\d{11}$/.test(query.replace(/\D/g, ''));
            setShowRegisterButton(isPotentialCpf && results.length === 0);
        } else {
            setFilteredCashiers([]);
            setShowRegisterButton(false);
        }
    }, [searchInput, cashiers, selectedCashier]);

    useEffect(() => {
        const vTotal = getNumericValue(debouncedValorTotal);
        const vCred = getNumericValue(debouncedCredito);
        const vDeb = getNumericValue(debouncedDebito);
        const vPix = getNumericValue(debouncedPix);
        const vCash = getNumericValue(debouncedCashless);
        const vEstorno = getNumericValue(debouncedValorEstorno);
        const vTroco = getNumericValue(debouncedValorTroco);
        const vFisico = getNumericValue(debouncedDinheiroFisico);

        const totalDigital = vCred + vDeb + vPix + vCash;
        
        // (Venda Total - Digitais) + Troco - Estorno = Dinheiro Esperado
        const acertoCalculado = (vTotal - totalDigital) + vTroco - (temEstorno ? vEstorno : 0);
        
        setValorTotalAcerto(acertoCalculado);
        const diff = vFisico - acertoCalculado;
        setDiferenca(diff);

    }, [debouncedValorTotal, debouncedCredito, debouncedDebito, debouncedPix, debouncedCashless, debouncedValorEstorno, debouncedValorTroco, debouncedDinheiroFisico, temEstorno]);

    const handleSelectCashier = (item) => { setSelectedCashier(item); setSearchInput(item.name); setFilteredCashiers([]); };

    // --- CORREÇÃO NO CADASTRO: Salva em 'master_waiters' ---
    const handleRegisterNewCashier = () => {
        if (!newCashierName.trim()) { setAlertMessage('Nome obrigatório.'); return; }
        const cleanCpf = searchInput.replace(/\D/g, '');
        const newC = { cpf: formatCpf(cleanCpf), name: newCashierName.trim() };
        
        // Atualiza a lista local de 'waiters' (que é a usada por todos)
        const updated = [...cashiers, newC];
        localStorage.setItem('master_waiters', JSON.stringify(updated)); // Salva onde deve
        setCashiers(updated);
        
        handleSelectCashier(newC);
        
        // Envia para o sync service (ele sabe lidar com 'waiters')
        attemptBackgroundSyncNewPersonnel(newC);
        
        setRegisterModalVisible(false);
        setNewCashierName('');
        setAlertMessage(`Funcionário "${newC.name}" cadastrado!`);
    };

    const prepareAndShowSummary = () => {
        const closingData = {
            type: 'cashier',
            timestamp: timestamp || new Date().toISOString(),
            protocol,
            eventName: localStorage.getItem('activeEvent') || 'N/A',
            operatorName: localStorage.getItem('loggedInUserName') || 'N/A',
            cpf: selectedCashier.cpf,
            cashierName: selectedCashier.name,
            numeroMaquina,
            valorTotalVenda: getNumericValue(valorTotal),
            credito: getNumericValue(credito),
            debito: getNumericValue(debito),
            pix: getNumericValue(pix),
            cashless: getNumericValue(cashless),
            valorTroco: getNumericValue(valorTroco),
            temEstorno,
            valorEstorno: getNumericValue(valorEstorno),
            dinheiroFisico: getNumericValue(dinheiroFisico),
            valorAcerto: valorTotalAcerto,
            diferenca,
        };
        setDataToConfirm(closingData);
        setModalState('confirm');
        setModalVisible(true);
    };

    const handleOpenConfirmation = () => {
        if (!selectedCashier || !numeroMaquina.trim()) { 
            setAlertMessage('Selecione o caixa/funcionário e informe o número da máquina.'); 
            return; 
        }

        const dinheiroFisicoValue = getNumericValue(dinheiroFisico);
        if (dinheiroFisicoValue === 0) {
            setModalState('warning_zero_money');
            setModalVisible(true);
        } else {
            prepareAndShowSummary();
        }
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            await saveMobileCashierClosing(dataToConfirm);
            setModalState('success');
        } catch (error) {
            setAlertMessage('Erro ao salvar.');
            setModalVisible(false);
        }
    };

    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedCashier(null); setSearchInput('');
        setNumeroMaquina(''); setTemEstorno(false);
        setValorTotal(''); setCredito(''); setDebito(''); setPix(''); setCashless('');
        setValorTroco(''); setValorEstorno(''); setDinheiroFisico('');
    };

    const handleKeyDown = (e, nextField) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            formRefs[nextField]?.current?.focus();
        }
    };

    if (isLoading) return <LoadingSpinner message="Carregando..." />;

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{protocol ? 'Editar Caixa Móvel' : 'Fechamento Caixa Móvel'}</h1>

                <div className="form-section" style={{display: 'block'}}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Buscar Funcionário (Nome/CPF)</label>
                            <input ref={formRefs.cpf} onKeyDown={(e) => handleKeyDown(e, 'numeroCamiseta')} value={searchInput} onChange={(e) => {setSearchInput(e.target.value); setSelectedCashier(null);}} disabled={!!protocol} />
                            {filteredCashiers.length > 0 && <div className="suggestions-list">{filteredCashiers.map(c => <div key={c.cpf} className="suggestion-item" onClick={() => handleSelectCashier(c)}>{c.name}</div>)}</div>}
                        </div>
                        <div className="input-group"><label>Selecionado</label><input value={selectedCashier ? selectedCashier.name : ''} readOnly /></div>
                    </div>
                    {showRegisterButton && <button className="login-button" style={{marginTop: 10, backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>Cadastrar Novo?</button>}
                    <div className="form-row">
                        <div className="input-group"><label>Número da Máquina</label><input ref={formRefs.numeroCamiseta} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} /></div>
                    </div>
                </div>

                <div className="form-section" style={{display: 'block'}}>
                    <div className="form-row">
                        <div className="input-group"><label>Valor Total Venda</label><input ref={formRefs.valorTotal} onKeyDown={(e) => handleKeyDown(e, 'valorTroco')} value={formatCurrencyInput(valorTotal)} onChange={(e) => handleCurrencyChange(setValorTotal, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Fundo de Troco</label><input ref={formRefs.valorTroco} onKeyDown={(e) => handleKeyDown(e, temEstorno ? 'valorEstorno' : 'credito')} value={formatCurrencyInput(valorTroco)} onChange={(e) => handleCurrencyChange(setValorTroco, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>
                    <div className="switch-container"><label>Houve Estorno?</label><label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label></div>
                    {temEstorno && (<div className="input-group" style={{marginTop: 10}}><label>Valor do Estorno</label><input ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'credito')} value={formatCurrencyInput(valorEstorno)} onChange={(e) => handleCurrencyChange(setValorEstorno, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>)}
                    
                    <h3 style={{marginTop: 20, marginBottom: 10, color: '#555'}}>Recebimentos Digitais</h3>
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'dinheiroFisico')} value={formatCurrencyInput(cashless)} onChange={(e) => handleCurrencyChange(setCashless, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>

                    <h3 style={{marginTop: 20, marginBottom: 10, color: '#555'}}>Conferência Física</h3>
                    <div className="input-group">
                        <label>Dinheiro em Espécie (Contado na Gaveta)</label>
                        <input ref={formRefs.dinheiroFisico} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} value={formatCurrencyInput(dinheiroFisico)} onChange={(e) => handleCurrencyChange(setDinheiroFisico, e.target.value)} placeholder="0,00" inputMode="numeric" style={{backgroundColor: '#e8f0fe', fontWeight: 'bold'}}/>
                    </div>
                </div>

                <div className="results-container">
                    <p>Dinheiro a Apresentar: <strong>{formatCurrencyResult(valorTotalAcerto)}</strong></p>
                    <p className="total-text">Diferença (Sobra/Falta): <strong className="final-value" style={{color: diferenca >= 0 ? 'blue' : 'red'}}>{formatCurrencyResult(diferenca)}</strong></p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR FECHAMENTO</button>
                </div>
            </div>

            {registerModalVisible && <div className="modal-overlay"><div className="modal-content"><h2>Novo Funcionário</h2><input value={newCashierName} onChange={e => setNewCashierName(e.target.value)} placeholder="Nome" /><div className="modal-buttons"><button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button><button className="login-button" onClick={handleRegisterNewCashier}>Salvar</button></div></div></div>}

            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        {modalState === 'warning_zero_money' && <>
                            <div className="warning-icon" style={{fontSize: '40px', color: '#f39c12', marginBottom: '15px'}}>⚠️</div>
                            <h2 style={{color: '#e67e22'}}>Atenção!</h2>
                            <p style={{fontSize: '16px', lineHeight: '1.5'}}>
                                O campo <strong>Dinheiro em Espécie</strong> está zerado (R$ 0,00).
                            </p>
                            <p style={{fontSize: '16px', marginBottom: '20px'}}>
                                Confirma que este caixa <strong>não possui dinheiro físico</strong> (ex: Totem ou 100% Digital)?
                            </p>
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Não, vou corrigir</button>
                                <button className="login-button" onClick={prepareAndShowSummary} style={{backgroundColor: '#f39c12'}}>Sim, Prosseguir</button>
                            </div>
                        </>}

                        {modalState === 'confirm' && <>
                            <h2>Confirmar Fechamento de Caixa</h2>
                            {dataToConfirm && <>
                                <p><strong>Caixa:</strong> {dataToConfirm.cashierName}</p>
                                <p><strong>Máquina:</strong> {dataToConfirm.numeroMaquina}</p>
                                <hr/>
                                <p>Dinheiro na Gaveta (Inf.): <strong>{formatCurrencyResult(dataToConfirm.dinheiroFisico)}</strong></p>
                                <p>Dinheiro Esperado (Calc.): <strong>{formatCurrencyResult(dataToConfirm.valorAcerto)}</strong></p>
                                <hr/>
                                <p className="total-text">Diferença: <strong style={{color: dataToConfirm.diferenca >= 0 ? 'blue' : 'red'}}>{formatCurrencyResult(dataToConfirm.diferenca)}</strong></p>
                            </>}
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Corrigir</button>
                                <button className="login-button" onClick={handleConfirmAndSave}>Confirmar</button>
                            </div>
                        </>}

                        {modalState === 'saving' && <><div className="spinner"></div><p>Salvando...</p></>}

                        {modalState === 'success' && <>
                            <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                            <h2>Salvo com Sucesso!</h2>
                            <div className="modal-buttons">
                                <button className="modal-button primary" onClick={() => {setModalVisible(false); resetForm();}}>Novo Fechamento</button>
                                <button className="modal-button secondary" onClick={() => navigate('/financial-selection')}>Menu Principal</button>
                            </div>
                        </>}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileCashierClosingPage;