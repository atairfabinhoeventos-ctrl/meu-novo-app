// src/pages/MobileCashierClosingPage.jsx (Com salvamento local)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // Não precisamos mais do axios aqui
// import { API_URL } from '../config'; // Nem da API_URL
import { saveMobileCashierClosing } from '../services/apiService'; // <<< NOVA IMPORTAÇÃO
import '../App.css';
import './WaiterClosingPage.css';

// ... (todas as funções de formatação e o início do componente continuam iguais)
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

function MobileCashierClosingPage() {
    const navigate = useNavigate();
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [cpfInput, setCpfInput] = useState('');
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temTroco, setTemTroco] = useState(false);
    const [valorTroco, setValorTroco] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    const [valorEstorno, setValorEstorno] = useState('');
    const [valorTotalVenda, setValorTotalVenda] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    const [dinheiroFisico, setDinheiroFisico] = useState('');
    const [valorAcerto, setValorAcerto] = useState(0);
    const [diferenca, setDiferenca] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newCashierName, setNewCashierName] = useState('');

    useEffect(() => {
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setPersonnelList(localPersonnel);
    }, []);

    useEffect(() => {
        const cleanCpf = cpfInput.replace(/\D/g, '');
        if (cleanCpf.length > 0 && !selectedCashier) {
            const results = personnelList.filter(p => p.cpf?.toString().replace(/\D/g, '').startsWith(cleanCpf));
            setFilteredPersonnel(results);
            setShowRegisterButton(cleanCpf.length === 11 && results.length === 0);
        } else {
            setFilteredPersonnel([]);
            setShowRegisterButton(false);
        }
    }, [cpfInput, personnelList, selectedCashier]);

    useEffect(() => {
        const numValorTotalVenda = (parseInt(String(valorTotalVenda).replace(/\D/g, '') || '0', 10)) / 100;
        const numValorTroco = (parseInt(String(valorTroco).replace(/\D/g, '') || '0', 10)) / 100;
        const numCredito = (parseInt(String(credito).replace(/\D/g, '') || '0', 10)) / 100;
        const numDebito = (parseInt(String(debito).replace(/\D/g, '') || '0', 10)) / 100;
        const numPix = (parseInt(String(pix).replace(/\D/g, '') || '0', 10)) / 100;
        const numCashless = (parseInt(String(cashless).replace(/\D/g, '') || '0', 10)) / 100;
        const numDinheiroFisico = (parseInt(String(dinheiroFisico).replace(/\D/g, '') || '0', 10)) / 100;
        const numValorEstorno = (parseInt(String(valorEstorno).replace(/\D/g, '') || '0', 10)) / 100;
        const acertoCalculado = (numValorTotalVenda + (temTroco ? numValorTroco : 0)) - (numCredito + numDebito + numPix + numCashless) - (temEstorno ? numValorEstorno : 0);
        setValorAcerto(acertoCalculado);
        const dif = numDinheiroFisico - acertoCalculado;
        setDiferenca(dif);
    }, [valorTotalVenda, valorTroco, credito, debito, pix, cashless, dinheiroFisico, temTroco, valorEstorno, temEstorno]);

    const handleSelectCashier = (cashier) => {
        setSelectedCashier(cashier);
        setCpfInput(cashier.cpf);
        setFilteredPersonnel([]);
    };

    const handleRegisterNewCashier = () => {
        if (!newCashierName.trim()) {
            alert('Por favor, insira o nome do novo caixa.');
            return;
        }
        const newCashier = { cpf: formatCpf(cpfInput), name: newCashierName.trim() };
        let currentPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        currentPersonnel.push(newCashier);
        localStorage.setItem('master_waiters', JSON.stringify(currentPersonnel));
        setPersonnelList(currentPersonnel);
        handleSelectCashier(newCashier);
        setRegisterModalVisible(false);
        setNewCashierName('');
        alert(`Funcionário "${newCashier.name}" cadastrado localmente com sucesso!`);
    };

    const handleOpenConfirmation = () => {
        if (!selectedCashier || !numeroMaquina) {
            alert('Por favor, selecione um caixa e preencha o número da máquina.');
            return;
        }
        setDataToConfirm({
            cashierName: selectedCashier.name,
            valorAcerto,
            dinheiroFisico: (parseInt(String(dinheiroFisico).replace(/\D/g, '') || '0', 10)) / 100,
            diferenca,
        });
        setModalVisible(true);
    };

    // --- FUNÇÃO DE SALVAMENTO ALTERADA ---
    const handleFinalSave = async () => {
        setIsSaving(true);
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');
            
            const closingData = {
                eventName, operatorName,
                cpf: selectedCashier.cpf, cashierName: selectedCashier.name,
                numeroMaquina, temTroco, temEstorno,
                valorTroco: (parseInt(String(valorTroco).replace(/\D/g, '') || '0', 10)) / 100,
                valorEstorno: (parseInt(String(valorEstorno).replace(/\D/g, '') || '0', 10)) / 100,
                valorTotalVenda: (parseInt(String(valorTotalVenda).replace(/\D/g, '') || '0', 10)) / 100,
                credito: (parseInt(String(credito).replace(/\D/g, '') || '0', 10)) / 100,
                debito: (parseInt(String(debito).replace(/\D/g, '') || '0', 10)) / 100,
                pix: (parseInt(String(pix).replace(/\D/g, '') || '0', 10)) / 100,
                cashless: (parseInt(String(cashless).replace(/\D/g, '') || '0', 10)) / 100,
                dinheiroFisico: (parseInt(String(dinheiroFisico).replace(/\D/g, '') || '0', 10)) / 100,
                valorAcerto, diferenca,
            };
            
            // Troca a chamada direta ao backend pela função de salvamento local
            const response = await saveMobileCashierClosing(closingData);
            
            alert(`Fechamento salvo LOCALMENTE com sucesso!\nProtocolo: ${response.data.protocol}`);
            navigate('/financial-selection');

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            alert('Ocorreu um erro ao salvar o fechamento localmente.');
        } finally {
            setIsSaving(false);
            setModalVisible(false);
        }
    };

    // O resto do arquivo (funções de formatação e JSX) continua o mesmo...
    const cleanAndSetNumeric = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, ''));
    };

    const getDiferencaColor = (diff) => {
        if (diff < 0) return 'red';
        if (diff > 0) return 'green';
        return 'blue';
    };

    return (
        <div className="app-container">
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <h1>Fechamento Caixa Móvel</h1>
                
                <div className="form-section">
                    <div className="input-group" style={{ position: 'relative' }}>
                        <label>CPF do Caixa</label>
                        <input 
                            placeholder="Digite o CPF para buscar" 
                            value={formatCpf(cpfInput)} 
                            onChange={(e) => { setCpfInput(e.target.value); setSelectedCashier(null); }} 
                        />
                        {filteredPersonnel.length > 0 && (
                            <div className="suggestions-list">
                                {filteredPersonnel.map(item => (
                                    <div key={item.cpf} className="suggestion-item" onClick={() => handleSelectCashier(item)}>
                                        {item.name} - {item.cpf}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {showRegisterButton && (
                        <button 
                            className="login-button" 
                            style={{marginTop: '10px', backgroundColor: '#5bc0de'}} 
                            onClick={() => setRegisterModalVisible(true)}
                        >
                            CPF não encontrado. Cadastrar novo funcionário?
                        </button>
                    )}

                    {selectedCashier && <p className="selected-name">Caixa Selecionado: <strong>{selectedCashier.name}</strong></p>}
                    <div className="input-group">
                        <label>Número da Máquina</label>
                        <input value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} />
                    </div>
                </div>

                <div className="form-section form-row">
                    <div className="switch-container">
                        <label>Recebeu Troco?</label>
                        <label className="switch"><input type="checkbox" checked={temTroco} onChange={() => setTemTroco(!temTroco)} /><span className="slider round"></span></label>
                    </div>
                    {temTroco && <div className="input-group"><label>Valor do Troco</label><input value={formatCurrencyInput(valorTroco)} onChange={cleanAndSetNumeric(setValorTroco)} /></div>}
                </div>
                <div className="form-section form-row">
                     <div className="switch-container">
                        <label>Houve Estorno?</label>
                        <label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label>
                    </div>
                    {temEstorno && <div className="input-group"><label>Valor do Estorno</label><input value={formatCurrencyInput(valorEstorno)} onChange={cleanAndSetNumeric(setValorEstorno)} /></div>}
                </div>
                <div className="form-section">
                    <div className="input-group"><label>Valor Total da Venda</label><input value={formatCurrencyInput(valorTotalVenda)} onChange={cleanAndSetNumeric(setValorTotalVenda)} /></div>
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input value={formatCurrencyInput(credito)} onChange={cleanAndSetNumeric(setCredito)} /></div>
                        <div className="input-group"><label>Débito</label><input value={formatCurrencyInput(debito)} onChange={cleanAndSetNumeric(setDebito)} /></div>
                    </div>
                     <div className="form-row">
                        <div className="input-group"><label>PIX</label><input value={formatCurrencyInput(pix)} onChange={cleanAndSetNumeric(setPix)} /></div>
                        <div className="input-group"><label>Cashless</label><input value={formatCurrencyInput(cashless)} onChange={cleanAndSetNumeric(setCashless)} /></div>
                    </div>
                </div>
                <div className="results-container">
                    <p className="total-text">Dinheiro a ser apresentado: <strong>{formatCurrencyResult(valorAcerto)}</strong></p>
                    <div className="input-group">
                        <label>Total em Dinheiro Físico (Contado)</label>
                        <input value={formatCurrencyInput(dinheiroFisico)} onChange={cleanAndSetNumeric(setDinheiroFisico)} />
                    </div>
                    <p className="total-text">Diferença: <strong style={{ color: getDiferencaColor(diferenca) }}>{formatCurrencyResult(diferenca)}</strong></p>
                    <button className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'SALVAR E FINALIZAR'}
                    </button>
                </div>
            </div>
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                         <h2>Confirmar Fechamento</h2>
                        {dataToConfirm && (
                            <>
                                <p><strong>Caixa:</strong> {dataToConfirm.cashierName}</p>
                                <hr/>
                                <p>Dinheiro a Apresentar: <strong>{formatCurrencyResult(dataToConfirm.valorAcerto)}</strong></p>
                                <p>Dinheiro Contado: <strong>{formatCurrencyResult(dataToConfirm.dinheiroFisico)}</strong></p>
                                <hr/>
                                <p className="total-text">Diferença: <strong style={{color: getDiferencaColor(dataToConfirm.diferenca)}}>{formatCurrencyResult(dataToConfirm.diferenca)}</strong></p>
                            </>
                        )}
                        <div className="modal-buttons">
                            <button className="cancel-button" onClick={() => setModalVisible(false)}>Cancelar</button>
                            <button className="login-button" onClick={handleFinalSave} disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {registerModalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Cadastrar Novo Funcionário</h2>
                        <div className="input-group">
                            <label>CPF</label>
                            <input type="text" value={formatCpf(cpfInput)} readOnly />
                        </div>
                        <div className="input-group">
                            <label>Nome do Funcionário</label>
                            <input type="text" value={newCashierName} onChange={(e) => setNewCashierName(e.target.value)} placeholder="Digite o nome completo" />
                        </div>
                        <div className="modal-buttons">
                            <button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button>
                            <button className="login-button" onClick={handleRegisterNewCashier}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileCashierClosingPage;