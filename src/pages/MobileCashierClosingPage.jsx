// src/pages/MobileCashierClosingPage.jsx
// (VERSÃO FINAL: IMPRESSÃO A4 CORRIGIDA + FUNCIONÁRIO AVULSO EXCLUSIVO)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveMobileCashierClosing } from '../services/apiService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { APP_VERSION } from '../config'; 
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
    const location = useLocation();

    const formRefs = {
        cpf: useRef(null), 
        numeroCamiseta: useRef(null), 
        valorTotal: useRef(null), 
        valorEstorno: useRef(null), 
        credito: useRef(null),
        debito: useRef(null), 
        pix: useRef(null), 
        cashless: useRef(null), 
        valorTroco: useRef(null),
        dinheiroFisico: useRef(null),
        saveButton: useRef(null),
    };

    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState('');
    
    // Dados do Caixa
    const [cashiers, setCashiers] = useState([]);
    const [selectedCashier, setSelectedCashier] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [filteredCashiers, setFilteredCashiers] = useState([]);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newCashierName, setNewCashierName] = useState('');

    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroMaquina, setNumeroMaquina] = useState('');
    const [temEstorno, setTemEstorno] = useState(false);
    
    const [valorTotal, setValorTotal] = useState('');
    const [valorEstorno, setValorEstorno] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    const [valorTroco, setValorTroco] = useState(''); 
    const [dinheiroFisico, setDinheiroFisico] = useState(''); 

    const [valorTotalAcerto, setValorTotalAcerto] = useState(0);
    const [diferenca, setDiferenca] = useState(0);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalState, setModalState] = useState('confirm');
    const [dataToConfirm, setDataToConfirm] = useState(null);

    const debouncedValorTotal = useDebounce(valorTotal, 300);
    const debouncedCredito = useDebounce(credito, 300);
    const debouncedDebito = useDebounce(debito, 300);
    const debouncedPix = useDebounce(pix, 300);
    const debouncedCashless = useDebounce(cashless, 300);
    const debouncedValorEstorno = useDebounce(valorEstorno, 300);
    const debouncedValorTroco = useDebounce(valorTroco, 300);
    const debouncedDinheiroFisico = useDebounce(dinheiroFisico, 300);

    const getNumericValue = (digits) => (parseInt(digits || '0', 10)) / 100;

    const handleCurrencyChange = (setter, rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '');
        setter(digitsOnly);
    };

    useEffect(() => {
        const timer = setTimeout(() => { setIsLoading(false); }, 500);
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setCashiers(localPersonnel);

        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            const toDigits = (value) => value ? String(Math.round(Number(value) * 100)) : '';
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            
            const cashier = { 
                cpf: closingToEdit.cpf, 
                name: closingToEdit.cashierName,
                pix: closingToEdit.chavePix || '',
                tipo_pix: closingToEdit.tipoPix || '',
                telefone: closingToEdit.telefone || ''
            };
            setSelectedCashier(cashier);
            setSearchInput(cashier.name);
            
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorTotal(toDigits(closingToEdit.valorTotalVenda));
            setValorEstorno(toDigits(closingToEdit.valorEstorno));
            setCredito(toDigits(closingToEdit.credito));
            setDebito(toDigits(closingToEdit.debito));
            setPix(toDigits(closingToEdit.pix));
            setCashless(toDigits(closingToEdit.cashless));
            setValorTroco(toDigits(closingToEdit.valorTroco));
            setDinheiroFisico(toDigits(closingToEdit.dinheiroFisico));
        }
        return () => clearTimeout(timer);
    }, [location.state]);

    // Busca Inteligente (Ignora acentos e CPFs vazios)
    useEffect(() => {
        const rawQuery = searchInput.trim();
        if (rawQuery.length > 0 && !selectedCashier) {
            const normalizedQuery = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const queryDigitsOnly = rawQuery.replace(/\D/g, '');

            const results = cashiers.filter(c => {
                const personName = (c.name || c.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const personCpf = (c.cpf || '').replace(/\D/g, '');
                const matchName = personName.includes(normalizedQuery);
                const matchCpf = queryDigitsOnly.length > 0 && personCpf.includes(queryDigitsOnly);
                return matchName || matchCpf;
            });
            
            setFilteredCashiers(results);
            setShowRegisterButton(queryDigitsOnly.length === 11 && results.length === 0);
        } else {
            setFilteredCashiers([]);
            setShowRegisterButton(false);
        }
    }, [searchInput, cashiers, selectedCashier]);

    // Cálculos
    useEffect(() => {
        const vTotal = getNumericValue(debouncedValorTotal);
        const vCred = getNumericValue(debouncedCredito);
        const vDeb = getNumericValue(debouncedDebito);
        const vPix = getNumericValue(debouncedPix);
        const vCash = getNumericValue(debouncedCashless);
        const vEstorno = getNumericValue(debouncedValorEstorno);
        const vTroco = getNumericValue(debouncedValorTroco);
        const vFisico = getNumericValue(debouncedDinheiroFisico);

        const totalDigital = vCred + vDeb + vPix + vCash;
        const acertoCalculado = (vTotal - totalDigital) + vTroco - (temEstorno ? vEstorno : 0);
        
        setValorTotalAcerto(acertoCalculado);
        const diff = vFisico - acertoCalculado;
        setDiferenca(diff);

    }, [debouncedValorTotal, debouncedCredito, debouncedDebito, debouncedPix, debouncedCashless, debouncedValorEstorno, debouncedValorTroco, debouncedDinheiroFisico, temEstorno]);

    const handleSelectCashier = (item) => { 
        const normalizedItem = { ...item, name: item.name || item.nome };
        setSelectedCashier(normalizedItem); 
        setSearchInput(normalizedItem.name); 
        setFilteredCashiers([]); 
    };

    // FUNÇÃO AVULSA: Cria o funcionário apenas na memória da tela, sem salvar no banco global
    const handleRegisterNewCashier = () => {
        if (!newCashierName.trim()) { setAlertMessage('Nome obrigatório.'); return; }
        const cleanCpf = searchInput.replace(/\D/g, '');
        const newC = { cpf: formatCpf(cleanCpf), name: newCashierName.trim(), nome: newCashierName.trim() };
        
        handleSelectCashier(newC);
        setRegisterModalVisible(false);
        setNewCashierName('');
        setAlertMessage(`Funcionário "${newC.name}" adicionado apenas para este fechamento!`);
    };

    // --- FUNÇÃO DE IMPRESSÃO ---
    const handlePrint = (type) => {
        if (!dataToConfirm) return;
        const logoSrc = '/logo.png'; 
        const printTime = new Date().toLocaleString('pt-BR'); 
        const diffColor = dataToConfirm.diferenca >= 0 ? '#000' : 'red'; 

        let content = '';

        if (type === 'receipt') {
            content = `
                <html>
                <head>
                    <title>Cupom - ${dataToConfirm.protocol}</title>
                    <style>
                        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; width: 290px; margin: 0 auto; padding: 10px 5px; color: #000; background: #fff; }
                        .header { text-align: center; margin-bottom: 8px; }
                        .logo-img { max-width: 250px; max-height: 100px; width: auto; margin-bottom: 5px; display: block; margin-left: auto; margin-right: auto; }
                        .title { font-weight: 800; font-size: 16px; text-transform: uppercase; margin-bottom: 2px; }
                        .subtitle { font-size: 11px; color: #333; }
                        .line { border-bottom: 1px dashed #000; margin: 6px 0; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .center-row { text-align: center; margin-bottom: 3px; }
                        .bold { font-weight: 700; }
                        .center { text-align: center; }
                        .section-title { font-weight: 700; text-align: center; background-color: #ddd; color: #000; padding: 3px 0; margin: 5px 0; font-size: 11px; border-top: 1px solid #999; border-bottom: 1px solid #999; }
                        .freelancer-data { font-size: 14px; font-weight: bold; }
                        .table-style { width: 100%; border-collapse: collapse; margin-top: 2px; }
                        .table-style td { padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 13px; } 
                        .table-style td:last-child { text-align: right; font-weight: bold; }
                        .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #555; }
                        .barcode-container { text-align: center; margin-top: 5px; margin-bottom: 5px; }
                        .sig-text { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="${logoSrc}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/>
                        <div class="title">Fechamento de Caixa</div>
                        <div class="subtitle">Caixa Móvel</div>
                    </div>
                    
                    <div class="line"></div>
                    <div class="info-row"><span>Evento:</span> <span class="bold">${dataToConfirm.eventName}</span></div>
                    
                    <div class="center-row">
                        <span>Prot: <span class="bold" style="font-size:14px;">${dataToConfirm.protocol}</span></span>
                    </div>
                    <div class="barcode-container"><svg id="barcode"></svg></div>
                    
                    <div class="info-row"><span>Data:</span> <span>${new Date(dataToConfirm.timestamp).toLocaleString('pt-BR')}</span></div>
                    <div class="info-row"><span>Operador:</span> <span>${dataToConfirm.operatorName}</span></div>

                    <div class="section-title">DADOS DO CAIXA</div>
                    <div class="info-row"><span>Nome:</span> <span class="freelancer-data">${dataToConfirm.cashierName}</span></div>
                    <div class="info-row"><span>CPF:</span> <span class="freelancer-data">${dataToConfirm.cpf}</span></div>
                    <div class="info-row" style="margin-top:2px;">
                        <span>Máquina: <span class="freelancer-data">${dataToConfirm.numeroMaquina}</span></span>
                    </div>

                    <div class="section-title">DETALHAMENTO DE VENDAS</div>
                    <table class="table-style">
                        <tr><td>Crédito</td><td>${formatCurrencyResult(dataToConfirm.credito)}</td></tr>
                        <tr><td>Débito</td><td>${formatCurrencyResult(dataToConfirm.debito)}</td></tr>
                        <tr><td>PIX</td><td>${formatCurrencyResult(dataToConfirm.pix)}</td></tr>
                        <tr><td>Cashless</td><td>${formatCurrencyResult(dataToConfirm.cashless)}</td></tr>
                        ${(dataToConfirm.temEstorno || dataToConfirm.valorEstorno > 0) ? `<tr style="color:#000; font-weight:bold;"><td>(-) Estorno</td><td>-${formatCurrencyResult(dataToConfirm.valorEstorno)}</td></tr>` : ''}
                        <tr style="background:#f0f0f0; font-weight:bold; font-size:12px;"><td>VENDA BRUTA</td><td>${formatCurrencyResult(dataToConfirm.valorTotalVenda)}</td></tr>
                    </table>

                    <div class="section-title">FUNDO DE TROCO</div>
                    <table class="table-style">
                        <tr><td>Fundo Inicial</td><td>${formatCurrencyResult(dataToConfirm.valorTroco)}</td></tr>
                    </table>

                    <div class="section-title">ACERTO FINANCEIRO</div>
                    <table class="table-style">
                        <tr><td>Dinheiro a Apresentar</td><td style="font-weight:bold;">${formatCurrencyResult(dataToConfirm.valorAcerto)}</td></tr>
                        <tr><td>Dinheiro Contado</td><td style="font-weight:bold;">${formatCurrencyResult(dataToConfirm.dinheiroFisico)}</td></tr>
                        <tr style="font-size:14px; border-top: 1px solid #000;">
                            <td><strong>DIFERENÇA</strong></td>
                            <td style="color:${diffColor}; font-weight:800;">${formatCurrencyResult(dataToConfirm.diferenca)}</td>
                        </tr>
                    </table>

                    <br/><br/>
                    <div class="center">_______________________________</div>
                    <div class="center sig-text">${dataToConfirm.cashierName}</div>
                    
                    <br/><br/>
                    <div class="center">_______________________________</div>
                    <div class="center sig-text">Assinatura do Conferente</div>
                    
                    <div class="footer">
                        Sistema v${APP_VERSION || '1.0'}<br/>
                        Impresso em ${printTime}
                    </div>

                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script>
                        JsBarcode("#barcode", "${dataToConfirm.protocol}", {format: "CODE128", displayValue: false, fontSize: 14, height: 35, margin: 5});
                    </script>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'height=700,width=400');
            printWindow.document.write(content);
            printWindow.document.close();
            setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 800);

        } else if (type === 'a4') {
            
            content = `
                <html>
                <head>
                    <title>A4 - ${dataToConfirm.protocol}</title>
                    <style>
                        @page { size: A4 portrait; margin: 0; }
                        @media print {
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                        
                        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11px; width: 210mm; height: 140mm; margin: 0; padding: 35px 25px 10px 25px; box-sizing: border-box; background: #fff; }
                        
                        .container { width: 100%; height: 100%; border: 2px solid #000; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; z-index: 1; overflow: hidden; }
                        
                        /* === MARCA D'ÁGUA CXM === */
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

                        /* Elementos sobre a marca d'água */
                        .header, .info-strip, .grid, .footer-sigs, .system-footer {
                            position: relative;
                            z-index: 10;
                        }

                        .header { display: flex; justify-content: center; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; min-height: 65px; }
                        
                        .logo-wrapper { position: absolute; left: 0; top: -25px; }
                        .logo-img { max-height: 115px; max-width: 250px; width: auto; object-fit: contain; } 
                        
                        .header-right { position: absolute; right: 0; top: 0; text-align: right; font-size: 10px; display:flex; flex-direction:column; align-items: flex-end; }
                        .header-center { text-align: center; padding: 0 10px; }
                        .title { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                        
                        .protocol-box { border: 1px solid #000; padding: 2px 6px; font-weight: bold; margin-bottom: 2px; display: inline-block; font-size: 12px; background: #fff; }
                        .info-strip { background-color: rgba(245, 245, 245, 0.9); padding: 4px; border: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; }
                        
                        .grid { display: grid; grid-template-columns: 1.15fr 0.95fr 0.9fr; gap: 8px; flex: 1; }
                        
                        .box { border: 1px solid #999; border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.85); }
                        .box-title { background-color: rgba(224, 224, 224, 0.9); color: #000; font-weight: bold; padding: 4px; text-align: center; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #999; }
                        .box-content { padding: 6px; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 3px 0; } 
                        .row:last-child { border-bottom: none; }
                        .row span:last-child { font-weight: bold; font-size: 13px; } 
                        .row-total { background-color: rgba(240, 240, 240, 0.9); font-weight: bold; padding: 5px 0; border-top: 1px solid #000; margin-top: auto; font-size: 12px; }
                        
                        .result-container { text-align: center; display: flex; flex-direction: column; justify-content: center; height: auto; margin-bottom: 10px; background: #fff; }
                        .result-label { font-size: 12px; font-weight: bold; color: #555; text-transform: uppercase; }
                        .result-value { font-size: 20px; font-weight: 900; margin-top: 5px; }
                        
                        .footer-sigs { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 60px; margin-bottom: 5px; }
                        .sig-block { text-align: center; width: 40%; }
                        .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                        .system-footer { font-size: 9px; color: #555; text-align: center; width: 100%; border-top: 1px solid #eee; padding-top: 2px; padding-bottom: 2px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="watermark">CXM</div>

                        <div class="header">
                            <div class="logo-wrapper">
                                <img src="${logoSrc}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/>
                            </div>

                            <div class="header-center">
                                <div class="title">Recibo de Fechamento</div>
                                <div style="font-size: 14px; font-weight: 900; margin-top:4px; background: #000; color: #fff; padding: 3px 12px; border-radius: 4px; display: inline-block;">
                                    CAIXA MÓVEL
                                </div>
                            </div>
                            <div class="header-right">
                                <div class="protocol-box">PROT: ${dataToConfirm.protocol}</div>
                                <svg id="barcodeA4"></svg>
                            </div>
                        </div>

                        <div class="info-strip">
                            <div><strong>Evento:</strong> ${dataToConfirm.eventName}</div>
                            <div><strong>Operador:</strong> ${dataToConfirm.operatorName}</div>
                            <div><strong>Data de Fechamento:</strong> ${new Date(dataToConfirm.timestamp).toLocaleDateString('pt-BR')}</div>
                        </div>

                        <div class="grid">
                            <div class="box">
                                <div class="box-title">Detalhes da Venda</div>
                                <div class="box-content">
                                    <div class="row"><span>Caixa:</span> <strong style="font-size:12px;">${dataToConfirm.cashierName}</strong></div>
                                    <div class="row"><span>CPF:</span> <span>${dataToConfirm.cpf}</span></div>
                                    <div class="row"><span>Máquina:</span> <span>${dataToConfirm.numeroMaquina}</span></div>
                                    
                                    <div style="margin: 3px 0; border-top: 1px dashed #ccc;"></div>
                                    <div class="row"><span>Crédito:</span> <span>${formatCurrencyResult(dataToConfirm.credito)}</span></div>
                                    <div class="row"><span>Débito:</span> <span>${formatCurrencyResult(dataToConfirm.debito)}</span></div>
                                    <div class="row"><span>PIX:</span> <span>${formatCurrencyResult(dataToConfirm.pix)}</span></div>
                                    <div class="row"><span>Cashless:</span> <span>${formatCurrencyResult(dataToConfirm.cashless)}</span></div>
                                    ${(dataToConfirm.temEstorno || dataToConfirm.valorEstorno > 0) ? `<div class="row" style="color:#d32f2f; font-weight:bold;"><span>(-) Estorno:</span> <span>-${formatCurrencyResult(dataToConfirm.valorEstorno)}</span></div>` : ''}
                                    <div style="flex:1"></div>
                                    <div class="row row-total" style="padding: 5px;"><span>VENDA BRUTA:</span> <span>${formatCurrencyResult(dataToConfirm.valorTotalVenda)}</span></div>
                                </div>
                            </div>

                            <div class="box">
                                <div class="box-title">Fundo de Troco</div>
                                <div class="box-content">
                                    <div class="row"><span>Fundo Inicial:</span> <span style="font-size:14px;">${formatCurrencyResult(dataToConfirm.valorTroco)}</span></div>
                                    <div style="flex:1"></div>
                                    <div class="row row-total" style="padding: 5px; background-color: rgba(240, 240, 240, 0.9);"><span>TOTAL TROCO:</span> <span style="font-size:13px;">${formatCurrencyResult(dataToConfirm.valorTroco)}</span></div>
                                </div>
                            </div>

                            <div class="box">
                                <div class="box-title">Acerto Financeiro</div>
                                <div class="box-content">
                                    <div class="row"><span>A Apresentar:</span> <span>${formatCurrencyResult(dataToConfirm.valorAcerto)}</span></div>
                                    <div class="row"><span>Contado:</span> <span>${formatCurrencyResult(dataToConfirm.dinheiroFisico)}</span></div>
                                    
                                    <div style="margin-top: auto; padding-top: 10px; border-top: 1px dashed #000; text-align: center;">
                                        <div style="font-size: 10px; font-weight:bold; color: #555;">DIFERENÇA</div>
                                        <div style="font-size: 18px; font-weight: 900; margin-top: 2px; color: ${diffColor};">${formatCurrencyResult(dataToConfirm.diferenca)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="footer-sigs">
                            <div class="sig-block"><div class="sig-line">${dataToConfirm.cashierName}</div></div>
                            <div class="sig-block"><div class="sig-line">Assinatura do Conferente</div></div>
                        </div>
                        <div class="system-footer">Sis.Versão: ${APP_VERSION || '1.0'} | Impresso em: ${printTime}</div>
                    </div>

                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script>
                        JsBarcode("#barcodeA4", "${dataToConfirm.protocol}", {format: "CODE128", displayValue: false, height: 25, width: 1, margin: 0});
                        // Aciona a impressão automaticamente quando carregar
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'height=500,width=800');
            printWindow.document.write(content);
            printWindow.document.close();
        }
    };

    const prepareAndShowSummary = () => {
        const closingData = {
            type: 'cashier',
            timestamp: timestamp || new Date().toISOString(),
            protocol,
            eventName: localStorage.getItem('activeEvent') || 'N/A',
            operatorName: localStorage.getItem('loggedInUserName') || 'N/A',
            cpf: selectedCashier.cpf,
            cashierName: selectedCashier.name,
            chavePix: selectedCashier.pix || '',
            tipoPix: selectedCashier.tipo_pix || '',
            telefone: selectedCashier.telefone || '',
            numeroMaquina,
            valorTotalVenda: getNumericValue(valorTotal),
            credito: getNumericValue(credito),
            debito: getNumericValue(debito),
            pix: getNumericValue(pix),
            cashless: getNumericValue(cashless),
            valorTroco: getNumericValue(valorTroco),
            temEstorno,
            valorEstorno: getNumericValue(valorEstorno),
            dinheiroFisico: getNumericValue(dinheiroFisico),
            valorAcerto: valorTotalAcerto,
            diferenca,
        };
        setDataToConfirm(closingData);
        setModalState('confirm');
        setModalVisible(true);
    };

    const handleOpenConfirmation = () => {
        if (!selectedCashier || !numeroMaquina.trim()) { 
            setAlertMessage('Selecione o caixa/funcionário e informe o número da máquina.'); 
            return; 
        }

        const dinheiroFisicoValue = getNumericValue(dinheiroFisico);
        if (dinheiroFisicoValue === 0) {
            setModalState('warning_zero_money');
            setModalVisible(true);
        } else {
            prepareAndShowSummary();
        }
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            const response = await saveMobileCashierClosing(dataToConfirm);
            const savedData = response.data || response;
            setDataToConfirm(prev => ({ ...prev, ...savedData }));
            setModalState('success');
        } catch (error) {
            setAlertMessage('Erro ao salvar.');
            setModalVisible(false);
        }
    };

    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedCashier(null); setSearchInput('');
        setNumeroMaquina(''); setTemEstorno(false);
        setValorTotal(''); setCredito(''); setDebito(''); setPix(''); setCashless('');
        setValorTroco(''); setValorEstorno(''); setDinheiroFisico('');
    };

    const handleRegisterNew = () => { setModalVisible(false); resetForm(); };
    const handleBackToMenu = () => { navigate('/financial-selection'); };

    const handleKeyDown = (e, nextField) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            formRefs[nextField]?.current?.focus();
        }
    };

    if (isLoading) return <LoadingSpinner message="Carregando..." />;

    return (
        <div className="app-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="login-form form-scrollable" style={{ maxWidth: '800px' }}>
                <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar</button>
                <h1>{protocol ? 'Editar Caixa Móvel' : 'Fechamento Caixa Móvel'}</h1>

                <div className="form-section" style={{display: 'block'}}>
                    {/* LINHA 1: Busca ou Crachá Preenchido */}
                    <div className="form-row">
                        {!selectedCashier ? (
                            <div className="input-group" style={{ width: '100%' }}>
                                <label>Buscar Funcionário (Nome/CPF)</label>
                                <input ref={formRefs.cpf} onKeyDown={(e) => handleKeyDown(e, 'numeroCamiseta')} value={searchInput} onChange={(e) => {setSearchInput(e.target.value); setSelectedCashier(null);}} disabled={!!protocol} placeholder="Digite o nome ou CPF..." />
                                {filteredCashiers.length > 0 && (
                                    <div className="suggestions-list">
                                        {filteredCashiers.map((c, index) => (
                                            <div key={`sug-${index}`} className="suggestion-item" onClick={() => handleSelectCashier(c)}>
                                                {c.name || c.nome} - {c.cpf}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showRegisterButton && <button className="login-button" style={{marginTop: 10, backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>Adicionar Funcionário Avulso?</button>}
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
                                    {/* CABEÇALHO DO CRACHÁ */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #b6d4fe', paddingBottom: '6px' }}>
                                        <span style={{ fontWeight: '900', fontSize: '1.15rem', textTransform: 'uppercase' }}>
                                            {selectedCashier.name || selectedCashier.nome}
                                        </span>
                                        
                                        {!protocol && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setSelectedCashier(null); setSearchInput(''); setTimeout(() => formRefs.cpf.current?.focus(), 100); }}
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

                    {/* LINHA 2: Número da Máquina Isolado */}
                    <div className="form-row" style={{ marginTop: '10px' }}>
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input ref={formRefs.numeroCamiseta} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} placeholder="Ex: 12345" />
                        </div>
                    </div>
                </div>

                <div className="form-section" style={{display: 'block'}}>
                    <div className="form-row">
                        <div className="input-group"><label>Valor Total Venda</label><input ref={formRefs.valorTotal} onKeyDown={(e) => handleKeyDown(e, 'valorTroco')} value={formatCurrencyInput(valorTotal)} onChange={(e) => handleCurrencyChange(setValorTotal, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Troco</label><input ref={formRefs.valorTroco} onKeyDown={(e) => handleKeyDown(e, temEstorno ? 'valorEstorno' : 'credito')} value={formatCurrencyInput(valorTroco)} onChange={(e) => handleCurrencyChange(setValorTroco, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>
                    <div className="switch-container"><label>Houve Estorno?</label><label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label></div>
                    {temEstorno && (<div className="input-group" style={{marginTop: 10}}><label>Valor do Estorno</label><input ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'credito')} value={formatCurrencyInput(valorEstorno)} onChange={(e) => handleCurrencyChange(setValorEstorno, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>)}
                    
                    <h3 style={{marginTop: 20, marginBottom: 10, color: '#555'}}>Recebimentos Digitais</h3>
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>
                    <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'dinheiroFisico')} value={formatCurrencyInput(cashless)} onChange={(e) => handleCurrencyChange(setCashless, e.target.value)} placeholder="0,00" inputMode="numeric"/></div>
                    </div>

                    <h3 style={{marginTop: 20, marginBottom: 10, color: '#555'}}>Conferência Física</h3>
                    <div className="input-group">
                        <label>Dinheiro em Espécie (Contado na Gaveta)</label>
                        <input ref={formRefs.dinheiroFisico} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} value={formatCurrencyInput(dinheiroFisico)} onChange={(e) => handleCurrencyChange(setDinheiroFisico, e.target.value)} placeholder="0,00" inputMode="numeric" style={{backgroundColor: '#e8f0fe', fontWeight: 'bold'}}/>
                    </div>
                </div>

                <div className="results-container">
                    <p>Dinheiro a Apresentar: <strong>{formatCurrencyResult(valorTotalAcerto)}</strong></p>
                    <p className="total-text">Diferença (Sobra/Falta): <strong className="final-value" style={{color: diferenca >= 0 ? 'blue' : 'red'}}>{formatCurrencyResult(diferenca)}</strong></p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR FECHAMENTO</button>
                </div>
            </div>

            {/* MODAL FUNCIONÁRIO AVULSO */}
            {registerModalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Adicionar Funcionário Avulso</h2>
                        <div className="input-group">
                            <label>CPF</label>
                            <input type="text" value={formatCpf(searchInput)} readOnly style={{backgroundColor: '#f5f5f5'}} />
                        </div>
                        <div className="input-group">
                            <label>Nome do Funcionário</label>
                            <input type="text" value={newCashierName} onChange={(e) => setNewCashierName(e.target.value)} placeholder="Digite o nome completo" />
                        </div>
                        
                        <div className="modal-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                            <button type="button" className="login-button" style={{ backgroundColor: '#17a2b8' }} onClick={handleRegisterNewCashier}>
                                🏃 Usar Apenas Neste Acerto
                            </button>
                            <button type="button" className="cancel-button" style={{ width: '100%' }} onClick={() => setRegisterModalVisible(false)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: '30px' }}>
                        {modalState === 'warning_zero_money' && <>
                            <div className="warning-icon" style={{fontSize: '40px', color: '#f39c12', marginBottom: '15px'}}>⚠️</div>
                            <h2 style={{color: '#e67e22'}}>Atenção!</h2>
                            <p style={{fontSize: '16px', lineHeight: '1.5'}}>
                                O campo <strong>Dinheiro em Espécie</strong> está zerado (R$ 0,00).
                            </p>
                            <p style={{fontSize: '16px', marginBottom: '20px'}}>
                                Confirma que este caixa <strong>não possui dinheiro físico</strong> (ex: Totem ou 100% Digital)?
                            </p>
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Não, vou corrigir</button>
                                <button className="login-button" onClick={prepareAndShowSummary} style={{backgroundColor: '#f39c12'}}>Sim, Prosseguir</button>
                            </div>
                        </>}

                        {modalState === 'confirm' && <>
                            <h2>Confirmar Fechamento de Caixa</h2>
                            {dataToConfirm && <>
                                <p><strong>Caixa:</strong> {dataToConfirm.cashierName}</p>
                                {dataToConfirm.chavePix && <p><strong>Chave PIX:</strong> {dataToConfirm.chavePix} ({dataToConfirm.tipoPix})</p>}
                                <p><strong>Máquina:</strong> {dataToConfirm.numeroMaquina}</p>
                                <hr/>
                                <p>Dinheiro na Gaveta (Inf.): <strong>{formatCurrencyResult(dataToConfirm.dinheiroFisico)}</strong></p>
                                <p>Dinheiro Esperado (Calc.): <strong>{formatCurrencyResult(dataToConfirm.valorAcerto)}</strong></p>
                                <hr/>
                                <p className="total-text">Diferença: <strong style={{color: dataToConfirm.diferenca >= 0 ? 'blue' : 'red'}}>{formatCurrencyResult(dataToConfirm.diferenca)}</strong></p>
                            </>}
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Corrigir</button>
                                <button className="login-button" onClick={handleConfirmAndSave}>Confirmar</button>
                            </div>
                        </>}

                        {modalState === 'saving' && <><div className="spinner"></div><p>Salvando...</p></>}

                        {modalState === 'success' && 
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                                <h2>Salvo com Sucesso!</h2>
                                <p>Protocolo Local: <strong>{dataToConfirm?.protocol}</strong></p>
                                
                                <div className="modal-buttons" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                        <button type="button" className="login-button" style={{ backgroundColor: '#FF9800', flex: 1, padding: '15px 0' }} onClick={() => handlePrint('receipt')}>
                                            <span style={{ fontSize: '16px' }}>🧾 Cupom Fiscal</span>
                                        </button>
                                        <button type="button" className="login-button" style={{ backgroundColor: '#2196F3', flex: 1, padding: '15px 0' }} onClick={() => handlePrint('a4')}>
                                            <span style={{ fontSize: '16px' }}>📄 Folha A4 (1/2)</span>
                                        </button>
                                    </div>

                                    <button type="button" className="modal-button primary" style={{ width: '100%' }} onClick={handleRegisterNew}>
                                        <span className="button-icon">➕</span> Novo Fechamento
                                    </button>
                                    <button type="button" className="modal-button secondary" style={{ width: '100%' }} onClick={handleBackToMenu}>
                                        <span className="button-icon">📋</span> Menu Principal
                                    </button>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

export default MobileCashierClosingPage;