// src/pages/WaiterClosing10Page.jsx (Com layout de formulário corrigido)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import '../App.css';
import './WaiterClosingPage.css'; // <<< REUTILIZANDO O MESMO CSS CORRIGIDO

// ... (Funções de formatação no topo continuam as mesmas)
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

function WaiterClosing10Page() {
    // ... (Toda a lógica de states e useEffects continua a mesma)
    const navigate = useNavigate();
    const [waiters, setWaiters] = useState([]);
    const [selectedWaiter, setSelectedWaiter] = useState(null);
    const [cpfInput, setCpfInput] = useState('');
    const [filteredWaiters, setFilteredWaiters] = useState([]);
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
    const [valorAcerto, setValorAcerto] = useState(0);
    const [acertoLabel, setAcertoLabel] = useState('Aguardando valores...');
    const [valorTotalAcerto, setValorTotalAcerto] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newWaiterName, setNewWaiterName] = useState('');

    useEffect(() => {
        const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setWaiters(localWaiters);
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
        const numValorTotal = (parseInt(String(valorTotal).replace(/\D/g, '') || '0', 10)) / 100;
        const numValorEstorno = (parseInt(String(valorEstorno).replace(/\D/g, '') || '0', 10)) / 100;
        const numCashless = (parseInt(String(cashless).replace(/\D/g, '') || '0', 10)) / 100;
        const numCredito = (parseInt(String(credito).replace(/\D/g, '') || '0', 10)) / 100;
        const numDebito = (parseInt(String(debito).replace(/\D/g, '') || '0', 10)) / 100;
        const numPix = (parseInt(String(pix).replace(/\D/g, '') || '0', 10)) / 100;
        const valorEfetivoVenda = numValorTotal - (temEstorno ? numValorEstorno : 0);
        const baseComissao10 = valorEfetivoVenda - numCashless;
        const c10 = baseComissao10 * 0.10;
        setComissao10(c10);
        const c4 = numCashless * 0.04;
        setComissao4(c4);
        const cTotal = c10 + c4;
        setComissaoTotal(cTotal);
        setValorTotalAcerto(valorEfetivoVenda - cTotal);
        const dinheiroDevido = valorEfetivoVenda - (numCredito + numDebito + numPix + numCashless);
        const diferenca = dinheiroDevido - cTotal;
        if (diferenca < 0) {
          setAcertoLabel('Pagar ao Garçom');
          setValorAcerto(diferenca * -1);
        } else {
          setAcertoLabel('Receber do Garçom');
          setValorAcerto(diferenca);
        }
    }, [valorTotal, credito, debito, pix, cashless, valorEstorno, temEstorno]);

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
        if (!selectedWaiter || !numeroMaquina) {
            alert('Por favor, selecione um garçom e preencha o número da máquina.');
            return;
        }
        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const data = {
            eventName,
            waiterName: selectedWaiter.name,
            numeroMaquina,
            valorTotal: (parseInt(String(valorTotal).replace(/\D/g, '') || '0', 10)) / 100,
            comissaoTotal,
            valorTotalAcerto,
            acertoLabel,
            valorAcerto,
        };
        setDataToConfirm(data);
        setModalVisible(true);
    };
    const handleFinalSave = async () => {
        setIsSaving(true);
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');
            const closingData = {
                eventName, operatorName,
                cpf: selectedWaiter.cpf, waiterName: selectedWaiter.name,
                numeroMaquina, temEstorno, valorEstorno: (parseInt(String(valorEstorno).replace(/\D/g, '') || '0', 10)) / 100,
                valorTotal: (parseInt(String(valorTotal).replace(/\D/g, '') || '0', 10)) / 100,
                credito: (parseInt(String(credito).replace(/\D/g, '') || '0', 10)) / 100,
                debito: (parseInt(String(debito).replace(/\D/g, '') || '0', 10)) / 100,
                pix: (parseInt(String(pix).replace(/\D/g, '') || '0', 10)) / 100,
                cashless: (parseInt(String(cashless).replace(/\D/g, '') || '0', 10)) / 100,
                comissaoTotal, acertoLabel, valorAcerto,
            };
            const response = await axios.post(`${API_URL}/api/closings/waiter10`, closingData);
            alert(`Fechamento salvo com sucesso!\nProtocolo: ${response.data.protocol}`);
            navigate('/financial-selection');
        } catch (error) {
            alert('Ocorreu um erro ao salvar o fechamento.');
        } finally {
            setIsSaving(false);
            setModalVisible(false);
        }
    };
    const cleanAndSetNumeric = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, ''));
    };

    return (
        <div className="app-container">
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <h1>Fechamento Garçom 10%</h1>
                
                {/* --- ESTRUTURA DO FORMULÁRIO REVISADA --- */}
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group">
                            <label>CPF do Garçom</label>
                            <input 
                                placeholder="Digite o CPF para buscar" 
                                value={formatCpf(cpfInput)} 
                                onChange={(e) => { setCpfInput(e.target.value); setSelectedWaiter(null); }} 
                            />
                            {filteredWaiters.length > 0 && (
                                <div className="suggestions-list">
                                    {filteredWaiters.map(item => (
                                        <div key={item.cpf} className="suggestion-item" onClick={() => handleSelectWaiter(item)}>
                                            {item.name} - {item.cpf}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="input-group">
                            <label>Nome do Garçom</label>
                            <input type="text" value={selectedWaiter ? selectedWaiter.name : ''} readOnly placeholder="Selecione um CPF"/>
                        </div>
                    </div>

                    {showRegisterButton && (
                        <button 
                            className="login-button" 
                            style={{marginTop: '10px', backgroundColor: '#5bc0de'}} 
                            onClick={() => setRegisterModalVisible(true)}
                        >
                            CPF não encontrado. Cadastrar novo garçom?
                        </button>
                    )}

                    <div className="form-row">
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} />
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
                </div>

                <div className="form-section" style={{ display: 'block' }}>
                    <div className="input-group">
                      <label>Valor Total da Venda</label>
                      <input value={formatCurrencyInput(valorTotal)} onChange={cleanAndSetNumeric(setValorTotal)} />
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input value={formatCurrencyInput(credito)} onChange={cleanAndSetNumeric(setCredito)} /></div>
                        <div className="input-group"><label>Débito</label><input value={formatCurrencyInput(debito)} onChange={cleanAndSetNumeric(setDebito)} /></div>
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>PIX</label><input value={formatCurrencyInput(pix)} onChange={cleanAndSetNumeric(setPix)} /></div>
                        <div className="input-group"><label>Cashless</label><input value={formatCurrencyInput(cashless)} onChange={cleanAndSetNumeric(setCashless)} /></div>
                    </div>
                </div>
                {/* ------------------------------------ */}

                <div className="results-container">
                    <p>Comissão (10%): <strong>{formatCurrencyResult(comissao10)}</strong></p>
                    <p>Comissão (4%): <strong>{formatCurrencyResult(comissao4)}</strong></p><hr/>
                    <p className="total-text">Comissão Total: <strong>{formatCurrencyResult(comissaoTotal)}</strong></p>
                    <p className="total-text">{acertoLabel} 
                        <strong className="final-value" style={{ color: acertoLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}> {formatCurrencyResult(valorAcerto)}</strong>
                    </p>
                    <button className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'SALVAR E FINALIZAR'}
                    </button>
                </div>
            </div>

            {/* Modais continuam iguais */}
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Deseja Confirmar o Fechamento?</h2>
                        {dataToConfirm && (
                            <>
                                <p><strong>Evento:</strong> {dataToConfirm.eventName}</p>
                                <p><strong>Garçom:</strong> {dataToConfirm.waiterName}</p>
                                <p><strong>Nº Máquina:</strong> {dataToConfirm.numeroMaquina}</p>
                                <hr />
                                <p>Valor Total da Venda: <strong>{formatCurrencyResult(dataToConfirm.valorTotal)}</strong></p>
                                <p>Valor Total Comissão: <strong>{formatCurrencyResult(dataToConfirm.comissaoTotal)}</strong></p>
                                <p>Valor Total de Acerto: <strong>{formatCurrencyResult(dataToConfirm.valorTotalAcerto)}</strong></p>
                                <hr />
                                <p className="total-text">{dataToConfirm.acertoLabel}: 
                                    <strong style={{ color: dataToConfirm.acertoLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>
                                        {formatCurrencyResult(dataToConfirm.valorAcerto)}
                                    </strong>
                                </p>
                            </>
                        )}
                        <div className="modal-buttons">
                            <button className="cancel-button" onClick={() => setModalVisible(false)}>Não</button>
                            <button className="login-button" onClick={handleFinalSave} disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Sim, Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {registerModalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Cadastrar Novo Garçom</h2>
                        <div className="input-group">
                            <label>CPF</label>
                            <input type="text" value={formatCpf(cpfInput)} readOnly />
                        </div>
                        <div className="input-group">
                            <label>Nome do Garçom</label>
                            <input 
                                type="text" 
                                value={newWaiterName} 
                                onChange={(e) => setNewWaiterName(e.target.value)} 
                                placeholder="Digite o nome completo" 
                            />
                        </div>
                        <div className="modal-buttons">
                            <button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button>
                            <button className="login-button" onClick={handleRegisterNewWaiter}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default WaiterClosing10Page;