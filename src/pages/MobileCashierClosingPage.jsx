import React, { useState, useEffect, useRef } from 'react';
// 1. Importar o hook useLocation para ler os dados da navegação
import { useNavigate, useLocation } from 'react-router-dom';
import { saveMobileCashierClosing } from '../services/apiService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import '../App.css';
import './MobileCashierClosingPage.css';

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
    // 2. Obter os dados de edição passados pela navegação
    const { state } = useLocation();
    const closingToEdit = state?.closingToEdit;
    
    const formRefs = {
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
    // NOVO: Estado para armazenar o protocolo durante a edição
    const [protocol, setProtocol] = useState(null);

    // --- CÓDIGO NOVO ADICIONADO ---
    // 3. Adicionar useEffect para pré-preencher o formulário se estiver em modo de edição
    useEffect(() => {
        if (closingToEdit) {
            // Preenche os dados do funcionário
            const cashierInfo = { name: closingToEdit.cashierName, cpf: closingToEdit.cpf };
            setSelectedCashier(cashierInfo);
            setSearchInput(cashierInfo.name);
            
            // Preenche os outros campos
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemTroco(closingToEdit.temTroco || false);
            setTemEstorno(closingToEdit.temEstorno || false);
            setProtocol(closingToEdit.protocol); // Armazena o protocolo

            // Converte os valores numéricos de volta para o formato de string de dígitos
            // Ex: 123.45 -> "12345"
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
    const debouncedValorTroco = useDebounce(valorTroco, 500);
    const debouncedCredito = useDebounce(credito, 500);
    const debouncedDebito = useDebounce(debito, 500);
    const debouncedPix = useDebounce(pix, 500);
    const debouncedCashless = useDebounce(cashless, 500);
    const debouncedDinheiroFisico = useDebounce(dinheiroFisico, 500);
    const debouncedValorEstorno = useDebounce(valorEstorno, 500);

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
    }, [debouncedValorTotal, debouncedValorTroco, debouncedCredito, debouncedDebito, debouncedPix, debouncedCashless, debouncedDinheiroFisico, temTroco, debouncedValorEstorno, temEstorno]);
    
    const handleSelectCashier = (cashier) => {
        setSelectedCashier(cashier);
        setSearchInput(cashier.name);
        setFilteredPersonnel([]);
    };

    const handleRegisterNewCashier = () => {
        const cleanCpf = searchInput.replace(/\D/g, '');
        if (!newCashierName.trim()) { setAlertMessage('Por favor, insira o nome do novo funcionário.'); return; }
        const newCashier = { cpf: formatCpf(cleanCpf), name: newCashierName.trim() };
        let currentPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        currentPersonnel.push(newCashier);
        localStorage.setItem('master_waiters', JSON.stringify(currentPersonnel));
        setPersonnelList(currentPersonnel);
        handleSelectCashier(newCashier);
        setRegisterModalVisible(false);
        setNewCashierName('');
        setAlertMessage(`Funcionário "${newCashier.name}" cadastrado localmente com sucesso!`);
    };
    
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
        });
        setModalVisible(true);
    };

    const handleFinalSave = async () => {
        setIsSaving(true);
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
                protocol: protocol, // Inclui o protocolo se estiver editando
                timestamp: closingToEdit?.timestamp // Mantém o timestamp original se estiver editando
            };
            const response = await saveMobileCashierClosing(closingData);
            setAlertMessage(`Fechamento salvo LOCALMENTE com sucesso!\nProtocolo: ${response.data.protocol}`);
            setTimeout(() => navigate('/closing-history'), 2000); // Redireciona para o histórico
        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            setAlertMessage('Ocorreu um erro ao salvar o fechamento localmente.');
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
        if (formRefs[nextField] && formRefs[nextField].current) {
          formRefs[nextField].current.focus();
        }
      }
    };

    if (isLoading && !closingToEdit) { // Só mostra o loading inicial se não for uma edição
        return <LoadingSpinner message="Carregando formulário..." />;
    }

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                {/* 4. Título dinâmico */}
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
                                disabled={!!closingToEdit} // Desabilita a busca no modo de edição
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