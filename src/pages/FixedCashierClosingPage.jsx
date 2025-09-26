// src/pages/FixedCashierClosingPage.jsx (Com salvamento local)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // Não precisamos mais
// import { API_URL } from '../config'; // Nem da API_URL
import { saveFixedCashierClosing } from '../services/apiService'; // <<< NOVA IMPORTAÇÃO
import '../App.css';
import './FixedCashierClosingPage.css';

// ... (o início do arquivo, com as funções de formatação e o componente CaixaFormItem, continua o mesmo)
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

const CaixaFormItem = ({ item, index, handleInputChange, handleSelectCashier, personnelList }) => {
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const onCpfChange = (text) => {
        handleInputChange(item.id, 'cpf', text);
        const cleanCpf = text.replace(/\D/g, '');
        if (cleanCpf.length > 0 && !item.name) {
            setFilteredPersonnel(personnelList.filter(p => p.cpf?.toString().startsWith(cleanCpf)));
        } else {
            setFilteredPersonnel([]);
        }
    };
    const onSelectCashier = (person) => {
        handleSelectCashier(item.id, person);
        setFilteredPersonnel([]);
    };
    const cleanAndSet = (field, value) => {
        handleInputChange(item.id, field, value.replace(/\D/g, ''));
    };
    return (
        <div className="caixa-item-container">
            <h3 className="caixa-title">Caixa {index + 1}</h3>
            <div className="form-row">
                <div className="input-group" style={{ position: 'relative', flex: 1 }}>
                    <label>CPF do Caixa</label>
                    <input placeholder="Digite o CPF" value={item.cpf} onChange={(e) => onCpfChange(e.target.value)} />
                    {filteredPersonnel.length > 0 && (
                        <div className="suggestions-list">
                            {filteredPersonnel.map(p => <div key={p.cpf} className="suggestion-item" onClick={() => onSelectCashier(p)}>{p.name} - {p.cpf}</div>)}
                        </div>
                    )}
                </div>
                <div className="input-group" style={{ flex: 2 }}>
                    <label>Nome do Caixa</label>
                    <input value={item.name} readOnly placeholder="Selecione um CPF"/>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                    <label>Nº da Máquina</label>
                    <input value={item.numeroMaquina} onChange={(e) => handleInputChange(item.id, 'numeroMaquina', e.target.value.toUpperCase())}/>
                </div>
            </div>
            <div className="form-section">
                <div className="input-group"><label>Valor Total da Venda</label><input value={formatCurrencyInput(item.valorTotalVenda)} onChange={(e) => cleanAndSet('valorTotalVenda', e.target.value)} /></div>
                <div className="form-row">
                    <div className="input-group"><label>Crédito</label><input value={formatCurrencyInput(item.credito)} onChange={(e) => cleanAndSet('credito', e.target.value)} /></div>
                    <div className="input-group"><label>Débito</label><input value={formatCurrencyInput(item.debito)} onChange={(e) => cleanAndSet('debito', e.target.value)} /></div>
                </div>
                <div className="form-row">
                    <div className="input-group"><label>PIX</label><input value={formatCurrencyInput(item.pix)} onChange={(e) => cleanAndSet('pix', e.target.value)} /></div>
                    <div className="input-group"><label>Cashless</label><input value={formatCurrencyInput(item.cashless)} onChange={(e) => cleanAndSet('cashless', e.target.value)} /></div>
                </div>
                 <div className="input-group">
                    <label>Dinheiro Físico (Contado)</label>
                    <input value={formatCurrencyInput(item.dinheiroFisico)} onChange={(e) => cleanAndSet('dinheiroFisico', e.target.value)} />
                </div>
            </div>
             <div className="form-section form-row">
                <div className="switch-container">
                    <label>Houve Estorno?</label>
                    <label className="switch"><input type="checkbox" checked={item.temEstorno} onChange={(e) => handleInputChange(item.id, 'temEstorno', e.target.checked)} /><span className="slider round"></span></label>
                </div>
                {item.temEstorno && <div className="input-group"><label>Valor do Estorno</label><input value={formatCurrencyInput(item.valorEstorno)} onChange={(e) => cleanAndSet('valorEstorno', e.target.value)} /></div>}
            </div>
        </div>
    );
};


function FixedCashierClosingPage() {
    const navigate = useNavigate();
    const [personnelList, setPersonnelList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [valorTroco, setValorTroco] = useState('');
    const [caixasDoGrupo, setCaixasDoGrupo] = useState([{ id: 1, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '', dinheiroFisico: '' }]);

    useEffect(() => {
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setPersonnelList(localPersonnel);
    }, []);

    const handleInputChange = (caixaId, field, value) => {
        setCaixasDoGrupo(prev => prev.map(caixa => caixa.id === caixaId ? { ...caixa, [field]: value } : caixa));
    };

    const handleSelectCashier = (caixaId, cashier) => {
        handleInputChange(caixaId, 'cpf', cashier.cpf);
        handleInputChange(caixaId, 'name', cashier.name);
    };

    // --- FUNÇÃO DE SALVAMENTO ALTERADA ---
    const handleFinalSave = async () => {
        setIsSaving(true);
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');
            
            const closingData = {
                eventName, operatorName,
                valorTroco: (parseInt(String(valorTroco).replace(/\D/g, '') || '0', 10)) / 100,
                caixas: caixasDoGrupo.map(caixa => ({
                    cpf: caixa.cpf, cashierName: caixa.name, numeroMaquina: caixa.numeroMaquina,
                    temEstorno: caixa.temEstorno,
                    valorEstorno: (parseInt(String(caixa.valorEstorno).replace(/\D/g, '') || '0', 10)) / 100,
                    valorTotalVenda: (parseInt(String(caixa.valorTotalVenda).replace(/\D/g, '') || '0', 10)) / 100,
                    credito: (parseInt(String(caixa.credito).replace(/\D/g, '') || '0', 10)) / 100,
                    debito: (parseInt(String(caixa.debito).replace(/\D/g, '') || '0', 10)) / 100,
                    pix: (parseInt(String(caixa.pix).replace(/\D/g, '') || '0', 10)) / 100,
                    cashless: (parseInt(String(caixa.cashless).replace(/\D/g, '') || '0', 10)) / 100,
                    dinheiroFisico: (parseInt(String(caixa.dinheiroFisico).replace(/\D/g, '') || '0', 10)) / 100,
                }))
            };
    
            // Troca a chamada ao backend pela função de salvamento local
            const response = await saveFixedCashierClosing(closingData);

            alert(`Fechamento de grupo salvo LOCALMENTE com sucesso!\nProtocolo: ${response.data.protocol}`);
            navigate('/financial-selection');

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            alert('Ocorreu um erro ao salvar o fechamento de grupo localmente.');
        } finally {
            setIsSaving(false);
            setModalVisible(false);
        }
    };
    
    // O resto do arquivo (cálculos e JSX) continua o mesmo...
    const handleAddCaixa = () => {
        const newId = caixasDoGrupo.length > 0 ? Math.max(...caixasDoGrupo.map(c => c.id)) + 1 : 1;
        setCaixasDoGrupo([...caixasDoGrupo, { id: newId, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '', dinheiroFisico: '' }]);
    };
    const getFinalDiferenca = () => {
        const numValorTrocoGrupo = (parseInt(String(valorTroco).replace(/\D/g, '') || '0', 10)) / 100;
        let totalDinheiroFisico = 0;
        let totalAcerto = 0;
        caixasDoGrupo.forEach(caixa => {
            const numValorTotalVenda = (parseInt(String(caixa.valorTotalVenda).replace(/\D/g, '') || '0', 10)) / 100;
            const numValorEstorno = (parseInt(String(caixa.valorEstorno).replace(/\D/g, '') || '0', 10)) / 100;
            const numCredito = (parseInt(String(caixa.credito).replace(/\D/g, '') || '0', 10)) / 100;
            const numDebito = (parseInt(String(caixa.debito).replace(/\D/g, '') || '0', 10)) / 100;
            const numPix = (parseInt(String(caixa.pix).replace(/\D/g, '') || '0', 10)) / 100;
            const numCashless = (parseInt(String(caixa.cashless).replace(/\D/g, '') || '0', 10)) / 100;
            totalDinheiroFisico += (parseInt(String(caixa.dinheiroFisico).replace(/\D/g, '') || '0', 10)) / 100;
            totalAcerto += (numValorTotalVenda - (numCredito + numDebito + numPix + numCashless) - (caixa.temEstorno ? numValorEstorno : 0));
        });
        return totalDinheiroFisico - (totalAcerto + numValorTrocoGrupo);
    };
    const handleOpenConfirmation = () => {
        if (caixasDoGrupo.some(caixa => !caixa.name || !caixa.numeroMaquina)) {
            alert('Por favor, preencha o nome e o número da máquina para todos os caixas.');
            return;
        }
        setDataToConfirm({
            totalDiferenca: getFinalDiferenca(),
            cashierNames: caixasDoGrupo.map(c => c.name),
        });
        setModalVisible(true);
    };
    const getDiferencaColor = (diff) => {
        if (diff < 0) return 'red';
        if (diff > 0) return 'green';
        return 'blue';
    };
    return (
        <div className="app-container">
            <div className="login-form form-scrollable" style={{ maxWidth: '1000px' }}>
                <h1>Fechamento Caixa Fixo (Grupo)</h1>
                <div className="form-section form-row">
                    <div className="switch-container">
                        <label>Recebeu Troco (para o grupo)?</label>
                        <label className="switch"><input type="checkbox" checked={valorTroco !== ''} onChange={(e) => setValorTroco(e.target.checked ? '0' : '')} /><span className="slider round"></span></label>
                    </div>
                    {valorTroco !== '' && <div className="input-group"><label>Valor do Troco</label><input value={formatCurrencyInput(valorTroco)} onChange={(e) => setValorTroco(e.target.value.replace(/\D/g, ''))} /></div>}
                </div>
                {caixasDoGrupo.map((caixa, index) => (
                    <CaixaFormItem 
                        key={caixa.id} 
                        item={caixa} 
                        index={index} 
                        handleInputChange={handleInputChange} 
                        handleSelectCashier={handleSelectCashier} 
                        personnelList={personnelList} 
                    />
                ))}
                <div className="footer-actions">
                     <button className="add-button" onClick={handleAddCaixa}>Adicionar Novo Caixa</button>
                    <div className="results-container">
                        <p className="total-text">Diferença Final do Grupo: 
                            <strong style={{ color: getDiferencaColor(getFinalDiferenca()), marginLeft: '10px' }}>
                                {formatCurrencyResult(getFinalDiferenca())}
                            </strong>
                        </p>
                        <button className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'SALVAR GRUPO'}
                        </button>
                    </div>
                </div>
            </div>
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                         <h2>Confirmar Fechamento de Grupo</h2>
                        {dataToConfirm && (
                            <>
                                <p><strong>Caixas do Grupo:</strong></p>
                                <ul className="cashier-list">
                                    {dataToConfirm.cashierNames.map(name => <li key={name}>{name}</li>)}
                                </ul>
                                <hr/>
                                <p className="total-text">Diferença Total do Grupo: 
                                    <strong style={{color: getDiferencaColor(dataToConfirm.totalDiferenca), marginLeft: '10px' }}>
                                        {formatCurrencyResult(dataToConfirm.totalDiferenca)}
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default FixedCashierClosingPage;