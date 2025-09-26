// src/pages/WaiterClosingPage.jsx (Com validação de soma aprimorada)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveWaiterClosing } from '../services/apiService';
import '../App.css';
import './WaiterClosingPage.css';

function formatCurrencyInput(value) {
  if (!value) return '';
  const cleanValue = String(value).replace(/\D/g, '');
  if (cleanValue === '') return '';
  const numberValue = parseInt(cleanValue, 10);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue / 100);
}

function formatCurrencyResult(value) {
    if (isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const formatCpf = (text) => {
  const cleanText = text.replace(/\D/g, '');
  if (cleanText.length <= 3) return cleanText;
  if (cleanText.length <= 6) return `${cleanText.slice(0, 3)}.${cleanText.slice(3)}`;
  if (cleanText.length <= 9) return `${cleanText.slice(0, 3)}.${cleanText.slice(3, 6)}.${cleanText.slice(6)}`;
  return `${cleanText.slice(0, 3)}.${cleanText.slice(3, 6)}.${cleanText.slice(6, 9)}-${cleanText.slice(9, 11)}`;
};

function WaiterClosingPage() {
    const navigate = useNavigate();
    const location = useLocation(); 

    const [waiters, setWaiters] = useState([]);
    const [selectedWaiter, setSelectedWaiter] = useState(null);
    const [cpfInput, setCpfInput] = useState('');
    const [filteredWaiters, setFilteredWaiters] = useState([]);
    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroCamiseta, setNumeroCamiseta] = useState('');
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    const [valorEstorno, setValorEstorno] = useState('');
    const [valorTotal, setValorTotal] = useState('');
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

    const parseCurrency = (value) => (parseInt(String(value).replace(/\D/g, '') || '0', 10)) / 100;

    useEffect(() => {
        const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setWaiters(localWaiters);
        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            setSelectedWaiter({ cpf: closingToEdit.cpf, name: closingToEdit.waiterName });
            setCpfInput(closingToEdit.cpf);
            setNumeroCamiseta(closingToEdit.numeroCamiseta || '');
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorEstorno(String(closingToEdit.valorEstorno * 100));
            setValorTotal(String(closingToEdit.valorTotal * 100));
            setCredito(String(closingToEdit.credito * 100));
            setDebito(String(closingToEdit.debito * 100));
            setPix(String(closingToEdit.pix * 100));
            setCashless(String(closingToEdit.cashless * 100));
        }
    }, []);

    useEffect(() => {
        const cleanCpf = cpfInput.replace(/\D/g, '');
        if (cleanCpf.length > 0 && !selectedWaiter) {
            const results = waiters.filter(w => w.cpf?.toString().replace(/\D/g, '').startsWith(cleanCpf));
            setFilteredWaiters(results);
            if (cleanCpf.length === 11 && results.length === 0) {
                setShowRegisterButton(true);
            } else {
                setShowRegisterButton(false);
            }
        } else {
            setFilteredWaiters([]);
            setShowRegisterButton(false);
        }
    }, [cpfInput, waiters, selectedWaiter]);
    
    useEffect(() => {
        const numValorTotal = parseCurrency(valorTotal);
        const numCredito = parseCurrency(credito);
        const numDebito = parseCurrency(debito);
        const numPix = parseCurrency(pix);
        const numCashless = parseCurrency(cashless);
        const numValorEstorno = parseCurrency(valorEstorno);

        const valorEfetivoVenda = numValorTotal - (temEstorno ? numValorEstorno : 0);
        const baseComissao8 = valorEfetivoVenda - numCashless;
        const c8 = baseComissao8 * 0.08;
        const c4 = numCashless * 0.04;
        const cTotal = c8 + c4;
        setComissao8(c8);
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
    }, [valorTotal, credito, debito, pix, cashless, valorEstorno, temEstorno]);

    const handlePaymentChange = (setter, value, fieldName) => {
      const numValorTotal = parseCurrency(valorTotal);
      if (numValorTotal === 0) {
        setter(value.replace(/\D/g, ''));
        return;
      }
      
      const values = { credito, debito, pix, cashless };
      values[fieldName] = value; 

      const somaPagamentos = parseCurrency(values.credito) + parseCurrency(values.debito) + parseCurrency(values.pix) + parseCurrency(values.cashless);

      if (somaPagamentos > numValorTotal) {
        alert('Erro de Digitação: A soma dos pagamentos não pode ser maior que a Venda Total.');
        setter(''); 
      } else {
        setter(value.replace(/\D/g, '')); 
      }
    };

    const handleSelectWaiter = (waiter) => {
        setSelectedWaiter(waiter);
        setCpfInput(waiter.cpf);
        setFilteredWaiters([]);
    };

    const handleRegisterNewWaiter = () => {
        if (!newWaiterName.trim()) {
            alert('Por favor, insira o nome do novo garçom.');
            return;
        }
        const newWaiter = { cpf: formatCpf(cpfInput), name: newWaiterName.trim() };
        let currentWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        currentWaiters.push(newWaiter);
        localStorage.setItem('master_waiters', JSON.stringify(currentWaiters));
        setWaiters(currentWaiters);
        handleSelectWaiter(newWaiter);
        setRegisterModalVisible(false);
        setNewWaiterName('');
        alert(`Garçom "${newWaiter.name}" cadastrado localmente com sucesso!`);
    };
    
    const handleOpenConfirmation = () => {
        if (!selectedWaiter) {
            alert('Por favor, selecione um garçom.');
            return;
        }
        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const operatorName = localStorage.getItem('loggedInUserName') || 'N/A';
        const closingData = {
            timestamp: timestamp || new Date().toISOString(),
            protocol,
            eventName, operatorName, cpf: selectedWaiter.cpf, waiterName: selectedWaiter.name,
            numeroCamiseta, numeroMaquina,
            valorTotal: parseCurrency(valorTotal),
            credito: parseCurrency(credito),
            debito: parseCurrency(debito),
            pix: parseCurrency(pix),
            cashless: parseCurrency(cashless),
            temEstorno, valorEstorno: parseCurrency(valorEstorno),
            comissaoTotal, valorTotalAcerto, diferencaLabel, diferencaPagarReceber,
        };
        setDataToConfirm(closingData);
        setModalState('confirm');
        setModalVisible(true); 
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            const response = await saveWaiterClosing(dataToConfirm);
            setDataToConfirm(prevData => ({...prevData, protocol: response.data.protocol}));
            setModalState('success');
        } catch (error) {
            alert('Ocorreu um erro ao salvar o fechamento.');
            setModalVisible(false);
        }
    };
    
    const resetForm = () => {
        setProtocol(null);
        setTimestamp(null);
        setSelectedWaiter(null);
        setCpfInput('');
        setNumeroCamiseta('');
        setNumeroMaquina('');
        setTemEstorno(false);
        setValorEstorno('');
        setValorTotal('');
        setCredito('');
        setDebito('');
        setPix('');
        setCashless('');
    };

    const handleRegisterNew = () => {
        setModalVisible(false);
        resetForm();
    };

    const handleBackToMenu = () => {
        navigate('/financial-selection');
    };
    
    const cleanAndSetNumeric = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, ''));
    };
    
    return (
        <div className="app-container">
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <h1>{protocol ? 'Editar Fechamento' : 'Fechamento Garçom 8%'}</h1>
                
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>CPF do Garçom</label>
                            <input placeholder="Digite os 11 dígitos do CPF" value={formatCpf(cpfInput)} onChange={(e) => { setCpfInput(e.target.value); setSelectedWaiter(null); }}  disabled={!!protocol} />
                            {filteredWaiters.length > 0 && ( <div className="suggestions-list">{filteredWaiters.map(item => (<div key={item.cpf} className="suggestion-item" onClick={() => handleSelectWaiter(item)}>{item.name} - {item.cpf}</div>))}</div>)}
                        </div>
                        <div className="input-group">
                            <label>Nome do Garçom</label>
                            <input type="text" value={selectedWaiter ? selectedWaiter.name : ''} readOnly placeholder="Selecione um CPF para preencher" />
                        </div>
                    </div>
                    {showRegisterButton && (<button className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>CPF não encontrado. Cadastrar novo garçom?</button>)}
                    <div className="form-row">
                        <div className="input-group">
                            <label>Número da Camiseta</label>
                            <input value={numeroCamiseta} onChange={(e) => setNumeroCamiseta(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} />
                        </div>
                    </div>
                </div>

                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>Valor Total da Venda</label>
                            <input value={formatCurrencyInput(valorTotal)} onChange={cleanAndSetNumeric(setValorTotal)} />
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
                            <input value={formatCurrencyInput(valorEstorno)} onChange={cleanAndSetNumeric(setValorEstorno)} />
                        </div>
                    )}
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input value={formatCurrencyInput(credito)} onChange={(e) => handlePaymentChange(setCredito, e.target.value, 'credito')} /></div>
                        <div className="input-group"><label>Débito</label><input value={formatCurrencyInput(debito)} onChange={(e) => handlePaymentChange(setDebito, e.target.value, 'debito')} /></div>
                    </div>
                     <div className="form-row">
                        <div className="input-group"><label>PIX</label><input value={formatCurrencyInput(pix)} onChange={(e) => handlePaymentChange(setPix, e.target.value, 'pix')} /></div>
                        <div className="input-group"><label>Cashless</label><input value={formatCurrencyInput(cashless)} onChange={(e) => handlePaymentChange(setCashless, e.target.value, 'cashless')} /></div>
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
                    <button className="login-button" onClick={handleOpenConfirmation}>SALVAR E FINALIZAR</button>
                </div>
            </div>

            {registerModalVisible && (<div className="modal-overlay"><div className="modal-content"><h2>Cadastrar Novo Garçom</h2><div className="input-group"><label>CPF</label><input type="text" value={formatCpf(cpfInput)} readOnly /></div><div className="input-group"><label>Nome do Garçom</label><input type="text" value={newWaiterName} onChange={(e) => setNewWaiterName(e.target.value)} placeholder="Digite o nome completo" /></div><div className="modal-buttons"><button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button><button className="login-button" onClick={handleRegisterNewWaiter}>Salvar</button></div></div></div>)}
            
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
                                        {formatCurrencyResult(diferencaPagarReceber)}
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