// src/pages/MobileCashierClosingPage.jsx (MODIFICADO PARA MODAL DE SUCESSO)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveMobileCashierClosing } from '../services/apiService';
import { attemptBackgroundSyncNewPersonnel } from '../services/syncService'; 
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import '../App.css';
import './MobileCashierClosingPage.css';

function useDebounce(value, delay) {
  // ... (código do hook useDebounce sem alteração)
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function MobileCashierClosingPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const closingToEdit = state?.closingToEdit;
    
    const formRefs = {
      // ... (código do formRefs sem alteração)
      cpf: useRef(null), numeroMaquina: useRef(null), valorTotalVenda: useRef(null),
      credito: useRef(null), debito: useRef(null), pix: useRef(null),
      cashless: useRef(null), dinheiroFisico: useRef(null), valorTroco: useRef(null),
      valorEstorno: useRef(null), saveButton: useRef(null),
    };

    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState('');
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [searchInput, setSearchInput] = useState('');
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
    const [protocol, setProtocol] = useState(null);
    
    // *** NOVO ESTADO ***
    // Adicionado para controlar o conteúdo do modal (confirm, saving, success)
    const [modalState, setModalState] = useState('confirm');

    useEffect(() => {
      // ... (código do useEffect [closingToEdit] sem alteração)
        if (closingToEdit) {
            const cashierInfo = { name: closingToEdit.cashierName, cpf: closingToEdit.cpf };
            setSelectedCashier(cashierInfo);
            setSearchInput(cashierInfo.name);
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemTroco(closingToEdit.temTroco || false);
            setTemEstorno(closingToEdit.temEstorno || false);
            setProtocol(closingToEdit.protocol);

            const formatForInput = (value) => String(Math.round((value || 0) * 100));
            setValorTotalVenda(formatForInput(closingToEdit.valorTotalVenda));
            setCredito(formatForInput(closingToEdit.credito));
            setDebito(formatForInput(closingToEdit.debito));
            setPix(formatForInput(closingToEdit.pix));
            setCashless(formatForInput(closingToEdit.cashless));
            setValorTroco(formatForInput(closingToEdit.valorTroco));
            setValorEstorno(formatForInput(closingToEdit.valorEstorno));
            setDinheiroFisico(formatForInput(closingToEdit.dinheiroFisico));
        }
    }, [closingToEdit]);


    const debouncedValorTotal = useDebounce(valorTotalVenda, 500);
    // ... (código dos hooks useDebounce sem alteração)
    const debouncedValorTroco = useDebounce(valorTroco, 500);
    const debouncedCredito = useDebounce(credito, 500);
    const debouncedDebito = useDebounce(debito, 500);
    const debouncedPix = useDebounce(pix, 500);
    const debouncedCashless = useDebounce(cashless, 500);
    const debouncedDinheiroFisico = useDebounce(dinheiroFisico, 500);
    const debouncedValorEstorno = useDebounce(valorEstorno, 500);

    const getNumericValue = (digits) => (parseInt(digits || '0', 10)) / 100;
    // ... (código de handleCurrencyChange, useEffect (isLoading, localPersonnel, searchInput, calculations) sem alteração)
    const handleCurrencyChange = (setter, rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '');
        setter(digitsOnly);
    };

    useEffect(() => {
        const timer = setTimeout(() => { setIsLoading(false); }, 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setPersonnelList(localPersonnel);
    }, []);

    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedCashier) {
            const results = personnelList.filter(person => {
                const personName = person.name.toLowerCase();
                const personCpf = person.cpf.replace(/\D/g, '');
                const isNumericQuery = /^\d+$/.test(query.replace(/[.-]/g, ''));
                if (isNumericQuery) { return personCpf.startsWith(query.replace(/\D/g, '')); } 
                else { return personName.includes(query); }
            });
            setFilteredPersonnel(results);
            const cleanQueryCpf = query.replace(/\D/g, '');
            const isPotentialCpf = /^\d{11}$/.test(cleanQueryCpf);
            if (isPotentialCpf && results.length === 0) { setShowRegisterButton(true); } 
            else { setShowRegisterButton(false); }
        } else { setFilteredPersonnel([]); setShowRegisterButton(false); }
    }, [searchInput, personnelList, selectedCashier]);

    useEffect(() => {
        const numValorTotalVenda = getNumericValue(debouncedValorTotal);
        const numValorTroco = getNumericValue(debouncedValorTroco);
        const numCredito = getNumericValue(debouncedCredito);
        const numDebito = getNumericValue(debouncedDebito);
        const numPix = getNumericValue(debouncedPix);
        const numCashless = getNumericValue(debouncedCashless);
        const numDinheiroFisico = getNumericValue(debouncedDinheiroFisico);
        const numValorEstorno = getNumericValue(debouncedValorEstorno);
        const acertoCalculado = (numValorTotalVenda + (temTroco ? numValorTroco : 0)) - (numCredito + numDebito + numPix + numCashless) - (temEstorno ? numValorEstorno : 0);
        setValorAcerto(acertoCalculado);
        const dif = numDinheiroFisico - acertoCalculado;
        setDiferenca(dif);
    }, [debouncedValorTotal, debouncedValorTroco, debouncedCredito, debito, pix, cashless, debouncedDinheiroFisico, temTroco, debouncedValorEstorno, temEstorno]);
    
    const handleSelectCashier = (cashier) => {
      // ... (código do handleSelectCashier sem alteração)
        setSelectedCashier(cashier);
        setSearchInput(cashier.name);
        setFilteredPersonnel([]);
    };

    const handleRegisterNewCashier = () => {
      // ... (código do handleRegisterNewCashier sem alteração)
        const cleanCpf = searchInput.replace(/\D/g, '');
        if (!newCashierName.trim()) { setAlertMessage('Por favor, insira o nome do novo funcionário.'); return; }
        const newCashier = { cpf: formatCpf(cleanCpf), name: newCashierName.trim() };
        let currentPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        currentPersonnel.push(newCashier);
        localStorage.setItem('master_waiters', JSON.stringify(currentPersonnel));
        setPersonnelList(currentPersonnel);
        handleSelectCashier(newCashier);
        
        attemptBackgroundSyncNewPersonnel(newCashier);

        setRegisterModalVisible(false);
        setNewCashierName('');
        setAlertMessage(`Funcionário "${newCashier.name}" cadastrado localmente com sucesso!`);
    };
    
    // *** FUNÇÃO MODIFICADA ***
    const handleOpenConfirmation = () => {
        if (!selectedCashier || !numeroMaquina) {
            setAlertMessage('Por favor, selecione um funcionário e preencha o número da máquina.');
            return;
        }
        setDataToConfirm({
            cashierName: selectedCashier.name,
            valorAcerto,
            dinheiroFisico: getNumericValue(dinheiroFisico),
            diferenca,
            // Adiciona dados que o modal de sucesso precisará
            protocol: null, 
        });
        // Garante que o modal sempre abra na tela de confirmação
        setModalState('confirm'); 
        setModalVisible(true);
    };

    // *** NOVA FUNÇÃO ***
    // Adicionada para limpar o formulário
    const resetForm = () => {
        setSelectedCashier(null);
        setSearchInput('');
        setNumeroMaquina('');
        setTemTroco(false);
        setValorTroco('');
        setTemEstorno(false);
        setValorEstorno('');
        setValorTotalVenda('');
        setCredito('');
        setDebito('');
        setPix('');
        setCashless('');
        setDinheiroFisico('');
        setValorAcerto(0);
        setDiferenca(0);
        setDataToConfirm(null);
        setProtocol(null); 
    };

    // *** NOVAS FUNÇÕES ***
    // Adicionadas para os botões do modal de sucesso
    const handleRegisterNew = () => {
        setModalVisible(false);
        resetForm();
    };

    const handleBackToMenu = () => {
        // Ajuste esta rota se for diferente (ex: /home ou /)
        navigate('/financial-selection'); 
    };


    // *** FUNÇÃO MODIFICADA ***
    // Lógica de salvamento alterada para usar o modalState
    const handleFinalSave = async () => {
        setIsSaving(true);
        setModalState('saving'); // Mostra o spinner no modal
        
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');
            const closingData = {
                type: 'cashier', eventName, operatorName,
                cpf: selectedCashier.cpf, cashierName: selectedCashier.name,
                numeroMaquina, temTroco, temEstorno,
                valorTroco: getNumericValue(valorTroco),
                valorEstorno: getNumericValue(valorEstorno),
                valorTotalVenda: getNumericValue(valorTotalVenda),
                credito: getNumericValue(credito),
                debito: getNumericValue(debito),
                pix: getNumericValue(pix),
                cashless: getNumericValue(cashless),
                dinheiroFisico: getNumericValue(dinheiroFisico),
                valorAcerto, diferenca,
                protocol: protocol,
                timestamp: closingToEdit?.timestamp
            };
            
            const response = await saveMobileCashierClosing(closingData);
            const savedData = response.data;

            // Atualiza os dados para o modal de sucesso (com o protocolo)
            setDataToConfirm(savedData);
            // Muda para a tela de sucesso
            setModalState('success');

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            setAlertMessage('Ocorreu um erro ao salvar o fechamento localmente.');
            // Em caso de erro, fecha o modal e mostra o alerta
            setModalVisible(false); 
        } finally {
            // Para o spinner do botão, mas o modal continua visível (se sucesso)
            setIsSaving(false); 
        }
    };

    const getDiferencaColor = (diff) => {
      // ... (código da função sem alteração)
        if (diff < 0) return 'red';
        if (diff > 0) return 'green';
        return 'blue';
    };

    const handleKeyDown = (e, nextField) => {
      // ... (código da função sem alteração)
      if (e.key === 'Enter') {
        e.preventDefault();
        if (formRefs[nextField] && formRefs[nextField].current) {
          formRefs[nextField].current.focus();
        }
      }
    };

    if (isLoading && !closingToEdit) {
      // ... (código do spinner inicial sem alteração)
        return <LoadingSpinner message="Carregando formulário..." />;
    }

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                {/* ... (Todo o JSX do formulário, inputs, etc. permanece O MESMO) ... */}
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{closingToEdit ? 'Editar Fechamento de Caixa Móvel' : 'Fechamento Caixa Móvel'}</h1>
                
                <div className="form-section">
                    <div className="form-row">
                        <div className="input-group">
                            <label>Buscar Funcionário (Nome ou CPF)</label>
                            <input 
                                ref={formRefs.cpf}
                                onKeyDown={(e) => handleKeyDown(e, 'numeroMaquina')}
                                placeholder="Digite o nome ou CPF" 
                                value={searchInput} 
                                onChange={(e) => { setSearchInput(e.target.value); setSelectedCashier(null); }} 
                                disabled={!!closingToEdit}
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
                        <div className="input-group">
                            <label>Funcionário Selecionado</label>
                            <input type="text" value={selectedCashier ? `${selectedCashier.name} - ${selectedCashier.cpf}` : ''} readOnly placeholder="Selecione um funcionário" />
                        </div>
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input ref={formRefs.numeroMaquina} onKeyDown={(e) => handleKeyDown(e, 'valorTotalVenda')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} />
                        </div>
                    </div>
                    {showRegisterButton && (<button className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>CPF não encontrado. Cadastrar novo funcionário?</button>)}
                </div>

                <div className="form-section">
                    <div className="form-row">
                        <div className="input-group">
                            <label>Valor Total da Venda</label>
                            <input 
                                ref={formRefs.valorTotalVenda} onKeyDown={(e) => handleKeyDown(e, 'credito')} 
                                value={formatCurrencyInput(valorTotalVenda)} 
                                onChange={(e) => handleCurrencyChange(setValorTotalVenda, e.target.value)}
                                placeholder="0,00" inputMode="numeric" />
                        </div>
                        <div className="switch-and-input-group">
                            <div className="switch-container">
                                <label>Recebeu Troco?</label>
                                <label className="switch"><input type="checkbox" checked={temTroco} onChange={() => setTemTroco(!temTroco)} /><span className="slider round"></span></label>
                            </div>
                            {temTroco && <div className="input-group"><label>Valor do Troco</label><input ref={formRefs.valorTroco} onKeyDown={(e) => handleKeyDown(e, 'credito')} value={formatCurrencyInput(valorTroco)} onChange={(e) => handleCurrencyChange(setValorTroco, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                    
                     <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'dinheiroFisico')} value={formatCurrencyInput(cashless)} onChange={(e) => handleCurrencyChange(setCashless, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>

                    <div className="form-row" style={{marginTop: '15px'}}>
                        <div className="switch-and-input-group">
                             <div className="switch-container">
                                <label>Houve Estorno?</label>
                                <label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label>
                            </div>
                            {temEstorno && <div className="input-group"><label>Valor do Estorno</label><input ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'dinheiroFisico')} value={formatCurrencyInput(valorEstorno)} onChange={(e) => handleCurrencyChange(setValorEstorno, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>}
                        </div>
                    </div>
                </div>

                <div className="results-container">
                    <p className="total-text">Dinheiro a ser apresentado: <strong>{formatCurrencyResult(valorAcerto)}</strong></p>
                    <div className="input-group">
                        <label>Total em Dinheiro Físico (Contado)</label>
                        <input 
                            ref={formRefs.dinheiroFisico} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} 
                            value={formatCurrencyInput(dinheiroFisico)} 
                            onChange={(e) => handleCurrencyChange(setDinheiroFisico, e.target.value)} 
                            placeholder="0,00" inputMode="numeric" />
                    </div>
                    <p className="total-text">Diferença: <strong style={{ color: getDiferencaColor(diferenca) }}>{formatCurrencyResult(diferenca)}</strong></p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation} disabled={isSaving}>
                        {isSaving ? 'Salvando...' : 'SALVAR E FINALIZAR'}
                    </button>
                </div>

            </div>
            
            {/* *** TODO O BLOCO DO MODAL FOI SUBSTITUÍDO *** */}
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        
                        {/* ESTADO DE CONFIRMAÇÃO (O que já existia) */}
                        {modalState === 'confirm' && (
                            <>
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
                            </>
                        )}
                        
                        {/* (NOVO) ESTADO 'SALVANDO' (copiado do garçom) */}
                        {modalState === 'saving' && (
                            <>
                                <div className="spinner"></div>
                                <p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p>
                            </>
                        )}

                        {/* (NOVO) ESTADO 'SUCESSO' (copiado do garçom) */}
                        {modalState === 'success' && (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* O modal de registro de funcionário permanece sem alteração */}
            {registerModalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Cadastrar Novo Funcionário</h2>
                        <div className="input-group">
                            <label>CPF</label>
                            <input type="text" value={formatCpf(searchInput)} readOnly />
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