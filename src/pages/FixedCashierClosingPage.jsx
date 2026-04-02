    // src/pages/FixedCashierClosingPage.jsx
    // (VERSÃO FINAL: MEIA FOLHA A4 + DADOS BANCÁRIOS PIX PRESERVADOS DO MONGODB)

    import React, { useState, useEffect, useRef } from 'react';
    import { useNavigate, useLocation } from 'react-router-dom';
    import { saveFixedCashierClosing } from '../services/apiService';
    import { attemptBackgroundSyncNewPersonnel } from '../services/syncService';
    import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
    import AlertModal from '../components/AlertModal.jsx';
    import LoadingSpinner from '../components/LoadingSpinner';
    import { APP_VERSION } from '../config'; 
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
    const CaixaFormItem = ({
        item, index, handleInputChange, handleSelectCashier, personnelList,
        handleKeyDown, formRefs, isEditing, onRemoveCaixa, showRemoveButton,
        valorTroco, setValorTroco,
        addNewPersonnel, setAlertMessage
    }) => {
        const [searchInput, setSearchInput] = useState(item.name || item.cpf || '');
        const [filteredPersonnel, setFilteredPersonnel] = useState([]);
        
        // Atualizado para receber os dados do PIX
        const [selectedCashier, setSelectedCashier] = useState(item.name ? { cpf: item.cpf, name: item.name, pix: item.chavePix, tipo_pix: item.tipoPix } : null);

        const [showRegisterButton, setShowRegisterButton] = useState(false);
        const [registerModalVisible, setRegisterModalVisible] = useState(false);
        const [newCashierName, setNewCashierName] = useState('');

        useEffect(() => {
            if (isEditing && item.name) {
                setSearchInput(item.name);
                setSelectedCashier({ name: item.name, cpf: item.cpf, pix: item.chavePix, tipo_pix: item.tipoPix });
            }
        }, [item, isEditing]);

        // Busca Inteligente (Ignora acentos e CPFs vazios)
        useEffect(() => {
            const rawQuery = searchInput.trim();
            if (rawQuery.length > 0 && !selectedCashier) {
                const normalizedQuery = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const queryDigitsOnly = rawQuery.replace(/\D/g, '');

                const results = personnelList.filter(p => {
                    const personName = (p.name || p.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const personCpf = (p.cpf || '').replace(/\D/g, '');

                    const matchName = personName.includes(normalizedQuery);
                    const matchCpf = queryDigitsOnly.length > 0 && personCpf.includes(queryDigitsOnly);

                    return matchName || matchCpf;
                });
                
                setFilteredPersonnel(results);
                setShowRegisterButton(queryDigitsOnly.length === 11 && results.length === 0);
            } else {
                setFilteredPersonnel([]);
                setShowRegisterButton(false);
            }
        }, [searchInput, personnelList, selectedCashier]);

        const onSelect = (person) => {
            handleSelectCashier(item.id, person);
            setSelectedCashier(person);
            setSearchInput(person.name || person.nome);
            setFilteredPersonnel([]);
        };

        const onSearchChange = (value) => {
            setSearchInput(value);
            setSelectedCashier(null);
            handleInputChange(item.id, 'cpf', '');
            handleInputChange(item.id, 'name', '');
            handleInputChange(item.id, 'chavePix', '');
            handleInputChange(item.id, 'tipoPix', '');
            handleInputChange(item.id, 'telefone', '');
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
            const newCashier = { cpf: formatCpf(cleanCpf), name: newCashierName.trim(), nome: newCashierName.trim() };
            addNewPersonnel(newCashier);
            onSelect(newCashier);
            setRegisterModalVisible(false);
            setNewCashierName('');
            setAlertMessage(`Funcionário "${newCashier.name}" cadastrado localmente com sucesso!`);
        };

        return (
            <div className="caixa-item-container">
                <div className="caixa-header">
                    <h3 className="caixa-title">Caixa {index + 1}</h3>
                    {showRemoveButton && (
                        <button type="button" className="remove-caixa-button" onClick={() => onRemoveCaixa(item.id)}>Remover</button>
                    )}
                </div>

                {index === 0 && (
                    <div className="form-section form-row" style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <div className="switch-container">
                            <label>Recebeu Troco?</label>
                            <label className="switch">
                                <input type="checkbox" checked={valorTroco !== ''} onChange={(e) => setValorTroco(e.target.checked ? '0' : '')} disabled={isEditing} />
                                <span className="slider round"></span>
                            </label>
                        </div>
                        {valorTroco !== '' && (
                            <div className="input-group">
                                <label>Valor do Troco</label>
                                <input
                                    ref={formRefs.current.valorTroco}
                                    onKeyDown={(e) => handleKeyDown(e, `cpf_${item.id}`)}
                                    value={formatCurrencyInput(valorTroco)}
                                    onChange={(e) => setValorTroco(String(e.target.value).replace(/\D/g, ''))}
                                    inputMode="numeric"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* LINHA 1: Busca ou Crachá Preenchido */}
                <div className="form-row">
                    {!selectedCashier ? (
                        <div className="input-group" style={{ position: 'relative', width: '100%' }}>
                            <label>Buscar Funcionário (Nome ou CPF)</label>
                            <input ref={formRefs.current[`cpf_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `numeroMaquina_${item.id}`)} placeholder="Digite o nome ou CPF..." value={searchInput} onChange={(e) => onSearchChange(e.target.value)} disabled={isEditing} />
                            
                            {filteredPersonnel.length > 0 && (
                                <div className="suggestions-list">
                                    {filteredPersonnel.map((p, sugIndex) => (
                                        <div key={`fixo-${item.id}-${sugIndex}`} className="suggestion-item" onClick={() => onSelect(p)}>
                                            {p.name || p.nome} - {p.cpf}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showRegisterButton && (
                                <button type="button" className="login-button" style={{marginTop: '10px', backgroundColor: '#5bc0de', width: '100%'}} onClick={() => setRegisterModalVisible(true)}>
                                    Cadastrar novo funcionário?
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="input-group" style={{ width: '100%' }}>
                            <label>Funcionário Selecionado</label>
                            {/* CRACHÁ AZUL TRAVADO 100% LARGURA */}
                            <div style={{
                                backgroundColor: '#e8f4fd', border: '1px solid #b6d4fe', 
                                borderRadius: '8px', padding: '12px 15px', color: '#084298',
                                display: 'flex', flexDirection: 'column', gap: '8px',
                                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.05)'
                            }}>
                                {/* CABEÇALHO DO CRACHÁ (Nome + Botão Sutil) */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #b6d4fe', paddingBottom: '6px' }}>
                                    <span style={{ fontWeight: '900', fontSize: '1.15rem', textTransform: 'uppercase' }}>
                                        {selectedCashier.name || selectedCashier.nome}
                                    </span>
                                    
                                    {!isEditing && (
                                        <button 
                                            type="button" 
                                            onClick={() => { 
                                                setSelectedCashier(null); 
                                                setSearchInput(''); 
                                                handleInputChange(item.id, 'cpf', '');
                                                handleInputChange(item.id, 'name', '');
                                                handleInputChange(item.id, 'chavePix', '');
                                                handleInputChange(item.id, 'tipoPix', '');
                                                setTimeout(() => formRefs.current[`cpf_${item.id}`]?.focus(), 100); 
                                            }}
                                            style={{
                                                background: 'transparent', color: '#dc3545', border: '1px solid #dc3545',
                                                borderRadius: '6px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 'bold',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dc3545'; e.currentTarget.style.color = '#fff'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#dc3545'; }}
                                        >
                                            🔄 Trocar
                                        </button>
                                    )}
                                </div>
                                
                                {/* DADOS DO CRACHÁ */}
                                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '1.05rem' }}>
                                        <strong>CPF:</strong> {selectedCashier.cpf}
                                    </div>
                                    {selectedCashier.pix ? (
                                        <div style={{ fontSize: '1.05rem' }}>
                                            <strong>PIX:</strong> {selectedCashier.pix} ({selectedCashier.tipo_pix})
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.95rem', color: '#b02a37', fontStyle: 'italic' }}>
                                            ⚠️ Sem PIX Cadastrado
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* LINHA 2: Campo Isolado */}
                <div className="form-row" style={{ marginTop: '10px' }}>
                    <div className="input-group">
                        <label>Nº da Máquina</label>
                        <input ref={formRefs.current[`numeroMaquina_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `valorTotalVenda_${item.id}`)} value={item.numeroMaquina} onChange={(e) => handleInputChange(item.id, 'numeroMaquina', e.target.value.toUpperCase())} placeholder="Ex: C1"/>
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
                        <div className="input-group"><label>Débito</label><input ref={formRefs.current[`debito_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `pix_dinheiro_${item.id}`)} value={formatCurrencyInput(item.debito)} onChange={(e) => cleanAndSet('debito', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.current[`pix_dinheiro_${item.id}`]} onKeyDown={(e) => handleKeyDown(e, `cashless_${item.id}`)} value={formatCurrencyInput(item.pix)} onChange={(e) => cleanAndSet('pix', e.target.value)} inputMode="numeric" placeholder="R$ 0,00" /></div>
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
                            <div className="input-group"><label>CPF</label><input type="text" value={formatCpf(searchInput)} readOnly /></div>
                            <div className="input-group"><label>Nome do Funcionário</label><input type="text" value={newCashierName} onChange={(e) => setNewCashierName(e.target.value)} placeholder="Digite o nome completo" /></div>
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

    // --- COMPONENTE PRINCIPAL ---
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
        // INICIALIZAÇÃO ATUALIZADA: Contempla os campos de PIX e telefone
        const [caixasDoGrupo, setCaixasDoGrupo] = useState([{ id: 1, cpf: '', name: '', chavePix: '', tipoPix: '', telefone: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
        const [alertMessage, setAlertMessage] = useState('');
        const [finalDiferenca, setFinalDiferenca] = useState(0);
        const [protocol, setProtocol] = useState(null);
        const [modalState, setModalState] = useState('confirm');

        const formRefs = useRef({});

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

        useEffect(() => {
            if (closingToEdit) {
                setProtocol(closingToEdit.protocol);
                setValorTroco(formatForInput(closingToEdit.valorTroco));

                if (closingToEdit.totalDinheiroFisicoGrupo !== undefined && closingToEdit.totalDinheiroFisicoGrupo !== null) {
                    setTotalDinheiroFisico(formatForInput(closingToEdit.totalDinheiroFisicoGrupo));
                } else {
                    let totalDinheiroFisicoSalvo = 0;
                    closingToEdit.caixas.forEach((caixa) => {
                        totalDinheiroFisicoSalvo += (caixa.dinheiroFisico || 0);
                    });
                    setTotalDinheiroFisico(formatForInput(totalDinheiroFisicoSalvo));
                }

                const caixasEdit = closingToEdit.caixas.map((caixa, index) => {
                    return {
                        id: index + 1,
                        cpf: caixa.cpf,
                        name: caixa.cashierName,
                        chavePix: caixa.chavePix || '',
                        tipoPix: caixa.tipoPix || '',
                        telefone: caixa.telefone || '',
                        numeroMaquina: caixa.numeroMaquina,
                        temEstorno: caixa.temEstorno,
                        valorEstorno: formatForInput(caixa.valorEstorno),
                        valorTotalVenda: formatForInput(caixa.valorTotalVenda),
                        credito: formatForInput(caixa.credito),
                        debito: formatForInput(caixa.debito),
                        pix: formatForInput(caixa.pix),
                        cashless: formatForInput(caixa.cashless),
                        protocol: caixa.protocol
                    };
                });
                setCaixasDoGrupo(caixasEdit);
            }
        }, [closingToEdit]);

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

        const handleInputChange = (caixaId, field, value) => {
            setCaixasDoGrupo(prev => prev.map(caixa => caixa.id === caixaId ? { ...caixa, [field]: value } : caixa));
        };

        // ATUALIZADO: Preenche CPF, Nome, Chave PIX, Tipo PIX e Telefone ao selecionar
        const handleSelectCashier = (caixaId, cashier) => {
            handleInputChange(caixaId, 'cpf', cashier.cpf);
            handleInputChange(caixaId, 'name', cashier.name || cashier.nome);
            handleInputChange(caixaId, 'chavePix', cashier.pix || '');
            handleInputChange(caixaId, 'tipoPix', cashier.tipo_pix || '');
            handleInputChange(caixaId, 'telefone', cashier.telefone || '');
        };

        const handleAddCaixa = () => {
            const newId = caixasDoGrupo.length > 0 ? Math.max(...caixasDoGrupo.map(c => c.id)) + 1 : 1;
            setCaixasDoGrupo([...caixasDoGrupo, { id: newId, cpf: '', name: '', chavePix: '', tipoPix: '', telefone: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
        };

        const handleRemoveCaixa = (idToRemove) => {
            if (caixasDoGrupo.length <= 1) { return; }
            setCaixasDoGrupo(prevCaixas => prevCaixas.filter(caixa => caixa.id !== idToRemove));
        };

        const handlePrint = (type) => {
        if (!dataToConfirm || !dataToConfirm.caixas) return;
        const logoSrc = '/logo.png'; 
        const printTime = new Date().toLocaleString('pt-BR'); 

        let totalVendaGrupo = 0;
        let totalCredito = 0;
        let totalDebito = 0;
        let totalPix = 0;
        let totalCashless = 0;
        let totalEstorno = 0;

        const linhasTabelaHTML = dataToConfirm.caixas.map(caixa => {
            const vVenda = caixa.valorTotalVenda || 0;
            const vCred = caixa.credito || 0;
            const vDeb = caixa.debito || 0;
            const vPix = caixa.pix || 0;
            const vCash = caixa.cashless || 0;
            const vEst = caixa.valorEstorno || 0;

            totalVendaGrupo += vVenda;
            totalCredito += vCred;
            totalDebito += vDeb;
            totalPix += vPix;
            totalCashless += vCash;
            totalEstorno += vEst;

            const nomeOperador = caixa.name || caixa.cashierName || 'Operador';
            const firstName = nomeOperador.split(' ')[0];
            const secondName = nomeOperador.split(' ')[1] || '';

            return `
                <tr>
                    <td style="text-align:left;">${firstName} ${secondName}</td>
                    <td>${caixa.numeroMaquina}</td>
                    <td>${formatCurrencyResult(vCred)}</td>
                    <td>${formatCurrencyResult(vDeb)}</td>
                    <td>${formatCurrencyResult(vPix)}</td>
                    <td>${formatCurrencyResult(vCash)}</td>
                    ${totalEstorno > 0 ? `<td style="color:#d32f2f">-${formatCurrencyResult(vEst)}</td>` : ''}
                </tr>
            `;
        }).join('');

        const assinaturasHTML = dataToConfirm.caixas.map(caixa => {
            const nomeOperador = caixa.name || caixa.cashierName || 'Operador';
            const firstName = nomeOperador.split(' ')[0];
            return `
                <div class="sig-block" style="min-width: 100px; flex: 1; text-align: center; margin-bottom: 5px;">
                    <div class="sig-line" style="border-top: 1px solid #000; padding-top: 2px; font-size: 9px; font-weight: bold; text-transform: uppercase; white-space: nowrap;">
                        ${firstName}
                    </div>
                    <div style="font-size:8px; font-weight:bold; text-transform:uppercase; margin-top:2px;">Operador</div>
                </div>
            `;
        }).join('');

        const totalDigitais = totalCredito + totalDebito + totalPix + totalCashless;
        const dinheiroEsperado = (totalVendaGrupo - totalDigitais - totalEstorno) + (dataToConfirm.valorTroco || 0);
        const diffColor = dataToConfirm.diferencaCaixa >= 0 ? '#000' : 'red';

        if (type === 'a4') {
            const content = `
                <html>
                <head>
                    <title>A4 - Grupo ${dataToConfirm.protocol}</title>
                    <style>
                        @page { size: A4 portrait; margin: 0; }
                        @media print {
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                        
                        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10px; width: 210mm; height: 140mm; margin: 0; padding: 10px 25px; box-sizing: border-box; background: #fff; position: relative; }
                        
                        .container { width: 100%; height: 100%; border: 2px solid #000; padding: 8px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; z-index: 1; overflow: hidden; }
                        
                        .watermark {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            font-size: 160px;
                            font-weight: 900;
                            color: #e6e6e6; 
                            z-index: 0; 
                            pointer-events: none;
                            letter-spacing: 10px;
                            user-select: none;
                        }

                        .header, .info-strip, .summary-grid, .details-table, .footer-sigs, .system-footer, .detalhe-title {
                            position: relative;
                            z-index: 10;
                        }

                        .header { display: flex; justify-content: center; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; min-height: 60px; }
                        .logo-wrapper { position: absolute; left: 0; top: -25px; }
                        .logo-img { max-height: 115px; max-width: 250px; width: auto; object-fit: contain; } 
                        .header-right { position: absolute; right: 0; top: 0; text-align: right; font-size: 10px; display:flex; flex-direction:column; align-items: flex-end; }
                        .header-center { text-align: center; padding: 0 10px; }
                        .title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                        .protocol-box { border: 1px solid #000; padding: 2px 6px; font-weight: bold; margin-bottom: 2px; display: inline-block; font-size: 12px; background: #fff; }
                        
                        .info-strip { background-color: rgba(245, 245, 245, 0.9); padding: 4px; border: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 8px; }
                        
                        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
                        .summary-box { border: 1px solid #000; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.85); }
                        .summary-title { background: rgba(51, 51, 51, 0.9); color: #fff; font-weight: bold; padding: 4px; text-align: center; text-transform: uppercase; font-size: 11px; }
                        .summary-content { padding: 6px; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 3px 0; font-size: 11px; }
                        .big-row { font-size: 13px; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }

                        .detalhe-title { font-weight:bold; margin-bottom:2px; text-transform:uppercase; font-size:10px; background: rgba(255,255,255,0.7); display: inline-block; padding: 2px; }

                        .details-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; background: rgba(255,255,255,0.85); }
                        .details-table th { background: rgba(224, 224, 224, 0.9); border: 1px solid #999; padding: 3px; text-transform: uppercase; font-weight:bold; }
                        .details-table td { border: 1px solid #ccc; padding: 3px; text-align: center; }

                        .footer-sigs { margin-top: auto; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding-top: 15px; margin-bottom: 5px; }
                        
                        .system-footer { font-size: 8px; color: #555; text-align: center; width: 100%; border-top: 1px solid #eee; padding-top: 2px; background: rgba(255,255,255,0.7); }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="watermark">CXF</div>

                        <div class="header">
                            <div class="logo-wrapper"><img src="${logoSrc}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/></div>
                            <div class="header-center">
                                <div class="title">Fechamento de Caixa Fixo</div>
                                <div style="font-size: 12px; font-weight: 900; margin-top:4px; background: #000; color: #fff; padding: 3px 12px; border-radius: 4px; display: inline-block;">
                                    CONSOLIDADO DE GRUPO
                                </div>
                            </div>
                            <div class="header-right">
                                <div class="protocol-box">PROT: ${dataToConfirm.protocol}</div>
                                <svg id="barcodeA4"></svg>
                            </div>
                        </div>

                        <div class="info-strip">
                            <div><strong>Evento:</strong> ${dataToConfirm.eventName}</div>
                            <div><strong>Responsável:</strong> ${dataToConfirm.operatorName}</div>
                            <div><strong>Data:</strong> ${new Date(dataToConfirm.timestamp || Date.now()).toLocaleDateString('pt-BR')}</div>
                        </div>

                        <div class="summary-grid">
                            <div class="summary-box">
                                <div class="summary-title">Totais do Grupo</div>
                                <div class="summary-content">
                                    <div class="row"><span>Venda Bruta:</span> <strong>${formatCurrencyResult(totalVendaGrupo)}</strong></div>
                                    <div class="row"><span>(-) Digitais:</span> <span>${formatCurrencyResult(totalDigitais)}</span></div>
                                    <div class="row"><span>(-) Estornos:</span> <span>${formatCurrencyResult(totalEstorno)}</span></div>
                                    <div class="row" style="color: blue;"><span>(+) Fundo Troco:</span> <strong>${formatCurrencyResult(dataToConfirm.valorTroco || 0)}</strong></div>
                                </div>
                            </div>
                            <div class="summary-box">
                                <div class="summary-title">Conferência</div>
                                <div class="summary-content">
                                    <div class="row"><span>Dinheiro Esperado:</span> <span>${formatCurrencyResult(dinheiroEsperado)}</span></div>
                                    <div class="row"><span>Dinheiro Contado:</span> <strong>${formatCurrencyResult(dataToConfirm.totalDinheiroFisicoGrupo)}</strong></div>
                                    <div class="row big-row">
                                        <span>DIFERENÇA:</span> 
                                        <span style="color: ${diffColor};">${formatCurrencyResult(dataToConfirm.diferencaCaixa)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="detalhe-title">Detalhamento por Freelancer</div>
                        <table class="details-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Maq.</th>
                                    <th>Crédito</th>
                                    <th>Débito</th>
                                    <th>PIX</th>
                                    <th>Cashless</th>
                                    ${totalEstorno > 0 ? '<th>Estorno</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${linhasTabelaHTML}
                            </tbody>
                        </table>

                        <div class="footer-sigs">
                            ${assinaturasHTML}
                            <div class="sig-block" style="min-width: 100px; flex: 1; text-align: center; margin-bottom: 5px;">
                                <div class="sig-line" style="border-top: 1px solid #000; padding-top: 2px; font-size: 9px; font-weight: bold; text-transform: uppercase; white-space: nowrap;">
                                    Assinatura do Conferente
                                </div>
                                <div style="font-size:8px; font-weight:bold; text-transform:uppercase; margin-top:2px;">CONFERÊNCIA</div>
                            </div>
                        </div>

                        <div class="system-footer">Sis.Versão: ${APP_VERSION || '1.0'} | Impresso em: ${printTime}</div>
                    </div>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script>
                        // Garante que o script carregue e então imprima
                        setTimeout(() => {
                            JsBarcode("#barcodeA4", "${dataToConfirm.protocol}", {format: "CODE128", displayValue: false, height: 25, width: 1, margin: 0});
                            window.print();
                        }, 500);
                    </script>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write(content);
            printWindow.document.close();
        }
    };

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
                caixas: caixasDoGrupo, // Permite exibir as chaves PIX na confirmação
                protocol: null, 
            });
            setModalState('confirm'); 
            setModalVisible(true);
        };

        // FUNÇÕES RESTAURADAS NO ESCOPO CORRETO
        const resetForm = () => {
            setCaixasDoGrupo([{ id: 1, cpf: '', name: '', chavePix: '', tipoPix: '', telefone: '', numeroMaquina: '', temEstorno: false, valorEstorno: '', valorTotalVenda: '', credito: '', debito: '', pix: '', cashless: '' }]);
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
            navigate('/financial-selection'); 
        };

        const handleFinalSave = async () => {
            setIsSaving(true);
            setModalState('saving');
            
            try {
                const eventName = localStorage.getItem('activeEvent');
                const operatorName = localStorage.getItem('loggedInUserName');

                const caixasComAcerto = caixasDoGrupo.map(caixa => {
                    const numValorTotalVenda = parseCurrency(caixa.valorTotalVenda);
                    const numValorEstorno = parseCurrency(caixa.valorEstorno);
                    const numCredito = parseCurrency(caixa.credito);
                    const numDebito = parseCurrency(caixa.debito);
                    const numPix = parseCurrency(caixa.pix);
                    const numCashless = parseCurrency(caixa.cashless);
                    const acertoEsperadoSemTroco = (numValorTotalVenda - (numCredito + numDebito + numPix + numCashless) - (caixa.temEstorno ? numValorEstorno : 0));
                    return { ...caixa, acertoEsperadoSemTroco };
                });

                const caixasParaSalvar = caixasComAcerto.map((caixa, index) => {
                    let dinheiroFisicoParaSalvar;
                    let diferencaParaSalvar;
                    const acertoEsperadoSemTroco_Num = Math.round(caixa.acertoEsperadoSemTroco * 100) / 100;

                    if (index === 0) {
                        const acertoEsperadoComTroco_Caixa1 = acertoEsperadoSemTroco_Num + parseCurrency(valorTroco);
                        const dinheiroFisicoCalculado = acertoEsperadoComTroco_Caixa1 + finalDiferenca;
                        dinheiroFisicoParaSalvar = Math.max(0, Math.round(dinheiroFisicoCalculado * 100) / 100); 
                        diferencaParaSalvar = Math.round(finalDiferenca * 100) / 100;
                    } else {
                        const dinheiroFisicoCalculado = acertoEsperadoSemTroco_Num;
                        dinheiroFisicoParaSalvar = Math.max(0, Math.round(dinheiroFisicoCalculado * 100) / 100); 
                        diferencaParaSalvar = dinheiroFisicoParaSalvar - acertoEsperadoSemTroco_Num;
                        diferencaParaSalvar = Math.round(diferencaParaSalvar * 100) / 100; 
                    }

                    // ATUALIZADO: Vinculação dos dados do MongoDB com o que vai pra nuvem
                    return {
                        protocol: caixa.protocol, 
                        cpf: caixa.cpf,
                        cashierName: caixa.name,
                        chavePix: caixa.chavePix || '',
                        tipoPix: caixa.tipoPix || '',
                        telefone: caixa.telefone || '',
                        numeroMaquina: caixa.numeroMaquina,
                        temEstorno: caixa.temEstorno,
                        valorEstorno: parseCurrency(caixa.valorEstorno),
                        valorTotalVenda: parseCurrency(caixa.valorTotalVenda),
                        credito: parseCurrency(caixa.credito),
                        debito: parseCurrency(caixa.debito),
                        pix: parseCurrency(caixa.pix),
                        cashless: parseCurrency(caixa.cashless),
                        dinheiroFisico: dinheiroFisicoParaSalvar, 
                        valorAcerto: acertoEsperadoSemTroco_Num,
                        diferenca: diferencaParaSalvar, 
                    };
                });

                const closingData = {
                    type: 'fixed_cashier',
                    eventName, operatorName,
                    valorTroco: parseCurrency(valorTroco), 
                    totalDinheiroFisicoGrupo: parseCurrency(totalDinheiroFisico), 
                    diferencaCaixa: finalDiferenca, 
                    caixas: caixasParaSalvar, 
                    protocol: protocol,
                    timestamp: closingToEdit?.timestamp
                };

                const response = await saveFixedCashierClosing(closingData);
                const savedData = response.data || response; 
                
                setDataToConfirm(prev => ({ ...prev, ...savedData }));
                setModalState('success');

            } catch (error) {
                console.error("Erro ao salvar fechamento local:", error);
                setAlertMessage('Ocorreu um erro ao salvar o fechamento de grupo localmente.');
                setModalVisible(false);
            } finally {
                setIsSaving(false);
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
            } else if (nextField === 'saveButton') {
            handleOpenConfirmation();
            } else if (nextField === 'addCaixaButton' && !closingToEdit) {
                handleAddCaixa();
                setTimeout(() => {
                    const nextCaixaId = caixasDoGrupo.length + 1; 
                    const nextCpfRef = formRefs.current[`cpf_${nextCaixaId}`];
                    if (nextCpfRef && nextCpfRef.current) {
                        nextCpfRef.current.focus();
                    }
                }, 100);
            }
        }
        };

        useEffect(() => {
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
                formRefs.current[`pix_dinheiro_${caixa.id}`] = formRefs.current[`pix_dinheiro_${caixa.id}`] || React.createRef();
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

                    {caixasDoGrupo.map((caixa, index) => {
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
                                isEditing={!!closingToEdit} 
                                onRemoveCaixa={handleRemoveCaixa}
                                showRemoveButton={caixasDoGrupo.length > 1 && !closingToEdit}
                                valorTroco={valorTroco}
                                setValorTroco={setValorTroco}
                            />
                        );
                    })}

                    <div className="footer-actions">
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

                            <p className="total-text">Diferença Final (Sobra/Falta):
                                <strong style={{ color: getDiferencaColor(finalDiferenca), marginLeft: '10px' }}>
                                    {formatCurrencyResult(finalDiferenca)}
                                </strong>
                            </p>
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

                {modalVisible && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

                            {modalState === 'confirm' && (
                                <>
                                    <h2>Confirmar Fechamento de Grupo</h2>
                                    {dataToConfirm && (
                                        <>
                                            <p><strong>Caixas do Grupo:</strong></p>
                                            <ul className="cashier-list">
                                                {dataToConfirm.caixas.map(c => (
                                                    <li key={c.name} style={{ marginBottom: '8px' }}>
                                                        <strong>{c.name}</strong>
                                                        {c.chavePix && (
                                                            <span style={{ display: 'block', fontSize: '0.85em', color: '#1E63B8' }}>
                                                                PIX: {c.tipoPix} - {c.chavePix}
                                                            </span>
                                                        )}
                                                    </li>
                                                ))}
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
                            
                            {modalState === 'saving' && (
                                <><div className="spinner"></div><p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p></>
                            )}

                            {modalState === 'success' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                    <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                                    <h2>Fechamento Salvo com Sucesso!</h2>
                                    <p>Protocolo Local: <strong>{dataToConfirm?.protocol}</strong></p>
                                    
                                    <div className="modal-buttons" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%' }}>
                                        <button className="login-button" style={{ backgroundColor: '#2196F3', flex: 1, padding: '15px 0', width: '100%' }} onClick={() => handlePrint('a4')}>
                                            <span style={{ fontSize: '16px' }}>📄 Imprimir Relatório de Grupo (A4)</span>
                                        </button>

                                        <button className="modal-button primary" style={{ width: '100%' }} onClick={handleRegisterNew}>
                                            <span className="button-icon">➕</span> Registrar Novo Fechamento
                                        </button>
                                        <button className="modal-button secondary" style={{ width: '100%' }} onClick={handleBackToMenu}>
                                            <span className="button-icon">📋</span> Voltar ao Menu Principal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    export default FixedCashierClosingPage;