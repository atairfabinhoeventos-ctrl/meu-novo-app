// src/pages/ZigCashlessClosingPage.jsx (Com Ícone ZIG)
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveWaiterClosing } from '../services/apiService'; // Reutiliza a função de salvar garçom
import { attemptBackgroundSyncNewPersonnel } from '../services/syncService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import '../App.css';
import './ZigCashlessClosingPage.css';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function ZigCashlessClosingPage() {
    const navigate = useNavigate();
    const location = useLocation(); 

    const formRefs = {
      cpf: useRef(null), numeroCamiseta: useRef(null), numeroMaquina: useRef(null),
      valorTotal: useRef(null), // (Agora é o campo de baixo - Recarga)
      valorEstorno: useRef(null), credito: useRef(null),
      debito: useRef(null), pix: useRef(null), 
      valorTotalProdutos: useRef(null), // (Agora é o campo de cima - Venda)
      saveButton: useRef(null),
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
    const [valorTotal, setValorTotal] = useState(''); // (Variável da Recarga Cashless)
    const [valorEstorno, setValorEstorno] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [valorTotalProdutos, setValorTotalProdutos] = useState(''); // (Variável da Venda de Produtos)
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

    const debouncedValorTotal = useDebounce(valorTotal, 300); // (Variável da Recarga)
    const debouncedCredito = useDebounce(credito, 300);
    const debouncedDebito = useDebounce(debito, 300);
    const debouncedPix = useDebounce(pix, 300);
    const debouncedValorTotalProdutos = useDebounce(valorTotalProdutos, 300); // (Variável da Venda)
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

    // Leitura dos dados (sem alteração, as variáveis corretas são preenchidas)
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
            setValorTotal(toDigits(closingToEdit.valorTotal)); // Recarga Cashless
            setValorEstorno(toDigits(closingToEdit.valorEstorno));
            setCredito(toDigits(closingToEdit.credito));
            setDebito(toDigits(closingToEdit.debito));
            setPix(toDigits(closingToEdit.pix));
            setValorTotalProdutos(toDigits(closingToEdit.valorTotalProdutos)); // Venda de Produtos
        }
    }, [location.state]);

    // Busca de garçom (sem alteração)
    useEffect(() => {
        const query = searchInput.trim().toLowerCase();
        if (query.length > 0 && !selectedWaiter) {
            const results = waiters.filter(waiter => {
                const waiterName = (waiter.name || '').toLowerCase();
                const waiterCpf = (waiter.cpf || '').replace(/\D/g, '');
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
    
    // LÓGICA DE CÁLCULO (NÃO FOI ALTERADA, como solicitado)
    useEffect(() => {
        const numValorRecargaCashless = getNumericValue(debouncedValorTotal); // (Usa a variável da Recarga)
        const numCredito = getNumericValue(debouncedCredito);
        const numDebito = getNumericValue(debouncedDebito);
        const numPix = getNumericValue(debouncedPix);
        const numValorTotalProdutos = getNumericValue(debouncedValorTotalProdutos); // (Usa a variável da Venda)
        const numValorEstorno = getNumericValue(debouncedValorEstorno);
        
        const valorEfetivoRecarga = numValorRecargaCashless - (temEstorno ? numValorEstorno : 0);
        
        // Comissão 8% sobre Venda de Produtos
        const c8 = numValorTotalProdutos * 0.08;
        const c4 = 0;
        const cTotal = c8;
        
        setComissao8(c8); 
        setComissao4(c4); 
        setComissaoTotal(cTotal);
        
        const totalAcerto = valorEfetivoRecarga - cTotal;
        setValorTotalAcerto(totalAcerto);
        
        // Diferença = Recarga - (Pagamentos + Comissão)
        const diferenca = valorEfetivoRecarga - (numCredito + numDebito + numPix + cTotal);
        
        if (diferenca < 0) {
          setDiferencaLabel('Pagar ao Garçom');
          setDiferencaPagarReceber(diferenca * -1);
        } else {
          setDiferencaLabel('Receber do Garçom');
          setDiferencaPagarReceber(diferenca);
        }
    }, [debouncedValorTotal, debouncedCredito, debouncedDebito, debouncedPix, debouncedValorTotalProdutos, debouncedValorEstorno, temEstorno]);

    // Funções (handleSelectWaiter, handleRegisterNewWaiter, handleOpenConfirmation, handleConfirmAndSave, resetForm, handleRegisterNew, handleBackToMenu)
    // permanecem com a lógica interna IDÊNTICA.
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
        
        attemptBackgroundSyncNewPersonnel(newWaiter);

        setRegisterModalVisible(false);
        setNewWaiterName('');
        setAlertMessage(`Garçom "${newWaiter.name}" cadastrado localmente com sucesso!`);
    };
    
    const handleOpenConfirmation = () => {
        if (!selectedWaiter) {
            setAlertMessage('Por favor, selecione um garçom válido da lista.');
            return;
        }
        if (!numeroMaquina.trim()) {
            setAlertMessage('Por favor, preencha o número da máquina.');
            return;
        }

        const waiterCpf = selectedWaiter.cpf;
        const waiterName = selectedWaiter.name;
        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const operatorName = localStorage.getItem('loggedInUserName') || 'N/A';
        
        // Objeto de dados (sem alteração, pois as variáveis corretas são usadas)
        const closingData = {
            type: 'waiter_zig',
            timestamp: timestamp || new Date().toISOString(), protocol, eventName, operatorName, 
            cpf: waiterCpf,
            waiterName: waiterName,
            numeroCamiseta, numeroMaquina, 
            valorTotal: getNumericValue(valorTotal), // (Variável da Recarga)
            credito: getNumericValue(credito),
            debito: getNumericValue(debito), 
            pix: getNumericValue(pix), 
            valorTotalProdutos: getNumericValue(valorTotalProdutos), // (Variável da Venda)
            temEstorno, 
            valorEstorno: getNumericValue(valorEstorno), 
            comissaoTotal, valorTotalAcerto, diferencaLabel, diferencaPagarReceber,
        };
        setDataToConfirm(closingData); setModalState('confirm'); setModalVisible(true); 
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            const response = await saveWaiterClosing(dataToConfirm);
            const savedData = response.data;
            setDataToConfirm(savedData);
            setModalState('success');
        } catch (error) {
            setAlertMessage('Ocorreu um erro ao salvar o fechamento.');
            setModalVisible(false);
        }
    };
    
    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedWaiter(null); setSearchInput('');
        setNumeroCamiseta(''); setNumeroMaquina(''); setTemEstorno(false); setValorEstorno('');
        setValorTotal(''); setCredito(''); setDebito(''); setPix(''); 
        setValorTotalProdutos('');
    };

    const handleRegisterNew = () => { setModalVisible(false); resetForm(); };
    const handleBackToMenu = () => { navigate('/financial-selection'); };
    
    // Navegação 'Enter'
    const handleKeyDown = (e, nextField) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (formRefs[nextField] && formRefs[nextField].current) {
          formRefs[nextField].current.focus();
        }
      }
    };
    
    if (isLoading) { return <LoadingSpinner message="Carregando formulário..." />; }

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                
                {/* *** TÍTULO E ÍCONE ATUALIZADOS *** */}
                <div className="title-with-icon">
                    {/* O caminho /assets/zig-logo.png funciona por causa da pasta 'public' */}
                    <img src="/assets/zig-logo.png" alt="Zig Logo" className="page-icon" />
                    <h1>{protocol ? 'Editar Fechamento' : 'Fechamento Cashless ZIG 8%'}</h1>
                </div>
                
                {/* Seção de Busca de Garçom (Mantida) */}
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
                                            key={item.cpf} 
                                            className="suggestion-item" 
                                            onClick={() => handleSelectWaiter(item)}>
                                                {item.name} - {item.cpf}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="input-group">
                            <label>Garçom Selecionado</label>
                            <input 
                                type="text" 
                                value={selectedWaiter ? `${selectedWaiter.name} - ${selectedWaiter.cpf}` : ''} 
                                readOnly 
                                placeholder="Selecione um garçom da lista" 
                            />
                        </div>
                    </div>
                    {showRegisterButton && (<button className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>CPF não encontrado. Cadastrar novo garçom?</button>)}
                    <div className="form-row">
                        <div className="input-group"><label>Número da Camiseta</label><input ref={formRefs.numeroCamiseta} onKeyDown={(e) => handleKeyDown(e, 'numeroMaquina')} value={numeroCamiseta} onChange={(e) => setNumeroCamiseta(e.target.value)} /></div>
                        
                        {/* *** onKeyDown ATUALIZADO *** (Aponta para o novo campo de cima) */}
                        <div className="input-group"><label>Número da Máquina</label><input ref={formRefs.numeroMaquina} onKeyDown={(e) => handleKeyDown(e, 'valorTotalProdutos')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} /></div>
                    </div>
                </div>

                {/* Seção de Valores (TROCADOS) */}
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        
                        {/* *** CAMPO MOVIDO PARA CIMA (Antigo 'Produtos', agora 'Venda') *** */}
                        <div className="input-group">
                            <label>Valor Total da Venda</label> {/* Label Atualizado */}
                            <input
                                ref={formRefs.valorTotalProdutos} // Ref Atualizada
                                onKeyDown={(e) => handleKeyDown(e, temEstorno ? 'valorEstorno' : 'credito')} // onKeyDown Atualizado
                                value={formatCurrencyInput(valorTotalProdutos)} // Variável Atualizada
                                onChange={(e) => handleCurrencyChange(setValorTotalProdutos, e.target.value)} // Variável Atualizada
                                placeholder="0,00"
                                inputMode="numeric"
                                className="highlighted-input" // Destaque Mantido
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
                    {/* Linha Crédito e Débito (Mantida) */}
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                     {/* Linha PIX e NOVO CAMPO */}
                     <div className="form-row">
                        <div className="input-group">
                            <label>PIX</label>
                            {/* *** onKeyDown ATUALIZADO *** (Aponta para o novo campo de baixo) */}
                            <input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric" />
                        </div>
                        
                        {/* *** CAMPO MOVIDO PARA BAIXO (Antigo 'Recarga') *** */}
                        <div className="input-group"> 
                            <label>Valor de Recarga Cashless</label> {/* Label Atualizado */}
                            <input 
                                ref={formRefs.valorTotal} // Ref Atualizada
                                onKeyDown={(e) => handleKeyDown(e, 'saveButton')} // onKeyDown Atualizado
                                value={formatCurrencyInput(valorTotal)} // Variável Atualizada
                                onChange={(e) => handleCurrencyChange(setValorTotal, e.target.value)} // Variável Atualizada
                                placeholder="Ativação + Cashless" /* *** PLACEHOLDER ATUALIZADO *** */
                                inputMode="numeric"
                                // Destaque removido daqui
                            />
                        </div>
                    </div>
                </div>
                
                {/* Container de Resultados (Sem alteração, a lógica não mudou) */}
                <div className="results-container">
                    <p>Comissão (8% sobre Produtos): <strong>{formatCurrencyResult(comissao8)}</strong></p>
                    <hr/>
                    <p className="total-text">Comissão Total: <strong>{formatCurrencyResult(comissaoTotal)}</strong></p>
                    <p className="total-text">{diferencaLabel}: 
                        <strong className="final-value" style={{ color: diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>
                            {formatCurrencyResult(diferencaPagarReceber)}
                        </strong>
                    </p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR E FINALIZAR</button>
                </div>
            </div>

            {/* Modal de Registro de Garçom (Sem alteração) */}
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
            
            {/* Modal de Confirmação (Sem alteração) */}
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
                                {/* Os labels do modal de confirmação continuam os mesmos, mas usam as variáveis corretas */}
                                <p>Valor Recarga Cashless: <strong>{formatCurrencyResult(dataToConfirm.valorTotal)}</strong></p>
                                <p>Valor Total Produtos: <strong>{formatCurrencyResult(dataToConfirm.valorTotalProdutos)}</strong></p>
                                <p>Valor Total Comissão (8%): <strong>{formatCurrencyResult(dataToConfirm.comissaoTotal)}</strong></p>
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

export default ZigCashlessClosingPage;