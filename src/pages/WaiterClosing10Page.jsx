// src/pages/WaiterClosing10Page.jsx
// (VERSÃO FINAL: COLUNAS A4 REEQUILIBRADAS - 1ª REDUZIDA, COMISSÃO AUMENTADA)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { saveWaiterClosing } from '../services/apiService';
import { attemptBackgroundSyncNewPersonnel } from '../services/syncService';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { APP_VERSION } from '../config'; 
import '../App.css';
import './WaiterClosingPage.css'; // Usa o mesmo CSS

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function WaiterClosing10Page() {
    const navigate = useNavigate();
    const location = useLocation(); 

    const formRefs = {
      cpf: useRef(null), numeroCamiseta: useRef(null), numeroMaquina: useRef(null),
      valorTotal: useRef(null), valorEstorno: useRef(null), credito: useRef(null),
      debito: useRef(null), pix: useRef(null), cashless: useRef(null), saveButton: useRef(null),
    };

    const [isLoading, setIsLoading] = useState(true);
    const [alertMessage, setAlertMessage] = useState('');
    
    // Dados Mestres
    const [waiters, setWaiters] = useState([]);
    const [selectedWaiter, setSelectedWaiter] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [filteredWaiters, setFilteredWaiters] = useState([]);
    
    // Campos do Formulário
    const [protocol, setProtocol] = useState(null);
    const [timestamp, setTimestamp] = useState(null);
    const [numeroCamiseta, setNumeroCamiseta] = useState('');
    const [numeroMaquina, setNumeroMaquina] = useState('');
    
    const [temEstorno, setTemEstorno] = useState(false);
    const [valorTotal, setValorTotal] = useState('');
    const [valorEstorno, setValorEstorno] = useState('');
    const [credito, setCredito] = useState('');
    const [debito, setDebito] = useState('');
    const [pix, setPix] = useState('');
    const [cashless, setCashless] = useState('');
    
    // --- VARIÁVEIS DE COMISSÃO (10% + 4%) ---
    const [comissao10, setComissao10] = useState(0);
    const [comissao4, setComissao4] = useState(0);
    const [comissaoTotal, setComissaoTotal] = useState(0);
    
    const [valorTotalAcerto, setValorTotalAcerto] = useState(0);
    const [diferencaPagarReceber, setDiferencaPagarReceber] = useState(0);
    const [diferencaLabel, setDiferencaLabel] = useState('Aguardando valores...');
    
    // Modais
    const [modalVisible, setModalVisible] = useState(false);
    const [modalState, setModalState] = useState('confirm');
    const [dataToConfirm, setDataToConfirm] = useState(null);
    const [showRegisterButton, setShowRegisterButton] = useState(false);
    const [registerModalVisible, setRegisterModalVisible] = useState(false);
    const [newWaiterName, setNewWaiterName] = useState('');

    const debouncedValorTotal = useDebounce(valorTotal, 300);
    const debouncedCredito = useDebounce(credito, 300);
    const debouncedDebito = useDebounce(debito, 300);
    const debouncedPix = useDebounce(pix, 300);
    const debouncedCashless = useDebounce(cashless, 300);
    const debouncedValorEstorno = useDebounce(valorEstorno, 300);

    const getNumericValue = (digits) => (parseInt(digits || '0', 10)) / 100;

    const handleCurrencyChange = (setter, rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '');
        setter(digitsOnly);
    };

    // Carregamento Inicial
    useEffect(() => {
        const timer = setTimeout(() => { setIsLoading(false); }, 500);
        const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        setWaiters(localWaiters);
        
        const closingToEdit = location.state?.closingToEdit;
        if (closingToEdit) {
            const toDigits = (value) => value ? String(Math.round(Number(value) * 100)) : '';
            setProtocol(closingToEdit.protocol);
            setTimestamp(closingToEdit.timestamp);
            // ADICIONADO: Recupera os dados do PIX caso seja uma edição
            const waiter = { 
                cpf: closingToEdit.cpf, 
                name: closingToEdit.waiterName,
                pix: closingToEdit.chavePix || '',
                tipo_pix: closingToEdit.tipoPix || '',
                telefone: closingToEdit.telefone || ''
            };
            setSelectedWaiter(waiter);
            setSearchInput(waiter.name);
            setNumeroCamiseta(closingToEdit.numeroCamiseta || '');
            setNumeroMaquina(closingToEdit.numeroMaquina || '');
            setTemEstorno(closingToEdit.temEstorno);
            setValorTotal(toDigits(closingToEdit.valorTotal));
            setValorEstorno(toDigits(closingToEdit.valorEstorno));
            setCredito(toDigits(closingToEdit.credito));
            setDebito(toDigits(closingToEdit.debito));
            setPix(toDigits(closingToEdit.pix));
            setCashless(toDigits(closingToEdit.cashless));
        }
        return () => clearTimeout(timer);
    }, [location.state]);

    // Busca Inteligente (Ignora acentos e CPFs vazios)
    useEffect(() => {
        const rawQuery = searchInput.trim();
        if (rawQuery.length > 0 && !selectedWaiter) {
            const normalizedQuery = rawQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const queryDigitsOnly = rawQuery.replace(/\D/g, '');

            const results = waiters.filter(w => {
                const personName = (w.name || w.nome || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const personCpf = (w.cpf || '').replace(/\D/g, '');

                const matchName = personName.includes(normalizedQuery);
                const matchCpf = queryDigitsOnly.length > 0 && personCpf.includes(queryDigitsOnly);

                return matchName || matchCpf;
            });
            
            setFilteredWaiters(results);
            setShowRegisterButton(queryDigitsOnly.length === 11 && results.length === 0);
        } else {
            setFilteredWaiters([]);
            setShowRegisterButton(false);
        }
    }, [searchInput, waiters, selectedWaiter]);
    
    // --- CÁLCULO FINANCEIRO (10% + 4%) ---
    useEffect(() => {
        const numValorTotal = getNumericValue(debouncedValorTotal);
        const numCredito = getNumericValue(debouncedCredito);
        const numDebito = getNumericValue(debouncedDebito);
        const numPix = getNumericValue(debouncedPix);
        const numCashless = getNumericValue(debouncedCashless);
        const numValorEstorno = getNumericValue(debouncedValorEstorno);
        
        const valorEfetivoVenda = numValorTotal - (temEstorno ? numValorEstorno : 0);
        
        // Base para 10%: (Venda Líquida - Cashless)
        const baseComissao10 = valorEfetivoVenda - numCashless;
        
        // Cálculos
        const c10 = baseComissao10 * 0.10; // 10%
        const c4 = numCashless * 0.04;    // 4%
        const cTotal = c10 + c4;

        setComissao10(c10); 
        setComissao4(c4); 
        setComissaoTotal(cTotal);
        
        const totalAcerto = valorEfetivoVenda - cTotal;
        setValorTotalAcerto(totalAcerto);
        
        const dinheiroDevido = valorEfetivoVenda - (numCredito + numDebito + numPix + numCashless);
        const diferenca = dinheiroDevido - cTotal;
        
        if (diferenca < 0) {
          setDiferencaLabel('Pagar ao Garçom');
          setDiferencaPagarReceber(diferenca * -1);
        } else {
          setDiferencaLabel('Receber do Garçom');
          setDiferencaPagarReceber(diferenca);
        }
    }, [debouncedValorTotal, debouncedCredito, debouncedDebito, debouncedPix, debouncedCashless, debouncedValorEstorno, temEstorno]);

    const handleSelectWaiter = (waiter) => { 
        const normalizedItem = { ...waiter, name: waiter.name || waiter.nome };
        setSelectedWaiter(normalizedItem); 
        setSearchInput(normalizedItem.name); 
        setFilteredWaiters([]); 
    };

    // FUNÇÃO AVULSA (Não salva no MongoDB/LocalStorage, apenas para o acerto atual)
    const handleRegisterNewWaiter = () => {
        const cleanCpf = searchInput.replace(/\D/g, '');
        if (!newWaiterName.trim()) { setAlertMessage('Por favor, insira o nome do novo garçom.'); return; }
        const newWaiter = { cpf: formatCpf(cleanCpf), name: newWaiterName.trim(), nome: newWaiterName.trim() };
        
        handleSelectWaiter(newWaiter);
        setRegisterModalVisible(false);
        setNewWaiterName('');
        setAlertMessage(`Garçom "${newWaiter.name}" adicionado como AVULSO apenas para este fechamento!`);
    };
    
    // --- FUNÇÃO DE IMPRESSÃO ---
    // --- FUNÇÃO DE IMPRESSÃO SEGURA ---
    const handlePrint = (type) => {
        if (!dataToConfirm) return;
        const logoSrc = '/logo.png'; 
        const printTime = new Date().toLocaleString('pt-BR'); 

        let content = '';

        if (type === 'receipt') {
            const isReceivingFromWaiter = dataToConfirm.diferencaLabel === 'Receber do Garçom';
            
            const createManualRow = (label) => `
                <div class="manual-row">
                    <span class="manual-check">[&nbsp;&nbsp;]</span>
                    <span class="manual-label">${label}</span>
                    <span class="manual-line">R$</span>
                </div>
            `;

            let paymentBlockHtml = '';
            
            if (isReceivingFromWaiter) {
                paymentBlockHtml = `
                    <div class="section-title">FORMA DE RECEBIMENTO</div>
                    <div style="font-size:10px; margin-bottom:10px; text-align:center;">Preencha o valor recebido:</div>
                    ${createManualRow('Vale')}
                    ${createManualRow('Dinheiro')}
                    ${createManualRow('PIX')}
                    
                    <div style="margin-top: 15px;">
                        <div style="border-bottom: 1px solid #000; height: 18px; margin-bottom: 8px;"></div>
                        <div style="border-bottom: 1px solid #000; height: 18px; margin-bottom: 8px;"></div>
                        <div style="border-bottom: 1px solid #000; height: 18px;"></div>
                    </div>
                `;
            } else {
                paymentBlockHtml = `
                    <div style="margin-top:10px; border: 1px solid #000;">
                        <div style="background-color: #000; color: #fff; padding: 5px; text-align:center; font-weight:bold; font-size:12px;">
                            PAGAMENTO REALIZADO?
                        </div>
                        <div style="padding:15px 5px; text-align:center; font-weight:bold; font-size:12px;">
                           ( &nbsp;&nbsp; ) SIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( &nbsp;&nbsp; ) NÃO
                        </div>
                    </div>
                    <div style="margin-top: 15px;">
                        <div style="border-bottom: 1px solid #000; height: 18px; margin-bottom: 8px;"></div>
                        <div style="border-bottom: 1px solid #000; height: 18px; margin-bottom: 8px;"></div>
                        <div style="border-bottom: 1px solid #000; height: 18px;"></div>
                    </div>
                `;
            }

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
                        .big-result { border: 2px solid #000; padding: 8px; margin-top: 8px; text-align: center; border-radius: 4px; }
                        .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #555; }
                        .barcode-container { text-align: center; margin-top: 5px; margin-bottom: 5px; }
                        .manual-row { display: flex; align-items: flex-end; margin-bottom: 15px; font-size: 12px; }
                        .manual-check { font-weight: bold; margin-right: 5px; min-width: 25px; }
                        .manual-label { margin-right: 5px; }
                        .manual-line { flex-grow: 1; border-bottom: 1px solid #000; text-align: right; padding-right: 2px; }
                        .sig-text { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <img src="${logoSrc}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/>
                        <div class="title">Comprovante de Fechamento</div>
                        <div class="subtitle">Garçom 10%</div>
                    </div>
                    <div class="line"></div>
                    <div class="info-row"><span>Evento:</span> <span class="bold">${dataToConfirm.eventName}</span></div>
                    <div class="center-row">
                        <span>Prot: <span class="bold" style="font-size:14px;">${dataToConfirm.protocol}</span></span>
                    </div>
                    <div class="barcode-container"><svg id="barcode"></svg></div>
                    <div class="info-row"><span>Data:</span> <span>${new Date(dataToConfirm.timestamp).toLocaleString('pt-BR')}</span></div>
                    <div class="info-row"><span>Operador:</span> <span>${dataToConfirm.operatorName}</span></div>
                    <div class="section-title">DADOS DO FREELANCER</div>
                    <div class="info-row"><span>Nome:</span> <span class="freelancer-data">${dataToConfirm.waiterName}</span></div>
                    <div class="info-row"><span>CPF:</span> <span class="freelancer-data">${dataToConfirm.cpf}</span></div>
                    <div class="info-row" style="margin-top:2px;">
                        <span>Máquina: <span class="freelancer-data">${dataToConfirm.numeroMaquina}</span></span>
                        <span>Camisa: <span class="freelancer-data">${dataToConfirm.numeroCamiseta}</span></span>
                    </div>
                    <div class="section-title">DETALHAMENTO DE VENDAS</div>
                    <table class="table-style">
                        <tr><td>Crédito</td><td>${formatCurrencyResult(dataToConfirm.credito)}</td></tr>
                        <tr><td>Débito</td><td>${formatCurrencyResult(dataToConfirm.debito)}</td></tr>
                        <tr><td>PIX</td><td>${formatCurrencyResult(dataToConfirm.pix)}</td></tr>
                        <tr><td>Cashless</td><td>${formatCurrencyResult(dataToConfirm.cashless)}</td></tr>
                        ${(dataToConfirm.temEstorno || dataToConfirm.valorEstorno > 0) ? `<tr style="color:#d32f2f; font-weight:bold;"><td>(-) Estorno Lançado</td><td>-${formatCurrencyResult(dataToConfirm.valorEstorno)}</td></tr>` : ''}
                        <tr style="background:#f0f0f0; font-weight:bold; font-size:12px;"><td>VENDA BRUTA</td><td>${formatCurrencyResult(dataToConfirm.valorTotal)}</td></tr>
                    </table>
                    <div class="section-title">COMISSÕES</div>
                    <table class="table-style">
                        <tr><td>Comissão Venda (10%)</td><td>${formatCurrencyResult(dataToConfirm.comissao10)}</td></tr>
                        <tr><td>Cashless (4%)</td><td>${formatCurrencyResult(dataToConfirm.comissao4)}</td></tr>
                        <tr style="font-weight:bold; border-top:1px solid #000; font-size:12px;"><td>TOTAL COMISSÃO</td><td>${formatCurrencyResult(dataToConfirm.comissaoTotal)}</td></tr>
                    </table>
                    <div class="big-result">
                        <div style="font-size:10px; margin-bottom:2px;">RESULTADO FINAL</div>
                        <div style="font-size:12px; font-weight:bold;">${dataToConfirm.diferencaLabel.toUpperCase()}</div>
                        <div style="font-size:18px; font-weight:800; margin-top:4px;">${formatCurrencyResult(dataToConfirm.diferencaPagarReceber)}</div>
                    </div>
                    ${paymentBlockHtml}
                    <br/><br/>
                    <div class="center">_______________________________</div>
                    <div class="center sig-text">${dataToConfirm.waiterName}</div>
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
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'height=700,width=400');
            printWindow.document.write(content);
            printWindow.document.close();

        } else if (type === 'a4') {
            const isReceivingA4 = dataToConfirm.diferencaLabel === 'Receber do Garçom';
            const pixCadastrado = dataToConfirm.chavePix ? `<strong>PIX:</strong> ${dataToConfirm.tipoPix} - ${dataToConfirm.chavePix}` : '<strong>PIX:</strong> Não cadastrado';
            
            let a4PaymentBlock = '';
            
            if (isReceivingA4) {
                 // CENÁRIO RECEBER (Operador recebe do garçom)
                 a4PaymentBlock = `
                    <div style="margin-top: auto; padding-top: 10px; border-top: 1px dashed #ccc;">
                        <div style="font-size:10px; font-weight:bold; text-align:center; background:#eee; padding:3px; border:1px solid #ccc; margin-bottom: 8px;">FORMA DE RECEBIMENTO</div>
                        <div style="display:flex; justify-content:space-around; margin-bottom: 12px; font-size: 11px;">
                            <span>[ &nbsp; ] VALE</span>
                            <span>[ &nbsp; ] DINHEIRO</span>
                            <span>[ &nbsp; ] PIX</span>
                        </div>
                        <div style="margin-top: 5px;">
                            <div style="border-bottom: 1px solid #000; height: 16px; margin-bottom: 4px;"></div>
                            <div style="border-bottom: 1px solid #000; height: 16px; margin-bottom: 4px;"></div>
                            <div style="border-bottom: 1px solid #000; height: 16px;"></div>
                        </div>
                    </div>
                 `;
            } else {
                 // CENÁRIO PAGAR (Operador paga o garçom -> Puxa PIX automático)
                 a4PaymentBlock = `
                    <div style="margin-top: auto; padding-top: 10px; border-top: 1px dashed #ccc;">
                        <div style="font-size:10px; font-weight:bold; text-align:center; background:#eee; padding:3px; border:1px solid #ccc;">MEIO DE PAGAMENTO</div>
                        <div style="display:flex; justify-content:space-around; padding: 8px 0; font-size: 11px;">
                            <span>[ &nbsp; ] DINHEIRO</span>
                            <span>[ &nbsp; ] PIX</span>
                        </div>
                        <div style="font-size:10px; color:#555; margin-top:5px;">PIX Cadastrado:</div>
                        <div style="font-size:12px; font-weight:bold; border-bottom:1px solid #ccc; padding-bottom:3px; word-break: break-all;">
                            ${pixCadastrado}
                        </div>
                        <div style="font-size:10px; color:#555; margin-top:8px;">Outra Chave/OBS:</div>
                        <div style="border-bottom: 1px solid #000; height:18px;"></div>
                    </div>
                 `;
            }

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
                        
                        /* === MARCA D'ÁGUA === */
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

                        .header, .info-strip, .grid, .footer-sigs, .system-footer { position: relative; z-index: 10; }

                        .header { display: flex; justify-content: center; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; min-height: 65px; }
                        .logo-wrapper { position: absolute; left: 0; top: -25px; }
                        .logo-img { max-height: 115px; max-width: 250px; width: auto; object-fit: contain; } 
                        .header-right { position: absolute; right: 0; top: 0; text-align: right; font-size: 10px; display:flex; flex-direction:column; align-items: flex-end; }
                        .header-center { text-align: center; padding: 0 10px; }
                        .title { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                        
                        .protocol-box { border: 1px solid #000; padding: 2px 6px; font-weight: bold; margin-bottom: 2px; display: inline-block; font-size: 12px; background:#fff;}
                        .info-strip { background-color: rgba(245, 245, 245, 0.9); padding: 4px; border: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; }
                        
                        .grid { display: grid; grid-template-columns: 1.3fr 0.9fr 0.8fr; gap: 8px; flex: 1; }
                        .col-stack { display: flex; flex-direction: column; gap: 8px; }
                        
                        .box { border: 1px solid #999; border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.85);}
                        .box-title { background-color: rgba(224, 224, 224, 0.9); color: #000; font-weight: bold; padding: 4px; text-align: center; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #999; }
                        .box-content { padding: 6px; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
                        .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 3px 0; } 
                        .row:last-child { border-bottom: none; }
                        .row span:last-child { font-weight: bold; font-size: 13px; } 
                        .row-total { background-color: rgba(240, 240, 240, 0.9); font-weight: bold; padding: 5px 0; border-top: 1px solid #000; margin-top: auto; font-size: 12px; }
                        .result-container { text-align: center; display: flex; flex-direction: column; justify-content: center; height: auto; margin-bottom: 10px; background:#fff;}
                        .result-label { font-size: 12px; font-weight: bold; color: #555; text-transform: uppercase; }
                        .result-value { font-size: 20px; font-weight: 900; margin-top: 5px; }
                        
                        .footer-sigs { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 60px; margin-bottom: 10px; }
                        .sig-block { text-align: center; width: 40%; }
                        .sig-line { border-top: 1px solid #000; padding-top: 3px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                        .system-footer { font-size: 9px; color: #555; text-align: center; width: 100%; border-top: 1px solid #eee; padding-top: 2px; padding-bottom: 5px; background: rgba(255, 255, 255, 0.7);}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="watermark">10%</div>
                        <div class="header">
                            <div class="logo-wrapper">
                                <img src="${logoSrc}" class="logo-img" alt="Logo" onerror="this.style.display='none'"/>
                            </div>
                            <div class="header-center">
                                <div class="title">Recibo de Fechamento</div>
                                <div style="font-size: 14px; font-weight: 900; margin-top:4px; background: #000; color: #fff; padding: 3px 12px; border-radius: 4px; display: inline-block;">
                                    GARÇOM 10%
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
                            <div class="col-stack">
                                <div class="box" style="flex: 0 0 auto;">
                                    <div class="box-title">Identificação</div>
                                    <div class="box-content">
                                        <div class="row"><span>Freelancer:</span> <strong style="font-size:12px;">${dataToConfirm.waiterName}</strong></div>
                                        <div class="row"><span>CPF:</span> <span>${dataToConfirm.cpf}</span></div>
                                        <div class="row"><span>Máquina:</span> <span>${dataToConfirm.numeroMaquina}</span></div>
                                        <div class="row"><span>Camisa:</span> <span>${dataToConfirm.numeroCamiseta}</span></div>
                                    </div>
                                </div>

                                <div class="box" style="flex: 1;">
                                    <div class="box-title">Detalhes da Venda</div>
                                    <div class="box-content">
                                        <div class="row"><span>Crédito:</span> <span>${formatCurrencyResult(dataToConfirm.credito)}</span></div>
                                        <div class="row"><span>Débito:</span> <span>${formatCurrencyResult(dataToConfirm.debito)}</span></div>
                                        <div class="row"><span>PIX:</span> <span>${formatCurrencyResult(dataToConfirm.pix)}</span></div>
                                        <div class="row"><span>Cashless:</span> <span>${formatCurrencyResult(dataToConfirm.cashless)}</span></div>
                                        ${(dataToConfirm.temEstorno || dataToConfirm.valorEstorno > 0) ? `<div class="row" style="color:#d32f2f; font-weight:bold;"><span>(-) Estorno Lançado:</span> <span>-${formatCurrencyResult(dataToConfirm.valorEstorno)}</span></div>` : ''}
                                        <div style="flex:1"></div>
                                        <div class="row row-total" style="padding: 5px;"><span>VENDA BRUTA:</span> <span>${formatCurrencyResult(dataToConfirm.valorTotal)}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div class="box">
                                <div class="box-title">Cálculo de Comissões</div>
                                <div class="box-content">
                                    <div class="row"><span>Comissão Venda (10%):</span> <span style="font-size:14px;">${formatCurrencyResult(dataToConfirm.comissao10)}</span></div>
                                    <div class="row"><span>Cashless (4%):</span> <span style="font-size:14px;">${formatCurrencyResult(dataToConfirm.comissao4)}</span></div>
                                    <div style="flex:1"></div>
                                    <div class="row row-total" style="padding: 5px; background-color: rgba(240, 240, 240, 0.9);"><span>TOTAL COMISSÃO:</span> <span style="font-size:13px;">${formatCurrencyResult(dataToConfirm.comissaoTotal)}</span></div>
                                </div>
                            </div>

                            <div class="box">
                                <div class="box-title">Acerto Financeiro</div>
                                <div class="box-content" style="justify-content: space-between;">
                                    <div class="result-container">
                                        <div class="result-label">${dataToConfirm.diferencaLabel}</div>
                                        <div class="result-value">${formatCurrencyResult(dataToConfirm.diferencaPagarReceber)}</div>
                                    </div>
                                    ${a4PaymentBlock}
                                </div>
                            </div>
                        </div>

                        <div class="footer-sigs">
                            <div class="sig-block"><div class="sig-line">${dataToConfirm.waiterName}</div></div>
                            <div class="sig-block"><div class="sig-line">Assinatura do Conferente</div></div>
                        </div>
                        <div class="system-footer">Sis.Versão: ${APP_VERSION || '1.0'} | Impresso em: ${printTime}</div>
                    </div>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                    <script>
                        JsBarcode("#barcodeA4", "${dataToConfirm.protocol}", {format: "CODE128", displayValue: false, height: 25, width: 1, margin: 0});
                        window.onload = function() { window.print(); }
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
        if (!selectedWaiter) { setAlertMessage('Por favor, selecione um garçom válido da lista.'); return; }
        if (!numeroMaquina.trim()) { setAlertMessage('Por favor, preencha o número da máquina.'); return; }

        const eventName = localStorage.getItem('activeEvent') || 'N/A';
        const operatorName = localStorage.getItem('loggedInUserName') || 'N/A';
        
        const closingData = {
            type: 'waiter', 
            subType: '8_percent', 
            timestamp: timestamp || new Date().toISOString(), 
            protocol, eventName, operatorName, 
            cpf: selectedWaiter.cpf,
            waiterName: selectedWaiter.name,
            // ADICIONADO: Vincula os dados bancários e de contato diretamente ao salvamento
            chavePix: selectedWaiter.pix || '',
            tipoPix: selectedWaiter.tipo_pix || '',
            telefone: selectedWaiter.telefone || '',
            numeroCamiseta, 
            numeroMaquina, 
            valorTotal: getNumericValue(valorTotal), 
            credito: getNumericValue(credito),
            debito: getNumericValue(debito), 
            pix: getNumericValue(pix), 
            cashless: getNumericValue(cashless),
            temEstorno, 
            valorEstorno: getNumericValue(valorEstorno),
            
            comissao8: 0, // Não usado aqui, define 0
            comissao10, 
            comissao4, 
            comissaoTotal, 
            
            valorTotalAcerto, 
            diferencaLabel, 
            diferencaPagarReceber,
        };
        setDataToConfirm(closingData); 
        setModalState('confirm'); 
        setModalVisible(true); 
    };

    const handleConfirmAndSave = async () => {
        setModalState('saving');
        try {
            const response = await saveWaiterClosing(dataToConfirm);
            const savedData = response.data || response; 
            setDataToConfirm(prev => ({ ...prev, ...savedData }));
            setModalState('success');
        } catch (error) {
            setAlertMessage('Ocorreu um erro ao salvar o fechamento.');
            setModalVisible(false);
        }
    };
    
    const resetForm = () => {
        setProtocol(null); setTimestamp(null); setSelectedWaiter(null); setSearchInput('');
        setNumeroCamiseta(''); setNumeroMaquina(''); setTemEstorno(false); setValorEstorno('');
        setValorTotal(''); setCredito(''); setDebito(''); setPix(''); setCashless('');
    };

    const handleRegisterNew = () => { setModalVisible(false); resetForm(); };
    const handleBackToMenu = () => { navigate('/financial-selection'); };
    
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
                <h1>{protocol ? 'Editar Fechamento' : 'Fechamento Garçom 10%'}</h1>
                
                {/* Inputs do Formulário */}
                <div className="form-section" style={{display: 'block'}}>
                    {/* LINHA 1: Busca ou Crachá Preenchido */}
                    <div className="form-row">
                        {!selectedWaiter ? (
                            <div className="input-group" style={{ width: '100%' }}>
                                <label>Buscar Garçom (Nome/CPF)</label>
                                <input ref={formRefs.cpf} onKeyDown={(e) => handleKeyDown(e, 'numeroCamiseta')} value={searchInput} onChange={(e) => {setSearchInput(e.target.value); setSelectedWaiter(null);}} disabled={!!protocol} placeholder="Digite o nome ou CPF..." />
                                {filteredWaiters.length > 0 && (
                                    <div className="suggestions-list">
                                        {filteredWaiters.map((w, index) => (
                                            <div key={`sug-${index}`} className="suggestion-item" onClick={() => handleSelectWaiter(w)}>
                                                {w.name || w.nome} - {w.cpf}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showRegisterButton && <button className="login-button" style={{marginTop: 10, backgroundColor: '#5bc0de'}} onClick={() => setRegisterModalVisible(true)}>Cadastrar Novo Garçom?</button>}
                            </div>
                        ) : (
                            <div className="input-group" style={{ width: '100%' }}>
                                <label>Garçom Selecionado</label>
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
                                            {selectedWaiter.name || selectedWaiter.nome}
                                        </span>
                                        
                                        {!protocol && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setSelectedWaiter(null); setSearchInput(''); setTimeout(() => formRefs.cpf.current?.focus(), 100); }}
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
                                            <strong>CPF:</strong> {selectedWaiter.cpf}
                                        </div>
                                        {selectedWaiter.pix ? (
                                            <div style={{ fontSize: '1.05rem' }}>
                                                <strong>PIX:</strong> {selectedWaiter.pix} ({selectedWaiter.tipo_pix})
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

                    {/* LINHA 2: Campos Isolados */}
                    <div className="form-row" style={{ marginTop: '10px' }}>
                        <div className="input-group">
                            <label>Número da Camiseta</label>
                            <input ref={formRefs.numeroCamiseta} onKeyDown={(e) => handleKeyDown(e, 'numeroMaquina')} value={numeroCamiseta} onChange={(e) => setNumeroCamiseta(e.target.value)} placeholder="Ex: 45" />
                        </div>
                        <div className="input-group">
                            <label>Número da Máquina</label>
                            <input ref={formRefs.numeroMaquina} onKeyDown={(e) => handleKeyDown(e, 'valorTotal')} value={numeroMaquina} onChange={(e) => setNumeroMaquina(e.target.value.toUpperCase())} placeholder="Ex: A1" />
                        </div>
                    </div>
                </div>
                
                <div className="form-section" style={{ display: 'block' }}>
                    <div className="form-row">
                        <div className="input-group"><label>Valor Total da Venda</label><input ref={formRefs.valorTotal} onKeyDown={(e) => handleKeyDown(e, temEstorno ? 'valorEstorno' : 'credito')} value={formatCurrencyInput(valorTotal)} onChange={(e) => handleCurrencyChange(setValorTotal, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                         <div className="switch-container"><label>Houve Estorno Manual?</label><label className="switch"><input type="checkbox" checked={temEstorno} onChange={() => setTemEstorno(!temEstorno)} /><span className="slider round"></span></label></div>
                    </div>
                    {temEstorno && ( <div className="input-group" style={{marginTop: '15px'}}><label>Valor do Estorno</label><input ref={formRefs.valorEstorno} onKeyDown={(e) => handleKeyDown(e, 'credito')} value={formatCurrencyInput(valorEstorno)} onChange={(e) => handleCurrencyChange(setValorEstorno, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>)}
                    <div className="form-row">
                        <div className="input-group"><label>Crédito</label><input ref={formRefs.credito} onKeyDown={(e) => handleKeyDown(e, 'debito')} value={formatCurrencyInput(credito)} onChange={(e) => handleCurrencyChange(setCredito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Débito</label><input ref={formRefs.debito} onKeyDown={(e) => handleKeyDown(e, 'pix')} value={formatCurrencyInput(debito)} onChange={(e) => handleCurrencyChange(setDebito, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                     <div className="form-row">
                        <div className="input-group"><label>PIX</label><input ref={formRefs.pix} onKeyDown={(e) => handleKeyDown(e, 'cashless')} value={formatCurrencyInput(pix)} onChange={(e) => handleCurrencyChange(setPix, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                        <div className="input-group"><label>Cashless</label><input ref={formRefs.cashless} onKeyDown={(e) => handleKeyDown(e, 'saveButton')} value={formatCurrencyInput(cashless)} onChange={(e) => handleCurrencyChange(setCashless, e.target.value)} placeholder="0,00" inputMode="numeric" /></div>
                    </div>
                </div>
                
                {/* Resultados Detalhados */}
                <div className="results-container">
                    <p>Comissão (10%): <strong>{formatCurrencyResult(comissao10)}</strong></p>
                    <p>Comissão (4%): <strong>{formatCurrencyResult(comissao4)}</strong></p>
                    <hr/>
                    <p className="total-text">Comissão Total: <strong>{formatCurrencyResult(comissaoTotal)}</strong></p>
                    <p className="total-text">{diferencaLabel}: <strong className="final-value" style={{ color: diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>{formatCurrencyResult(diferencaPagarReceber)}</strong></p>
                    <button ref={formRefs.saveButton} className="login-button" onClick={handleOpenConfirmation}>SALVAR E FINALIZAR</button>
                </div>
            </div>
            
            {/* Modais */}
            {registerModalVisible && (<div className="modal-overlay"><div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}><h2>Cadastrar Novo Garçom</h2><div className="input-group"><label>CPF</label><input type="text" value={formatCpf(searchInput)} readOnly /></div><div className="input-group"><label>Nome do Garçom</label><input type="text" value={newWaiterName} onChange={(e) => setNewWaiterName(e.target.value)} placeholder="Digite o nome completo" /></div><div className="modal-buttons"><button className="cancel-button" onClick={() => setRegisterModalVisible(false)}>Cancelar</button><button className="login-button" onClick={handleRegisterNewWaiter}>Salvar</button></div></div></div>)}
            
            {modalVisible && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: '30px' }}>
                        {modalState === 'confirm' && ( <>
                            <h2>Deseja Confirmar o Fechamento?</h2>
                            {dataToConfirm && ( <>
                                <p><strong>Evento:</strong> {dataToConfirm.eventName}</p>
                                <p><strong>Garçom:</strong> {dataToConfirm.waiterName}</p>
                                {/* ADICIONADO: Exibição no Modal de Confirmação */}
                                {dataToConfirm.chavePix && <p><strong>Chave PIX:</strong> {dataToConfirm.chavePix} ({dataToConfirm.tipoPix})</p>}
                                <p><strong>Nº Camisa:</strong> {dataToConfirm.numeroCamiseta}</p>
                                <p><strong>Nº Máquina:</strong> {dataToConfirm.numeroMaquina}</p>
                                <hr />
                                <p>Valor Total da Venda: <strong>{formatCurrencyResult(dataToConfirm.valorTotal)}</strong></p>
                                <p>Comissão Total: <strong>{formatCurrencyResult(dataToConfirm.comissaoTotal)}</strong></p>
                                <p>Valor Total de Acerto: <strong>{formatCurrencyResult(dataToConfirm.valorTotalAcerto)}</strong></p>
                                <hr />
                                <p className="total-text">{dataToConfirm.diferencaLabel}: <strong style={{ color: dataToConfirm.diferencaLabel === 'Pagar ao Garçom' ? 'blue' : 'red' }}>{formatCurrencyResult(dataToConfirm.diferencaPagarReceber)}</strong></p>
                            </>)}
                            <div className="modal-buttons">
                                <button className="cancel-button" onClick={() => setModalVisible(false)}>Não</button>
                                <button className="login-button" onClick={handleConfirmAndSave}>Sim, Salvar</button>
                            </div>
                        </>)}
                        
                        {modalState === 'saving' && ( <><div className="spinner"></div><p style={{marginTop: '20px', fontSize: '18px'}}>Salvando fechamento...</p></>)}
                        
                        {/* ESTADO FINAL COM AS DUAS OPÇÕES DE IMPRESSÃO */}
                        {modalState === 'success' && ( 
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <div className="success-checkmark"><div className="check-icon"><span className="icon-line line-tip"></span><span className="icon-line line-long"></span><div className="icon-circle"></div><div className="icon-fix"></div></div></div>
                                <h2>Fechamento Salvo com Sucesso!</h2>
                                <p>Protocolo Local: <strong>{dataToConfirm?.protocol}</strong></p>
                                
                                <div className="modal-buttons" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px', width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                        <button className="login-button" style={{ backgroundColor: '#FF9800', flex: 1, padding: '15px 0' }} onClick={() => handlePrint('receipt')}>
                                            <span style={{ fontSize: '16px' }}>🧾 Cupom Fiscal</span>
                                        </button>
                                        <button className="login-button" style={{ backgroundColor: '#2196F3', flex: 1, padding: '15px 0' }} onClick={() => handlePrint('a4')}>
                                            <span style={{ fontSize: '16px' }}>📄 Folha A4 (1/2)</span>
                                        </button>
                                    </div>

                                    <button className="modal-button primary" style={{ width: '100%' }} onClick={handleRegisterNew}>
                                        <span className="button-icon">➕</span> Registrar Novo
                                    </button>
                                    <button className="modal-button secondary" style={{ width: '100%' }} onClick={handleBackToMenu}>
                                        <span className="button-icon">📋</span> Voltar ao Menu
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

export default WaiterClosing10Page;