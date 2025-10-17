// src/pages/FixedCashierClosingPage.jsx (VERSÃO CORRIGIDA COM BOTÃO DE REMOVER APARECENDO)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveFixedCashierClosing } from '../services/apiService';
import { attemptBackgroundSync } from '../services/syncService';
import { formatCurrencyInput, formatCurrencyResult } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import '../App.css';
import './FixedCashierClosingPage.css';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

// --- COMPONENTE INTERNO PARA CADA CAIXA ---
const CaixaFormItem = ({ item, index, handleInputChange, handleSelectCashier, personnelList, handleKeyDown, formRefs, isEditing, onRemoveCaixa, showRemoveButton }) => {
    const [searchInput, setSearchInput] = useState(item.name || item.cpf || '');
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(item.name ? { cpf: item.cpf, name: item.name } : null);

    useEffect(() => {
        if (isEditing && item.name) {
            setSearchInput(item.name);
            setSelectedCashier({ name: item.name, cpf: item.cpf });
        }
    }, [item, isEditing]);


    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedCashier) {
            const results = personnelList.filter(person => {
                const personName = (person.name || '').toLowerCase();
                const personCpf = (person.cpf || '').replace(/\D/g, '');
                const isNumericQuery = /^\d+$/.test(query.replace(/[.-]/g, ''));
                if (isNumericQuery) { return personCpf.startsWith(query.replace(/\D/g, '')); } 
                else { return personName.includes(query); }
            });
            setFilteredPersonnel(results);
        } else {
            setFilteredPersonnel([]);
        }
    }, [searchInput, personnelList, selectedCashier]);

    const onSelect = (person) => {
        handleSelectCashier(item.id, person);
        setSelectedCashier(person);
        setSearchInput(person.name);
        setFilteredPersonnel([]);
    };
    
    const onSearchChange = (value) => {
        setSearchInput(value);
        setSelectedCashier(null);
        handleInputChange(item.id, 'cpf', '');
        handleInputChange(item.id, 'name', '');
    };
    
    const cleanAndSet = (field, value) => {
        const digitsOnly = String(value).replace(/\D/g, '');
        handleInputChange(item.id, field, digitsOnly);
    };

    return (
        <div className="caixa-item-container">
            {/* --- CÓDIGO CORRIGIDO AQUI --- */}
            <div className="caixa-header">
                <h3 className="caixa-title">Caixa {index + 1}</h3>
                {showRemoveButton && (
                    <button 
                        type="button" 
                        className="remove-caixa-button" 
                        onClick={() => onRemoveCaixa(item.id)}
                    >
                        Remover
                    </button>
                )}
            </div>

            <div className="form-row">
                <div className="input-group" style={{ position: 'relative' }}>
                    <label>Buscar Funcionário (Nome ou CPF)</label>
                    <input ref={formRefs.current[`cpf_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `numeroMaquina_${item.id}`)} placeholder="Digite o nome ou CPF" value={searchInput} onChange={(e) => onSearchChange(e.target.value)} disabled={isEditing} />
                    {filteredPersonnel.length > 0 && (
                        <div className="suggestions-list">
                            {filteredPersonnel.map(p => <div key={p.cpf} className="suggestion-item" onClick={() => onSelect(p)}>{p.name} - {p.cpf}</div>)}
                        </div>
                    )}
                </div>
                <div className="input-group">
                    <label>Nº da Máquina</label>
                    <input ref={formRefs.current[`numeroMaquina_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `valorTotalVenda_${item.id}`)} value={item.numeroMaquina} onChange={(e) => handleInputChange(item.id, 'numeroMaquina', e.target.value.toUpperCase())}/>
                </div>
            </div>
            
            <div className="form-section">
                <div className="form-row">
                    <div className="input-group">
                        <label>Valor Total da Venda</label>
                        <input ref={formRefs.current[`valorTotalVenda_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `credito_${item.id}`)} value={formatCurrencyInput(item.valorTotalVenda)} onChange={(e) => cleanAndSet('valorTotalVenda', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="input-group"><label>Crédito</label><input ref={formRefs.current[`credito_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `debito_${item.id}`)} value={formatCurrencyInput(item.credito)} onChange={(e) => cleanAndSet('credito', e.target.value)} /></div>
                    <div className="input-group"><label>Débito</label><input ref={formRefs.current[`debito_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `pix_${item.id}`)} value={formatCurrencyInput(item.debito)} onChange={(e) => cleanAndSet('debito', e.target.value)} /></div>
                </div>
                <div className="form-row">
                    <div className="input-group"><label>PIX</label><input ref={formRefs.current[`pix_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `cashless_${item.id}`)} value={formatCurrencyInput(item.pix)} onChange={(e) => cleanAndSet('pix', e.target.value)} /></div>
                    <div className="input-group"><label>Cashless</label><input ref={formRefs.current[`cashless_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `dinheiroFisico_${item.id}`)} value={formatCurrencyInput(item.cashless)} onChange={(e) => cleanAndSet('cashless', e.target.value)} /></div>
                </div>
                 <div className="input-group">
                    <label>Dinheiro Físico (Contado)</label>
                    <input ref={formRefs.current[`dinheiroFisico_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, item.temEstorno ? `valorEstorno_${item.id}` : `addCaixaButton`)} value={formatCurrencyInput(item.dinheiroFisico)} onChange={(e) => cleanAndSet('dinheiroFisico', e.target.value)} />
                </div>
            </div>
             <div className="form-row" style={{ alignItems: 'center' }}>
                <div className="switch-container">
                    <label>Houve Estorno?</label>
                    <label className="switch"><input type="checkbox" checked={item.temEstorno} onChange={(e) => handleInputChange(item.id, 'temEstorno', e.target.checked)} /><span className="slider round"></span></label>
                </div>
                {item.temEstorno && <div className="input-group" style={{marginBottom: 0}}><label>Valor do Estorno</label><input ref={formRefs.current[`valorEstorno_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `addCaixaButton`)} value={formatCurrencyInput(item.valorEstorno)} onChange={(e) => cleanAndSet('valorEstorno', e.target.value)} /></div>}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
function FixedCashierClosingPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const closingToEdit = state?.closingToEdit;

    const [personnelList, setPersonnelList] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [valorTroco, setValorTroco] = useState('');
    const [caixasDoGrupo, setCaixasDoGrupo] = useState([{ id: 1, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '', dinheiroFisico: '' }]);
    const [alertMessage, setAlertMessage] = useState('');
    const [finalDiferenca, setFinalDiferenca] = useState(0);
    const [protocol, setProtocol] = useState(null);
    
    const formRefs = useRef({});

    const debouncedCaixas = useDebounce(caixasDoGrupo, 500);
    const debouncedValorTroco = useDebounce(valorTroco, 500);
    
    const parseCurrency = (value) => {
      const stringValue = String(value);
      const cleanValue = stringValue.replace(/\D/g, '');
      if (cleanValue === '') return 0;
      return parseInt(cleanValue, 10) / 100;
    };
    
    useEffect(() => {
        if (closingToEdit) {
            setProtocol(closingToEdit.protocol);
            const formatForInput = (value) => String(Math.round((value || 0) * 100));
            setValorTroco(formatForInput(closingToEdit.valorTroco));

            const caixasEdit = closingToEdit.caixas.map((caixa, index) => ({
                id: index + 1,
                cpf: caixa.cpf,
                name: caixa.cashierName,
                numeroMaquina: caixa.numeroMaquina,
                temEstorno: caixa.temEstorno,
                valorEstorno: formatForInput(caixa.valorEstorno),
                valorTotalVenda: formatForInput(caixa.valorTotalVenda),
                credito: formatForInput(caixa.credito),
                debito: formatForInput(caixa.debito),
                pix: formatForInput(caixa.pix),
                cashless: formatForInput(caixa.cashless),
                dinheiroFisico: formatForInput(caixa.dinheiroFisico),
            }));
            setCaixasDoGrupo(caixasEdit);
        }
    }, [closingToEdit]);


    useEffect(() => {
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setPersonnelList(localPersonnel);
    }, []);

    useEffect(() => {
        const numValorTrocoGrupo = parseCurrency(debouncedValorTroco);
        let totalDinheiroFisico = 0;
        let totalAcerto = 0;

        debouncedCaixas.forEach(caixa => {
            const numValorTotalVenda = parseCurrency(caixa.valorTotalVenda);
            const numValorEstorno = parseCurrency(caixa.valorEstorno);
            const numCredito = parseCurrency(caixa.credito);
            const numDebito = parseCurrency(caixa.debito);
            const numPix = parseCurrency(caixa.pix);
            const numCashless = parseCurrency(caixa.cashless);
            
            totalDinheiroFisico += parseCurrency(caixa.dinheiroFisico);
            totalAcerto += (numValorTotalVenda - (numCredito + numDebito + numPix + numCashless) - (caixa.temEstorno ? numValorEstorno : 0));
        });

        setFinalDiferenca(totalDinheiroFisico - (totalAcerto + numValorTrocoGrupo));
    }, [debouncedCaixas, debouncedValorTroco]);

    const handleInputChange = (caixaId, field, value) => {
        setCaixasDoGrupo(prev => prev.map(caixa => caixa.id === caixaId ? { ...caixa, [field]: value } : caixa));
    };

    const handleSelectCashier = (caixaId, cashier) => {
        handleInputChange(caixaId, 'cpf', cashier.cpf);
        handleInputChange(caixaId, 'name', cashier.name);
    };

    const handleAddCaixa = () => {
        const newId = caixasDoGrupo.length > 0 ? Math.max(...caixasDoGrupo.map(c => c.id)) + 1 : 1;
        setCaixasDoGrupo([...caixasDoGrupo, { id: newId, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '', dinheiroFisico: '' }]);
    };

    const handleRemoveCaixa = (idToRemove) => {
        if (caixasDoGrupo.length <= 1) { return; }
        setCaixasDoGrupo(prevCaixas => prevCaixas.filter(caixa => caixa.id !== idToRemove));
    };

    const handleOpenConfirmation = () => {
        if (caixasDoGrupo.some(caixa => !caixa.name || !caixa.numeroMaquina)) {
            setAlertMessage('Por favor, preencha o nome e o número da máquina para todos os caixas.');
            return;
        }
        setDataToConfirm({
            totalDiferenca: finalDiferenca,
            cashierNames: caixasDoGrupo.map(c => c.name),
        });
        setModalVisible(true);
    };

    const handleFinalSave = async () => {
        setIsSaving(true);
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');
            
            const closingData = {
                type: 'fixed_cashier',
                eventName, operatorName,
                valorTroco: parseCurrency(valorTroco),
                diferencaCaixa: finalDiferenca,
                caixas: caixasDoGrupo.map(caixa => ({
                    cpf: caixa.cpf, cashierName: caixa.name, numeroMaquina: caixa.numeroMaquina,
                    temEstorno: caixa.temEstorno,
                    valorEstorno: parseCurrency(caixa.valorEstorno),
                    valorTotalVenda: parseCurrency(caixa.valorTotalVenda),
                    credito: parseCurrency(caixa.credito),
                    debito: parseCurrency(caixa.debito),
                    pix: parseCurrency(caixa.pix),
                    cashless: parseCurrency(caixa.cashless),
                    dinheiroFisico: parseCurrency(caixa.dinheiroFisico),
                })),
                protocol: protocol,
                timestamp: closingToEdit?.timestamp
            };
    
            const response = await saveFixedCashierClosing(closingData);
            const savedData = response.data;
            
            setAlertMessage(`Fechamento de grupo salvo LOCALMENTE com sucesso!\nProtocolo: ${savedData.protocol}`);
            setTimeout(() => navigate('/closing-history'), 2000);

            attemptBackgroundSync(savedData);

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            setAlertMessage('Ocorreu um erro ao salvar o fechamento de grupo localmente.');
        } finally {
            setIsSaving(false);
            setModalVisible(false);
        }
    };
    
    const getDiferencaColor = (diff) => {
        if (diff < 0) return 'red';
        if (diff > 0) return 'green';
        return 'blue';
    };

    const handleKeyDown = (e, nextField) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nextRef = formRefs.current[nextField];
        if (nextRef && nextRef.current) {
          nextRef.current.focus();
        }
      }
    };

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '1000px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{closingToEdit ? 'Editar Fechamento de Caixa Fixo' : 'Fechamento Caixa Fixo (Grupo)'}</h1>

                <div className="form-section form-row">
                    <div className="switch-container">
                        <label>Recebeu Troco (para o grupo)?</label>
                        <label className="switch"><input type="checkbox" checked={valorTroco !== ''} onChange={(e) => setValorTroco(e.target.checked ? '0' : '')} /><span className="slider round"></span></label>
                    </div>
                    {valorTroco !== '' && <div className="input-group"><label>Valor do Troco</label><input value={formatCurrencyInput(valorTroco)} onChange={(e) => setValorTroco(e.target.value)} /></div>}
                </div>

                {caixasDoGrupo.map((caixa, index) => {
                    formRefs.current[`cpf_${caixa.id}`] = formRefs.current[`cpf_${caixa.id}`] || React.createRef();
                    formRefs.current[`numeroMaquina_${caixa.id}`] = formRefs.current[`numeroMaquina_${caixa.id}`] || React.createRef();
                    formRefs.current[`valorTotalVenda_${caixa.id}`] = formRefs.current[`valorTotalVenda_${caixa.id}`] || React.createRef();
                    formRefs.current[`credito_${caixa.id}`] = formRefs.current[`credito_${caixa.id}`] || React.createRef();
                    formRefs.current[`debito_${caixa.id}`] = formRefs.current[`debito_${caixa.id}`] || React.createRef();
                    formRefs.current[`pix_${caixa.id}`] = formRefs.current[`pix_${caixa.id}`] || React.createRef();
                    formRefs.current[`cashless_${caixa.id}`] = formRefs.current[`cashless_${caixa.id}`] || React.createRef();
                    formRefs.current[`dinheiroFisico_${caixa.id}`] = formRefs.current[`dinheiroFisico_${caixa.id}`] || React.createRef();
                    formRefs.current[`valorEstorno_${caixa.id}`] = formRefs.current[`valorEstorno_${caixa.id}`] || React.createRef();
                    formRefs.current.addCaixaButton = formRefs.current.addCaixaButton || React.createRef();
                    formRefs.current.saveButton = formRefs.current.saveButton || React.createRef();
                    
                    return (
                        <CaixaFormItem 
                            key={caixa.id} 
                            item={caixa} 
                            index={index} 
                            handleInputChange={handleInputChange} 
                            handleSelectCashier={handleSelectCashier} 
                            personnelList={personnelList}
                            handleKeyDown={handleKeyDown}
                            formRefs={formRefs}
                            isEditing={!!closingToEdit}
                            onRemoveCaixa={handleRemoveCaixa}
                            showRemoveButton={caixasDoGrupo.length > 1 && !closingToEdit}
                        />
                    );
                })}

                <div className="footer-actions">
                     <button ref={formRefs.current.addCaixaButton} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} className="add-button" onClick={handleAddCaixa} disabled={!!closingToEdit}>Adicionar Novo Caixa</button>
                    <div className="results-container">
                        <p className="total-text">Diferença Final do Grupo: 
                            <strong style={{ color: getDiferencaColor(finalDiferenca), marginLeft: '10px' }}>
                                {formatCurrencyResult(finalDiferenca)}
                            </strong>
                        </p>
                        <button ref={formRefs.current.saveButton} className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
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