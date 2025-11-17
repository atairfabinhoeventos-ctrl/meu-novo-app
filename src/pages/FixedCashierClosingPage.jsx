// src/pages/FixedCashierClosingPage.jsx (MODIFICADO PARA MODAL DE SUCESSO)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveFixedCashierClosing } from '../services/apiService';
import { attemptBackgroundSyncNewPersonnel } from '../services/syncService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import '../App.css';
import './FixedCashierClosingPage.css';

function useDebounce(value, delay) {
  // ... (código do hook useDebounce sem alteração)
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

// --- COMPONENTE INTERNO PARA CADA CAIXA ---
// O componente CaixaFormItem permanece exatamente o MESMO
const CaixaFormItem = ({
    item, index, handleInputChange, handleSelectCashier, personnelList,
    handleKeyDown, formRefs, isEditing, onRemoveCaixa, showRemoveButton,
    valorTroco, setValorTroco,
    addNewPersonnel, setAlertMessage
}) => {
    // ... (Todo o código do componente CaixaFormItem (linhas 31-233) permanece inalterado)
    // ... (Ele já tem seu próprio modal de "Cadastrar Funcionário" que é independente)
    const [searchInput, setSearchInput] = useState(item.name || item.cpf || '');
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(item.name ? { cpf: item.cpf, name: item.name } : null);

    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newCashierName, setNewCashierName] = useState('');

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

            const cleanQueryCpf = query.replace(/\D/g, '');
            const isPotentialCpf = /^\d{11}$/.test(cleanQueryCpf);
            if (isPotentialCpf && results.length === 0) {
                setShowRegisterButton(true);
            } else {
                setShowRegisterButton(false);
            }

        } else {
            setFilteredPersonnel([]);
            setShowRegisterButton(false);
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

    const handleRegisterNewCashier = () => {
        const cleanCpf = searchInput.replace(/\D/g, '');
        if (!newCashierName.trim()) {
            setAlertMessage('Por favor, insira o nome do novo funcionário.');
            return;
        }
        const newCashier = { cpf: formatCpf(cleanCpf), name: newCashierName.trim() };

        addNewPersonnel(newCashier); // Chama a função do pai para atualizar o localStorage e o state //
        onSelect(newCashier); // Seleciona o novo caixa (função existente) //

        setRegisterModalVisible(false);
        setNewCashierName('');
        setAlertMessage(`Funcionário "${newCashier.name}" cadastrado localmente com sucesso!`);
    };


    return (
        <div className="caixa-item-container">
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

            {index === 0 && (
                <div className="form-section form-row" style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <div className="switch-container">
                        <label>Recebeu Troco (Fundo de Caixa)?</label>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={valorTroco !== ''}
                                onChange={(e) => setValorTroco(e.target.checked ? '0' : '')}
                                disabled={isEditing} // Mantém desabilitado na edição por segurança
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                    {valorTroco !== '' && (
                        <div className="input-group">
                            <label>Valor do Troco (Fundo)</label>
                            <input
                                ref={formRefs.current.valorTroco}
                                onKeyDown={(e) => handleKeyDown(e, `cpf_${item.id}`)}
                                value={formatCurrencyInput(valorTroco)}
                                onChange={(e) => setValorTroco(String(e.target.value).replace(/\D/g, ''))}
                                // disabled={isEditing} // <-- REMOVIDO para permitir edição
                                inputMode="numeric"
                            />
                        </div>
                    )}
                </div>
            )}


            <div className="form-row">
                <div className="input-group" style={{ position: 'relative' }}>
                    <label>Buscar Funcionário (Nome ou CPF)</label>
                    <input ref={formRefs.current[`cpf_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `numeroMaquina_${item.id}`)} placeholder="Digite o nome ou CPF" value={searchInput} onChange={(e) => onSearchChange(e.target.value)} disabled={isEditing} />
                    {filteredPersonnel.length > 0 && (
                        <div className="suggestions-list">
                            {filteredPersonnel.map(p => <div key={p.cpf} className="suggestion-item" onClick={() => onSelect(p)}>{p.name} - {p.cpf}</div>)}
                        </div>
                    )}
                    {showRegisterButton && (
                        <button
                            type="button"
                            className="login-button"
                            style={{marginTop: '10px', backgroundColor: '#5bc0de', width: '100%'}}
                            onClick={() => setRegisterModalVisible(true)}
                        >
                            CPF não encontrado. Cadastrar novo funcionário?
                        </button>
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
                        <input ref={formRefs.current[`valorTotalVenda_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `credito_${item.id}`)} value={formatCurrencyInput(item.valorTotalVenda)} onChange={(e) => cleanAndSet('valorTotalVenda', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" />
                    </div>
                </div>
                <div className="form-row">
                    <div className="input-group"><label>Crédito</label><input ref={formRefs.current[`credito_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `debito_${item.id}`)} value={formatCurrencyInput(item.credito)} onChange={(e) => cleanAndSet('credito', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
                    <div className="input-group"><label>Débito</label><input ref={formRefs.current[`debito_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `pix_${item.id}`)} value={formatCurrencyInput(item.debito)} onChange={(e) => cleanAndSet('debito', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
                </div>
                <div className="form-row">
                    <div className="input-group"><label>PIX</label><input ref={formRefs.current[`pix_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `cashless_${item.id}`)} value={formatCurrencyInput(item.pix)} onChange={(e) => cleanAndSet('pix', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
                    <div className="input-group"><label>Cashless</label><input ref={formRefs.current[`cashless_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, item.temEstorno ? `valorEstorno_${item.id}` : `addCaixaButton`)} value={formatCurrencyInput(item.cashless)} onChange={(e) => cleanAndSet('cashless', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
                </div>
            </div>
             <div className="form-row" style={{ alignItems: 'center' }}>
                <div className="switch-container">
                    <label>Houve Estorno?</label>
                    <label className="switch"><input type="checkbox" checked={item.temEstorno} onChange={(e) => handleInputChange(item.id, 'temEstorno', e.target.checked)} /><span className="slider round"></span></label>
                </div>
                {item.temEstorno && <div className="input-group" style={{marginBottom: 0}}><label>Valor do Estorno</label><input ref={formRefs.current[`valorEstorno_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `addCaixaButton`)} value={formatCurrencyInput(item.valorEstorno)} onChange={(e) => cleanAndSet('valorEstorno', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>}
            </div>

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
                            <input
                                type="text"
                                value={newCashierName}
                                onChange={(e) => setNewCashierName(e.target.value)}
                                placeholder="Digite o nome completo"
                            />
                        </div>
                        <div className="modal-buttons">
                            <button type="button" className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button>
                            <button type="button" className="login-button" onClick={handleRegisterNewCashier}>Salvar</button>
                        </div>
                    </div>
                </div>
            )}
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
    const [totalDinheiroFisico, setTotalDinheiroFisico] = useState('');
    const [caixasDoGrupo, setCaixasDoGrupo] = useState([{ id: 1, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
    const [alertMessage, setAlertMessage] = useState('');
    const [finalDiferenca, setFinalDiferenca] = useState(0);
    const [protocol, setProtocol] = useState(null);

    // *** NOVO ESTADO ***
    const [modalState, setModalState] = useState('confirm');

    const formRefs = useRef({});

    // ... (código dos hooks useDebounce, parseCurrency, formatForInput sem alteração)
    const debouncedCaixas = useDebounce(caixasDoGrupo, 500);
    const debouncedValorTroco = useDebounce(valorTroco, 500);
    const debouncedTotalDinheiroFisico = useDebounce(totalDinheiroFisico, 500);

    const parseCurrency = (value) => {
      const stringValue = String(value);
      const cleanValue = stringValue.replace(/\D/g, '');
      if (cleanValue === '') return 0;
      return parseInt(cleanValue, 10) / 100;
    };

    const formatForInput = (value) => String(Math.round((value || 0) * 100));

    // ... (código do useEffect [closingToEdit] sem alteração)
    useEffect(() => {
        if (closingToEdit) {
            setProtocol(closingToEdit.protocol);
            // Carrega o troco normalmente
            setValorTroco(formatForInput(closingToEdit.valorTroco));

            // Verifica se o total do grupo foi salvo explicitamente
            if (closingToEdit.totalDinheiroFisicoGrupo !== undefined && closingToEdit.totalDinheiroFisicoGrupo !== null) {
                console.log("[FixedCashierEdit] Carregando totalDinheiroFisicoGrupo salvo:", closingToEdit.totalDinheiroFisicoGrupo);
                setTotalDinheiroFisico(formatForInput(closingToEdit.totalDinheiroFisicoGrupo));
            } else {
                // Fallback para registros antigos: Soma os individuais
                console.log("[FixedCashierEdit] totalDinheiroFisicoGrupo não encontrado, somando individuais (fallback)...");
                let totalDinheiroFisicoSalvo = 0;
                closingToEdit.caixas.forEach((caixa) => {
                    totalDinheiroFisicoSalvo += (caixa.dinheiroFisico || 0);
                });
                setTotalDinheiroFisico(formatForInput(totalDinheiroFisicoSalvo));
            }

            // Mapeia os caixas individuais
            const caixasEdit = closingToEdit.caixas.map((caixa, index) => {
                return {
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
                    protocol: caixa.protocol // Preserva o protocolo individual //
                };
            });
            setCaixasDoGrupo(caixasEdit);
        }
    }, [closingToEdit]);

    // ... (código do useEffect [personnelList] e addNewPersonnel sem alteração)
    useEffect(() => {
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setPersonnelList(localPersonnel);
    }, []);

    const addNewPersonnel = (newPersonnel) => {
        const updatedList = [...personnelList, newPersonnel];
        localStorage.setItem('master_waiters', JSON.stringify(updatedList));
        setPersonnelList(updatedList);

        attemptBackgroundSyncNewPersonnel(newPersonnel);
    };

    // ... (código do useEffect [cálculo total] sem alteração)
    useEffect(() => {
        const numValorTrocoGrupo = parseCurrency(debouncedValorTroco);
        const numTotalDinheiroFisico = parseCurrency(debouncedTotalDinheiroFisico);

        let totalAcerto = 0;

        debouncedCaixas.forEach(caixa => {
            const numValorTotalVenda = parseCurrency(caixa.valorTotalVenda);
            const numValorEstorno = parseCurrency(caixa.valorEstorno);
            const numCredito = parseCurrency(caixa.credito);
            const numDebito = parseCurrency(caixa.debito);
            const numPix = parseCurrency(caixa.pix);
            const numCashless = parseCurrency(caixa.cashless);

            totalAcerto += (numValorTotalVenda - (numCredito + numDebito + numPix + numCashless) - (caixa.temEstorno ? numValorEstorno : 0));
        });

        setFinalDiferenca(numTotalDinheiroFisico - (totalAcerto + numValorTrocoGrupo));

    }, [debouncedCaixas, debouncedValorTroco, debouncedTotalDinheiroFisico]);

    // ... (código de handleInputChange, handleSelectCashier, handleAddCaixa, handleRemoveCaixa sem alteração)
    const handleInputChange = (caixaId, field, value) => {
        setCaixasDoGrupo(prev => prev.map(caixa => caixa.id === caixaId ? { ...caixa, [field]: value } : caixa));
    };

    const handleSelectCashier = (caixaId, cashier) => {
        handleInputChange(caixaId, 'cpf', cashier.cpf);
        handleInputChange(caixaId, 'name', cashier.name);
    };

    const handleAddCaixa = () => {
        const newId = caixasDoGrupo.length > 0 ? Math.max(...caixasDoGrupo.map(c => c.id)) + 1 : 1;
        setCaixasDoGrupo([...caixasDoGrupo, { id: newId, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
    };

    const handleRemoveCaixa = (idToRemove) => {
        if (caixasDoGrupo.length <= 1) { return; }
        setCaixasDoGrupo(prevCaixas => prevCaixas.filter(caixa => caixa.id !== idToRemove));
    };

    // *** FUNÇÃO MODIFICADA ***
    const handleOpenConfirmation = () => {
        if (caixasDoGrupo.some(caixa => !caixa.name || !caixa.numeroMaquina)) {
            setAlertMessage('Por favor, preencha o nome e o número da máquina para todos os caixas.');
            return;
        }
        if (totalDinheiroFisico === '') {
            setAlertMessage('Por favor, preencha o "Total de Dinheiro Físico Contado (Grupo)".');
            return;
        }
        setDataToConfirm({
            totalDiferenca: finalDiferenca,
            cashierNames: caixasDoGrupo.map(c => c.name),
            protocol: null, // Será preenchido no sucesso
        });
        setModalState('confirm'); // Garante que o modal abra na confirmação
        setModalVisible(true);
    };

    // *** NOVAS FUNÇÕES ***
    const resetForm = () => {
        setCaixasDoGrupo([{ id: 1, cpf: '', name: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
        setValorTroco('');
        setTotalDinheiroFisico('');
        setFinalDiferenca(0);
        setProtocol(null);
        setDataToConfirm(null);
        setIsSaving(false);
    };

    const handleRegisterNew = () => {
        setModalVisible(false);
        resetForm();
    };

    const handleBackToMenu = () => {
        navigate('/financial-selection'); // Navega para o menu principal
    };


    // *** FUNÇÃO MODIFICADA ***
    // Lógica de salvamento alterada para usar o modalState
    const handleFinalSave = async () => {
        setIsSaving(true);
        setModalState('saving'); // Mostra o spinner no modal
        
        try {
            const eventName = localStorage.getItem('activeEvent');
            const operatorName = localStorage.getItem('loggedInUserName');

            // ... (Toda a lógica de cálculo (linhas 408-485) permanece EXATAMENTE A MESMA)
            // 1. Calcula acerto esperado SEM troco para cada caixa
            const caixasComAcerto = caixasDoGrupo.map(caixa => {
                const numValorTotalVenda = parseCurrency(caixa.valorTotalVenda);
                const numValorEstorno = parseCurrency(caixa.valorEstorno);
                const numCredito = parseCurrency(caixa.credito);
                const numDebito = parseCurrency(caixa.debito);
                const numPix = parseCurrency(caixa.pix);
                const numCashless = parseCurrency(caixa.cashless);
                // Acerto esperado SEM troco (baseado apenas nas vendas e pagamentos daquele caixa)
                const acertoEsperadoSemTroco = (numValorTotalVenda - (numCredito + numDebito + numPix + numCashless) - (caixa.temEstorno ? numValorEstorno : 0));
                return { ...caixa, acertoEsperadoSemTroco };
            });

            // 2. Calcula a Diferença GERAL do GRUPO (já calculada corretamente no useEffect 'finalDiferenca')
            // finalDiferenca = (Dinheiro Total Contado) - (Soma de todos acertoEsperadoSemTroco + Troco Inicial)

            // 3. Mapeia os caixas para o formato final de salvamento, distribuindo a diferença
            const caixasParaSalvar = caixasComAcerto.map((caixa, index) => {

                // --- INÍCIO DA LÓGICA DE DISTRIBUIÇÃO ---
                let dinheiroFisicoParaSalvar;
                let diferencaParaSalvar;
                const acertoEsperadoSemTroco_Num = Math.round(caixa.acertoEsperadoSemTroco * 100) / 100;

                if (index === 0) {
                    // CAIXA 1: Recebe o Troco Inicial e a Diferença do Grupo
                    const acertoEsperadoComTroco_Caixa1 = acertoEsperadoSemTroco_Num + parseCurrency(valorTroco);
                    // O dinheiro físico dele é o esperado (com troco) + a diferença do grupo
                    const dinheiroFisicoCalculado = acertoEsperadoComTroco_Caixa1 + finalDiferenca;
                    dinheiroFisicoParaSalvar = Math.max(0, Math.round(dinheiroFisicoCalculado * 100) / 100); // Garante >= 0 //
                    // A diferença dele é a diferença GERAL do grupo
                    diferencaParaSalvar = Math.round(finalDiferenca * 100) / 100;

                    console.log(`[FixedCashierSave][Caixa 1] Acerto S/ Troco: ${acertoEsperadoSemTroco_Num}, Troco: ${parseCurrency(valorTroco)}, Acerto C/ Troco: ${acertoEsperadoComTroco_Caixa1}, Dif Grupo: ${finalDiferenca}, Dinheiro Calc: ${dinheiroFisicoCalculado}, Dinheiro Salvo: ${dinheiroFisicoParaSalvar}, Diferença Salva: ${diferencaParaSalvar}`);

                } else {
                    // DEMAIS CAIXAS: Não recebem troco inicial nem diferença do grupo (idealmente)
                    // O dinheiro físico deles é apenas o acerto esperado (sem troco)
                    const dinheiroFisicoCalculado = acertoEsperadoSemTroco_Num;
                    dinheiroFisicoParaSalvar = Math.max(0, Math.round(dinheiroFisicoCalculado * 100) / 100); // Garante >= 0 //
                    // A diferença deles é o dinheiro salvo menos o acerto esperado (deve ser 0, a menos que Math.max tenha atuado)
                    diferencaParaSalvar = dinheiroFisicoParaSalvar - acertoEsperadoSemTroco_Num;
                    diferencaParaSalvar = Math.round(diferencaParaSalvar * 100) / 100; // Arredonda //

                     console.log(`[FixedCashierSave][Caixa ${index + 1}] Acerto S/ Troco: ${acertoEsperadoSemTroco_Num}, Dinheiro Calc: ${dinheiroFisicoCalculado}, Dinheiro Salvo: ${dinheiroFisicoParaSalvar}, Diferença Salva: ${diferencaParaSalvar}`);
                }
                // --- FIM DA LÓGICA DE DISTRIBUIÇÃO ---

                return {
                    protocol: caixa.protocol, // Preserva protocolo individual na edição //
                    cpf: caixa.cpf,
                    cashierName: caixa.name,
                    numeroMaquina: caixa.numeroMaquina,
                    temEstorno: caixa.temEstorno,
                    valorEstorno: parseCurrency(caixa.valorEstorno),
                    valorTotalVenda: parseCurrency(caixa.valorTotalVenda),
                    credito: parseCurrency(caixa.credito),
                    debito: parseCurrency(caixa.debito),
                    pix: parseCurrency(caixa.pix),
                    cashless: parseCurrency(caixa.cashless),
                    dinheiroFisico: dinheiroFisicoParaSalvar, // Valor distribuído e >= 0 //
                    // Mantém 'valorAcerto' como o esperado SEM troco para consistência individual
                    valorAcerto: acertoEsperadoSemTroco_Num,
                    diferenca: diferencaParaSalvar, // Diferença calculada conforme a distribuição //
                };
            });

            // Objeto principal a ser salvo
            const closingData = {
                type: 'fixed_cashier',
                eventName, operatorName,
                valorTroco: parseCurrency(valorTroco), // Troco inicial do grupo //
                totalDinheiroFisicoGrupo: parseCurrency(totalDinheiroFisico), // Total contado digitado //
                diferencaCaixa: finalDiferenca, // Diferença GERAL do grupo //
                caixas: caixasParaSalvar, // Array com caixas individuais e valores/diferenças distribuídos //
                protocol: protocol,
                timestamp: closingToEdit?.timestamp
            };

            console.log("[FixedCashierSave] Objeto final enviado para saveFixedCashierClosing:", JSON.stringify(closingData, null, 2));

            const response = await saveFixedCashierClosing(closingData);
            const savedData = response.data;

            // *** LÓGICA DE SUCESSO MODIFICADA ***
            // Atualiza os dados para o modal de sucesso (com o protocolo)
            setDataToConfirm(savedData);
            // Muda para a tela de sucesso
            setModalState('success');
            // Remove o alerta e a navegação automática
            // setAlertMessage(`Fechamento de grupo salvo LOCALMENTE com sucesso!\nProtocolo: ${savedData.protocol}`);
            // setTimeout(() => navigate('/closing-history'), 2000);

        } catch (error) {
            console.error("Erro ao salvar fechamento local:", error);
            setAlertMessage('Ocorreu um erro ao salvar o fechamento de grupo localmente.');
            setModalVisible(false); // Fecha o modal em caso de erro
        } finally {
            setIsSaving(false);
            // Não fecha mais o modal aqui (setModalVisible(false))
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
        const nextRef = formRefs.current[nextField];
        if (nextRef && nextRef.current) {
          nextRef.current.focus();
        } else if (nextField === 'saveButton') {
           // Se o próximo for o botão salvar, tenta abrir a confirmação
           handleOpenConfirmation();
        } else if (nextField === 'addCaixaButton' && !closingToEdit) {
            // Se o próximo for adicionar caixa (e não estiver editando)
            handleAddCaixa();
            // Tenta focar no CPF do novo caixa (precisa de um pequeno delay)
            setTimeout(() => {
                const nextCaixaId = caixasDoGrupo.length + 1; // ID aqui é baseado no length ANTES de adicionar
                const nextCpfRef = formRefs.current[`cpf_${nextCaixaId}`];
                if (nextCpfRef && nextCpfRef.current) {
                    nextCpfRef.current.focus();
                }
            }, 100);
        }
      }
    };

    useEffect(() => {
      // ... (código do useEffect [formRefs] sem alteração)
        // Inicializa ou atualiza refs
        formRefs.current.valorTroco = formRefs.current.valorTroco || React.createRef();
        formRefs.current.totalDinheiroFisico = formRefs.current.totalDinheiroFisico || React.createRef();
        formRefs.current.addCaixaButton = formRefs.current.addCaixaButton || React.createRef();
        formRefs.current.saveButton = formRefs.current.saveButton || React.createRef();

        caixasDoGrupo.forEach(caixa => {
            formRefs.current[`cpf_${caixa.id}`] = formRefs.current[`cpf_${caixa.id}`] || React.createRef();
            formRefs.current[`numeroMaquina_${caixa.id}`] = formRefs.current[`numeroMaquina_${caixa.id}`] || React.createRef();
            formRefs.current[`valorTotalVenda_${caixa.id}`] = formRefs.current[`valorTotalVenda_${caixa.id}`] || React.createRef();
            formRefs.current[`credito_${caixa.id}`] = formRefs.current[`credito_${caixa.id}`] || React.createRef();
            formRefs.current[`debito_${caixa.id}`] = formRefs.current[`debito_${caixa.id}`] || React.createRef();
            formRefs.current[`pix_${caixa.id}`] = formRefs.current[`pix_${caixa.id}`] || React.createRef();
            formRefs.current[`cashless_${caixa.id}`] = formRefs.current[`cashless_${caixa.id}`] || React.createRef();
            formRefs.current[`valorEstorno_${caixa.id}`] = formRefs.current[`valorEstorno_${caixa.id}`] || React.createRef();
        });
    }, [caixasDoGrupo]);


    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '1000px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{closingToEdit ? 'Editar Fechamento de Caixa Fixo' : 'Fechamento Caixa Fixo (Grupo)'}</h1>

                {/* ... (JSX do map caixasDoGrupo (CaixaFormItem) sem alteração) ... */}
                {caixasDoGrupo.map((caixa, index) => {
                    // Passa isEditing para CaixaFormItem
                    return (
                        <CaixaFormItem
                            key={caixa.id}
                            item={caixa}
                            index={index}
                            handleInputChange={handleInputChange}
                            handleSelectCashier={handleSelectCashier}
                            personnelList={personnelList}
                            addNewPersonnel={addNewPersonnel}
                            setAlertMessage={setAlertMessage}
                            handleKeyDown={handleKeyDown}
                            formRefs={formRefs}
                            isEditing={!!closingToEdit} // Passa corretamente se está editando //
                            onRemoveCaixa={handleRemoveCaixa}
                            showRemoveButton={caixasDoGrupo.length > 1 && !closingToEdit}
                            valorTroco={valorTroco}
                            setValorTroco={setValorTroco}
                        />
                    );
                })}


                {/* ... (JSX do footer-actions (botões e resultados) sem alteração) ... */}
                <div className="footer-actions">
                     {/* Botão Adicionar Caixa */}
                     <button
                         ref={formRefs.current.addCaixaButton}
                         onKeyDown={(e) => handleKeyDown(e, 'totalDinheiroFisico')}
                         className="add-button"
                         onClick={handleAddCaixa}
                         disabled={!!closingToEdit}
                     >
                         Adicionar Novo Caixa
                     </button>

                    <div className="results-container" style={{borderTop: '2px solid #007bff', paddingTop: '20px'}}>
                         {/* Input Dinheiro Físico Total */}
                         <div className="input-group" style={{maxWidth: '300px', margin: '0 auto 20px auto'}}>
                            <label style={{fontSize: '1.1rem', fontWeight: 'bold'}}>Total de Dinheiro Físico Contado (Grupo)</label>
                            <input
                                ref={formRefs.current.totalDinheiroFisico}
                                onKeyDown={(e) => handleKeyDown(e, 'saveButton')}
                                value={formatCurrencyInput(totalDinheiroFisico)}
                                onChange={(e) => setTotalDinheiroFisico(String(e.target.value).replace(/\D/g, ''))}
                                style={{textAlign: 'center', fontSize: '1.2rem'}}
                                placeholder="R$ 0,00"
                                inputMode="numeric"
                            />
                        </div>

                        {/* Exibição da Diferença Final */}
                        <p className="total-text">Diferença Final (Sobra/Falta):
                            <strong style={{ color: getDiferencaColor(finalDiferenca), marginLeft: '10px' }}>
                                {formatCurrencyResult(finalDiferenca)}
                            </strong>
                        </p>
                        {/* Botão Salvar */}
                        <button
                            ref={formRefs.current.saveButton}
                            className="login-button"
                            onClick={handleOpenConfirmation}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Salvando...' : 'SALVAR GRUPO'}
                        </button>
                    </div>
                </div>
            </div>

            {/* *** TODO O BLOCO DO MODAL FOI SUBSTITUÍDO *** */}
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">

                        {/* ESTADO DE CONFIRMAÇÃO (O que já existia) */}
                        {modalState === 'confirm' && (
                            <>
                                <h2>Confirmar Fechamento de Grupo</h2>
                                {dataToConfirm && (
                                    <>
                                        <p><strong>Caixas do Grupo:</strong></p>
                                        <ul className="cashier-list">
                                            {dataToConfirm.cashierNames.map(name => <li key={name}>{name}</li>)}
                                        </ul>
                                        <hr/>
                                        <p className="total-text">Diferença (Sobra/Falta):
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
                            </>
                        )}
                        
                        {/* (NOVO) ESTADO 'SALVANDO' */}
                        {modalState === 'saving' && (
                            <>
                                <div className="spinner"></div>
                                <p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p>
                            </>
                        )}

                        {/* (NOVO) ESTADO 'SUCESSO' */}
                        {modalState === 'success' && (
                            <>
                                <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                                <h2>Fechamento Salvo com Sucesso!</h2>
                                {/* 'dataToConfirm' foi atualizado no 'handleFinalSave' com a resposta do servidor */}
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
        </div>
    );
}

export default FixedCashierClosingPage;