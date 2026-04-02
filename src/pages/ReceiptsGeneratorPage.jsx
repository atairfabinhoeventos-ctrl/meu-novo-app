// src/pages/ReceiptsGeneratorPage.jsx
// VERSÃO DEFINITIVA: RADAR DE CREDENCIADOS INTELIGENTE, VALORES AUTOMÁTICOS E FUNÇÃO EM DESTAQUE

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import './ReceiptsGeneratorPage.css';

// --- FUNÇÕES AUXILIARES ---
const normalize = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const numeroPorExtenso = (vlr) => {
    if (vlr === 0) return "zero reais";

    const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const onzeADezenove = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

    let inteiro = Math.floor(vlr);
    let restos = Math.round((vlr - inteiro) * 100);
    let extenso = "";

    if (inteiro >= 1000) {
        let mil = Math.floor(inteiro / 1000);
        inteiro = inteiro % 1000;
        if (mil === 1) extenso += "um mil";
        else extenso += "mil"; 
        if (inteiro > 0) extenso += (inteiro < 100 || (inteiro % 100 === 0)) ? " e " : ", ";
    }

    if (inteiro >= 100) {
        let c = Math.floor(inteiro / 100);
        if (c === 1 && inteiro % 100 !== 0) extenso += "cento";
        else extenso += centenas[c];
        inteiro = inteiro % 100;
        if (inteiro > 0) extenso += " e ";
    }

    if (inteiro >= 20) {
        let d = Math.floor(inteiro / 10);
        extenso += dezenas[d];
        inteiro = inteiro % 10;
        if (inteiro > 0) extenso += " e ";
    } else if (inteiro >= 10) {
        extenso += onzeADezenove[inteiro - 10];
        inteiro = 0;
    }

    if (inteiro > 0) extenso += unidades[inteiro];
    if (extenso !== "") extenso += " reais";

    if (restos > 0) {
        if (extenso !== "") extenso += " e ";
        if (restos >= 20) {
            let d = Math.floor(restos / 10);
            extenso += dezenas[d];
            restos = restos % 10;
            if (restos > 0) extenso += " e ";
        } else if (restos >= 10) {
            extenso += onzeADezenove[restos - 10];
            restos = 0;
        }
        if (restos > 0) extenso += unidades[restos];
        extenso += " centavos";
    }

    return extenso;
};

const formatDateToExtenso = (dateStr) => {
    if (!dateStr) return "";
    let parts = dateStr.split(/[./-]/);
    let d, m, y;
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            y = parseInt(parts[0]); m = parseInt(parts[1]) - 1; d = parseInt(parts[2]);
        } else {
            d = parseInt(parts[0]); m = parseInt(parts[1]) - 1; y = parseInt(parts[2]);
        }
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    return dateStr;
};

const generateDateOptions = (dateStr) => {
    const options = new Set();
    const today = new Date().toLocaleDateString('pt-BR'); 
    
    if (dateStr) {
        const monthYearMatch = dateStr.match(/\/(\d{2}\/\d{4})/);
        if (monthYearMatch) {
            const monthYear = monthYearMatch[1];
            const daysMatches = dateStr.match(/\b(\d{1,2})\b/g);
            if (daysMatches) {
                daysMatches.forEach(day => {
                    const dayNum = parseInt(day);
                    if (dayNum >= 1 && dayNum <= 31) {
                        options.add(`${String(dayNum).padStart(2, '0')}/${monthYear}`);
                    }
                });
            }
        }
        options.add(dateStr); 
    }
    options.add(today); 
    return Array.from(options);
};

// --- COMPONENTE PRINCIPAL ---
function ReceiptsGeneratorPage() {
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState('app'); 
    const [roles, setRoles] = useState([]);
    const [eventName, setEventName] = useState('');
    const [eventCity, setEventCity] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [eventDate, setEventDate] = useState('');
    const [manualDate, setManualDate] = useState(''); 

    const [groupedWorkers, setGroupedWorkers] = useState({});
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [expandedGroups, setExpandedGroups] = useState({});

    const [importedData, setImportedData] = useState([]);
    const [fileName, setFileName] = useState('');

    useEffect(() => {
        const storedRoles = JSON.parse(localStorage.getItem('master_receipt_roles')) || JSON.parse(localStorage.getItem('receipt_roles')) || [];
        setRoles(storedRoles);

        const activeEvtStr = localStorage.getItem('activeEvent') || '';
        const masterEvents = JSON.parse(localStorage.getItem('master_events')) || [];
        
        const currentEvtObj = masterEvents.find(e => e.nome === activeEvtStr || e.name === activeEvtStr) || {};

        let eName = currentEvtObj.nome || currentEvtObj.name || activeEvtStr;
        let eCity = currentEvtObj.cidade || currentEvtObj.city || currentEvtObj.local || '';
        let eDateStr = currentEvtObj.data || currentEvtObj.date || currentEvtObj.dataEvento || '';

        // Formata data ISO do MongoDB, se aplicável
        let formattedMongoDate = '';
        if (eDateStr) {
            if (eDateStr.includes('T')) {
                const dateObj = new Date(eDateStr);
                const d = String(dateObj.getUTCDate()).padStart(2, '0');
                const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const y = dateObj.getUTCFullYear();
                formattedMongoDate = `${d}/${m}/${y}`;
            } else {
                formattedMongoDate = eDateStr;
            }
        }

        if (!eCity || !formattedMongoDate) {
            const parts = activeEvtStr.split(' - ');
            if (parts.length >= 1) eName = parts[0].trim();
            if (parts.length >= 2 && !formattedMongoDate) formattedMongoDate = parts[1].trim();
            if (parts.length >= 3 && !eCity) eCity = parts[2].trim();
        }

        setEventName(eName);
        setEventCity(eCity);

        const today = new Date().toLocaleDateString('pt-BR');
        const dateOptions = new Set();
        
        if (formattedMongoDate) {
            dateOptions.add(formattedMongoDate); 
            const match = formattedMongoDate.match(/(\d{1,2})\s*(?:e|a|y|&|-|,)\s*(\d{1,2})\/(\d{2})\/(\d{4})/i);
            if (match) {
                const [_, day1, day2, month, year] = match;
                dateOptions.add(`${day1.padStart(2, '0')}/${month}/${year}`);
                dateOptions.add(`${day2.padStart(2, '0')}/${month}/${year}`);
            }
        }
        dateOptions.add(today); 
        
        const datesArray = Array.from(dateOptions);
        setAvailableDates(datesArray);
        setEventDate(datesArray[0]); 

        loadTreeData(activeEvtStr, currentEvtObj, storedRoles);
    }, []);

    const getDefaultValueForRole = (roleName, rolesArray) => {
        if (!roleName) return 0;
        const nRole = normalize(roleName);
        const match = rolesArray.find(r => normalize(r.role) === nRole || nRole.includes(normalize(r.role)));
        return match ? Number(match.value || 0) : 0;
    };

    // MOTOR DE BUSCA INTELIGENTE (ÁRVORE)
    const loadTreeData = (currentEventString, eventObject, rolesArray) => {
        const closings = JSON.parse(localStorage.getItem('localClosings')) || [];
        const masterCredentials = JSON.parse(localStorage.getItem('master_credentials')) || []; 
        const masterWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
        
        const eventNorm = normalize(currentEventString).replace(/\s/g, '');
        
        const groups = {};
        const workersInTree = new Set();

        const addWorker = (role, worker) => {
            const uniqueId = worker.cpf || worker.nome;
            if (!uniqueId || workersInTree.has(uniqueId)) return; 
            
            if (!groups[role]) groups[role] = [];
            groups[role].push(worker);
            workersInTree.add(uniqueId);
        };

        // 1. Puxa quem fechou caixa (Operação Sistema)
        const eventClosings = closings.filter(c => c.eventName === currentEventString);
        eventClosings.forEach(c => {
            if (c.type && c.type.startsWith('waiter')) {
                let role = 'Garçom 8%';
                if (c.type === 'waiter_zig') role = 'Garçom ZIG';
                else if (c.subType === '10_percent') role = 'Garçom 10%';
                
                let valueToPay = c.diferencaLabel === 'Pagar ao Garçom' ? Number(c.diferencaPagarReceber || 0) : 0;
                if (valueToPay === 0) valueToPay = getDefaultValueForRole(role, rolesArray);

                addWorker(role, { 
                    id: c.protocol || Math.random().toString(), 
                    nome: c.waiterName, cpf: c.cpf, valor: valueToPay, funcao: role,
                    pix: c.chavePix, tipoPix: c.tipoPix 
                });
            } else if (c.type === 'cashier' || c.type === 'fixed_cashier') {
                if (Array.isArray(c.caixas)) {
                    c.caixas.forEach((caixa, index) => {
                        addWorker('Caixa Fixo', { 
                            id: caixa.protocol || `${c.protocol}-${index}`, 
                            nome: caixa.cashierName || caixa.name, cpf: caixa.cpf, 
                            valor: getDefaultValueForRole('Caixa Fixo', rolesArray), 
                            funcao: 'Caixa Fixo',
                            pix: caixa.chavePix, tipoPix: caixa.tipoPix 
                        });
                    });
                } else {
                    addWorker('Caixa Móvel', { 
                        id: c.protocol, nome: c.cashierName, cpf: c.cpf, 
                        valor: getDefaultValueForRole('Caixa Móvel', rolesArray), 
                        funcao: 'Caixa Móvel',
                        pix: c.chavePix, tipoPix: c.tipoPix 
                    });
                }
            }
        });

        // 2. FUNÇÃO INTELIGENTE DE CHECAGEM DE ESCALA
        const isEscalado = (person) => {
            const pEvent = normalize(person.evento || person.eventName || person.event).replace(/\s/g, '');
            if (pEvent && (pEvent === eventNorm || pEvent.includes(eventNorm) || eventNorm.includes(pEvent))) return true;
            
            if (Array.isArray(person.eventos)) {
                return person.eventos.some(e => {
                    const eNorm = normalize(e).replace(/\s/g, '');
                    return eNorm === eventNorm || eNorm.includes(eventNorm) || eventNorm.includes(eNorm);
                });
            }
            return false;
        };

        const processCredenciado = (cred) => {
            const role = cred.funcao || cred.role || cred.cargo || (cred.dados && cred.dados.perfil) || 'Credenciado / Staff'; 
            let valorMongo = Number(cred.valor || cred.cache || 0);
            if (valorMongo === 0) valorMongo = getDefaultValueForRole(role, rolesArray);

            const nomeFunc = cred.nome || cred.name || (cred.dados && cred.dados.nome) || 'Sem Nome';
            const cpfFunc = cred.cpf || (cred.dados && cred.dados.cpf) || '';
            const pixFunc = cred.pix || cred.chavePix || (cred.dados && cred.dados.pix) || '';
            const tipoPixFunc = cred.tipoPix || cred.tipo_pix || (cred.dados && cred.dados.tipo_pix) || '';

            addWorker(role, { 
                id: `cred-${Math.random()}`, 
                nome: nomeFunc, 
                cpf: cpfFunc, 
                valor: valorMongo, 
                funcao: role,
                pix: pixFunc, 
                tipoPix: tipoPixFunc 
            });
        };

        // A) Procura nas Coleções Gerais
        masterCredentials.forEach(cred => {
            if (isEscalado(cred)) processCredenciado(cred);
        });

        masterWaiters.forEach(w => {
            if (isEscalado(w)) processCredenciado(w);
        });

        // B) Varredura Profunda no Objeto do Evento
        if (eventObject) {
            Object.keys(eventObject).forEach(key => {
                if (Array.isArray(eventObject[key])) {
                    eventObject[key].forEach(item => {
                        if (item && typeof item === 'object' && (item.nome || item.name || item.cpf || (item.dados && item.dados.nome))) {
                            processCredenciado(item);
                        }
                    });
                }
            });
        }

        setGroupedWorkers(groups);
        const initialExpanded = {};
        Object.keys(groups).forEach(key => initialExpanded[key] = true);
        setExpandedGroups(initialExpanded);
    };

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    const handleSelectWorker = (workerId) => {
        setSelectedWorkers(prev => prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]);
    };

    const handleSelectAllGroup = (groupName, isChecked) => {
        const groupWorkerIds = groupedWorkers[groupName].map(w => w.id);
        if (isChecked) {
            setSelectedWorkers(prev => [...new Set([...prev, ...groupWorkerIds])]);
        } else {
            setSelectedWorkers(prev => prev.filter(id => !groupWorkerIds.includes(id)));
        }
    };

    // --- LÓGICA DO EXCEL ---
    const findRoleMatch = (rawRole) => {
        if (!rawRole) return null;
        const nRole = normalize(rawRole);
        const match = roles.find(r => {
            const nConfig = normalize(r.role);
            return nConfig === nRole || nRole.includes(nConfig) || nConfig.includes(nRole);
        });
        return match || null;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (jsonData.length === 0) {
                    setAlertMessage("Planilha vazia.");
                    return;
                }

                let headerIndex = 0;
                let maxScore = 0;
                const keywords = ['nome', 'prestador', 'favorecido', 'cpf', 'doc', 'funcao', 'cargo', 'atividade'];

                for (let i = 0; i < Math.min(jsonData.length, 25); i++) {
                    const row = jsonData[i];
                    let score = 0;
                    if (Array.isArray(row)) {
                        row.forEach(cell => {
                            if (cell && typeof cell === 'string') {
                                const normCell = normalize(cell);
                                if (keywords.some(k => normCell.includes(k))) score++;
                            }
                        });
                    }
                    if (score > maxScore) { maxScore = score; headerIndex = i; }
                }

                const headers = jsonData[headerIndex];
                const dataRows = jsonData.slice(headerIndex + 1);
                const findCol = (keys) => headers.findIndex(h => h && typeof h === 'string' && keys.some(k => normalize(h).includes(k)));

                const idxName = findCol(['nome', 'prestador', 'favorecido']);
                const idxCpf = findCol(['cpf', 'doc', 'documento']);
                const idxRole = findCol(['funcao', 'cargo', 'atividade', 'servico']);

                const processed = dataRows.map((row, index) => {
                    const nome = idxName !== -1 ? row[idxName] : row[0];
                    const cpf = idxCpf !== -1 ? row[idxCpf] : row[1];
                    const funcaoRaw = idxRole !== -1 ? row[idxRole] : row[2];
                    const matchedRole = findRoleMatch(String(funcaoRaw || ''));
                    
                    return {
                        id: `excel-${index}`,
                        nome: String(nome || '').trim(),
                        cpf: formatCpf(String(cpf || '')),
                        funcao: matchedRole ? matchedRole.role : (String(funcaoRaw || '').trim()),
                        valor: matchedRole ? matchedRole.value : 0,
                        isManual: !matchedRole,
                        pix: '', 
                        tipoPix: ''
                    };
                }).filter(r => r.nome || r.cpf);

                setImportedData(processed);
                setAlertMessage(`Cabeçalho detectado na linha ${headerIndex + 1}. ${processed.length} registros importados.`);

            } catch (error) {
                console.error(error);
                setAlertMessage("Erro ao ler planilha.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleRoleChange = (id, newRoleName) => {
        const roleObj = roles.find(r => r.role === newRoleName);
        const newData = importedData.map(item => item.id === id ? { ...item, funcao: newRoleName, valor: roleObj ? roleObj.value : 0 } : item);
        setImportedData(newData);
    };

    const handleValueChange = (id, newValStr) => {
        const numVal = parseFloat(newValStr.replace(/\D/g, '')) / 100;
        const newData = importedData.map(item => item.id === id ? { ...item, valor: numVal } : item);
        setImportedData(newData);
    };

    // --- LÓGICA DE IMPRESSÃO (3 POR PÁGINA) ---
    const handlePrint = (source) => {
        let dataToPrint = [];
        
        if (source === 'tree') {
            const allWorkers = Object.values(groupedWorkers).flat();
            dataToPrint = allWorkers.filter(w => selectedWorkers.includes(w.id));
            if (dataToPrint.length === 0) { setAlertMessage("Selecione pelo menos um colaborador na árvore."); return; }
        } else {
            dataToPrint = importedData;
            if (dataToPrint.length === 0) { setAlertMessage("Nenhum dado importado para gerar."); return; }
        }

        if (!eventName) { setAlertMessage("Por favor, preencha o Nome do evento."); return; }
        if (!eventCity) { setAlertMessage("Por favor, preencha a Cidade do evento."); return; }
        
        const finalDate = manualDate || eventDate;
        if (!finalDate) { setAlertMessage("Por favor, informe a Data do recibo."); return; }

        const printWindow = window.open('', '', 'width=900,height=600');
        const dateExtenso = formatDateToExtenso(finalDate);
        
        const styles = `
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
            
            .page-container { 
                height: 290mm;
                display: flex; 
                flex-direction: column; 
                justify-content: space-between; 
                page-break-after: always;
                padding-bottom: 5px;
            }
            .page-container:last-child { page-break-after: auto; }
            
            .receipt-box { 
                border: 1px solid #000; 
                padding: 15px 30px; 
                height: 32%; 
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
            }
            
            .header { 
                position: relative; 
                display: flex; justify-content: center; align-items: center;
                margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 8px; height: 60px;
            }
            .logo-img { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 140px; opacity: 0.5; object-fit: contain; z-index: 0; }
            
            .center-title { display: flex; flex-direction: column; align-items: center; z-index: 1; }
            .title { font-size: 22px; font-weight: 900; text-transform: uppercase; text-align: center; line-height: 1; }
            .role-badge { background-color: #333; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
            
            .value-box { position: absolute; right: 0; top: 50%; transform: translateY(-50%); font-size: 16px; font-weight: bold; border: 1px solid #000; padding: 6px 15px; background-color: #f0f0f0; min-width: 140px; text-align: center; z-index: 1; }

            .content { flex-grow: 0; font-size: 13px; line-height: 1.5; text-align: justify; margin-bottom: 5px; }
            .content strong { text-transform: uppercase; }

            .collab-info { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; font-size: 12px; }
            .info-line { display: flex; margin-bottom: 3px; }
            .info-label { width: 90px; font-weight: bold; }
            .info-val { font-weight: bold; text-transform: uppercase; }
            .blank-line { flex-grow: 1; border-bottom: 1px solid #000; margin-left: 5px; position: relative; top: -3px;}

            .footer-row { flex-grow: 0; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 5px;}
            .date-loc { font-size: 13px; margin-bottom: 20px; }
            .signature-box { text-align: center; width: 250px; }
            .sig-line { border-top: 1px solid #000; margin-bottom: 5px; }
            .sig-name { font-size: 11px; font-weight: bold; text-transform: uppercase; }
        `;

        let htmlContent = `<html><head><style>${styles}</style></head><body>`;

        for (let i = 0; i < dataToPrint.length; i += 3) {
            const chunk = dataToPrint.slice(i, i + 3);
            htmlContent += `<div class="page-container">`;
            
            chunk.forEach(rec => {
                const isZero = rec.valor === 0;
                const valorTexto = isZero ? '______________________' : formatCurrencyResult(rec.valor);
                const valorExtenso = isZero ? '________________________________________________' : numeroPorExtenso(rec.valor);
                const pixFormatado = rec.pix ? `${rec.tipoPix}: ${rec.pix}` : 'Não cadastrado';

                htmlContent += `
                    <div class="receipt-box">
                        <div class="header">
                            <img src="logo.png" class="logo-img" alt="LOGO" onerror="this.style.display='none';" />
                            <div class="center-title">
                                <div class="title">RECIBO</div>
                                <div class="role-badge">${rec.funcao}</div>
                            </div>
                            <div class="value-box">${isZero ? 'R$ ' + valorTexto : valorTexto}</div>
                        </div>
                        
                        <div class="content">
                            Recebi de <strong>FABINHO EVENTOS</strong>, a importância de <strong>${isZero ? 'R$ ' + valorTexto : valorTexto}</strong> (${valorExtenso}), 
                            referente a serviços prestados na função de <strong>${rec.funcao}</strong> no evento <strong>${eventName}</strong>.
                            <br/>Por ser verdade, firmo o presente recibo dando plena e geral quitação.
                        </div>
                        
                        <div class="collab-info">
                            <div class="info-line"><span class="info-label">Colaborador:</span> <span class="info-val">${rec.nome}</span></div>
                            <div class="info-line"><span class="info-label">CPF:</span> <span class="info-val">${rec.cpf || 'Não informado'}</span></div>
                            <div class="info-line"><span class="info-label">PIX Atual:</span> <span class="info-val">${pixFormatado}</span></div>
                            <div class="info-line"><span class="info-label">Outro PIX:</span> <div class="blank-line"></div></div>
                        </div>
                        
                        <div class="footer-row">
                            <div class="date-loc">${eventCity}, ${dateExtenso}</div>
                            <div class="signature-box">
                                <div class="sig-line"></div>
                                <div class="sig-name">${rec.nome}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            htmlContent += `</div>`;
        }
        
        htmlContent += `
            <script>
                setTimeout(() => { window.print(); }, 500);
            </script>
            </body></html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="receipts-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="page-header">
                <h1>Gerador de Recibos em Massa</h1>
                <button className="back-btn" onClick={() => navigate(-1)}>Voltar</button>
            </div>

            <div className="config-panel" style={{ marginBottom: '20px' }}>
                <div className="panel-row">
                    <div className="input-group">
                        <label>Nome do Evento</label>
                        <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} />
                    </div>
                    
                    <div className="input-group" style={{ flex: 1 }}>
                        <label>Data Impressa no Recibo</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select 
                                value={eventDate} 
                                onChange={e => setEventDate(e.target.value)}
                                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                {availableDates.map((date, idx) => (
                                    <option key={idx} value={date}>{date}</option>
                                ))}
                            </select>
                            <input 
                                type="text" 
                                value={manualDate} 
                                onChange={e => setManualDate(e.target.value)} 
                                placeholder="Outra data? Digite aqui"
                                style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Cidade</label>
                        <input type="text" value={eventCity} onChange={e => setEventCity(e.target.value)} placeholder="Ex: São Paulo" />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={() => setActiveTab('app')}
                    style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #1E63B8', background: activeTab === 'app' ? '#1E63B8' : '#fff', color: activeTab === 'app' ? '#fff' : '#1E63B8', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                >
                    📱 Equipe Escalada (Árvore)
                </button>
                <button 
                    onClick={() => setActiveTab('excel')}
                    style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #1E63B8', background: activeTab === 'excel' ? '#1E63B8' : '#fff', color: activeTab === 'excel' ? '#fff' : '#1E63B8', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                >
                    📊 Importar Excel (Avulso)
                </button>
            </div>

            {activeTab === 'app' && (
                <div className="tree-wrapper" style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <h3 style={{ marginBottom: '15px', color: '#333', borderBottom: '2px solid #1E63B8', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Selecione os Colaboradores do Evento</span>
                        <button onClick={() => handlePrint('tree')} className="generate-btn" style={{ padding: '8px 20px', fontSize: '1rem', background: selectedWorkers.length === 0 ? '#ccc' : '#198754' }} disabled={selectedWorkers.length === 0}>
                            🖨️ Imprimir Recibos ({selectedWorkers.length})
                        </button>
                    </h3>
                    
                    {Object.keys(groupedWorkers).length === 0 ? (
                        <p style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                            Nenhuma equipe registrada ou escalada para este evento ainda.
                        </p>
                    ) : (
                        Object.keys(groupedWorkers).map(groupName => {
                            const workers = groupedWorkers[groupName];
                            const allSelected = workers.length > 0 && workers.every(w => selectedWorkers.includes(w.id));
                            const isExpanded = expandedGroups[groupName];

                            return (
                                <div key={groupName} style={{ marginBottom: '10px', border: '1px solid #cce5ff', borderRadius: '6px', overflow: 'hidden' }}>
                                    <div style={{ background: '#e8f4fd', padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #b6d4fe' }}>
                                        <input type="checkbox" checked={allSelected} onChange={(e) => handleSelectAllGroup(groupName, e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                        <div onClick={() => toggleGroup(groupName)} style={{ flex: 1, display: 'flex', justifyContent: 'space-between', cursor: 'pointer', color: '#084298', fontWeight: 'bold', fontSize: '1.05rem' }}>
                                            <span>{groupName} ({workers.length})</span>
                                            <span>{isExpanded ? '▲' : '▼'}</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div style={{ background: '#fff', padding: '5px 15px' }}>
                                            {workers.map(worker => (
                                                <label key={worker.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px dashed #eee', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={selectedWorkers.includes(worker.id)} onChange={() => handleSelectWorker(worker.id)} style={{ width: '18px', height: '18px' }}/>
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{worker.nome}</span>
                                                        <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', gap: '15px' }}>
                                                            {worker.cpf && <span>CPF: {worker.cpf}</span>}
                                                            {worker.pix && <span>PIX: {worker.pix}</span>}
                                                        </div>
                                                    </div>
                                                    {worker.valor > 0 && <span style={{ color: '#198754', fontWeight: '900', fontSize: '1.1rem' }}>{formatCurrencyResult(worker.valor)}</span>}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {activeTab === 'excel' && (
                <div className="excel-wrapper" style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <div className="upload-area">
                        <input type="file" id="upload-recibos" accept=".xlsx, .xls" onChange={handleFileUpload} style={{display:'none'}} />
                        <label htmlFor="upload-recibos" className="upload-label">📂 Importar Lista de Prestadores (.xlsx)</label>
                        {fileName && <span className="file-name">Arquivo: {fileName}</span>}
                    </div>

                    {importedData.length > 0 && (
                        <div className="preview-section">
                            <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Pré-visualização ({importedData.length} registros)</h3>
                                <button className="generate-btn" onClick={() => handlePrint('excel')} style={{ padding: '8px 20px', fontSize: '1rem', background: '#198754' }}>🖨️ Gerar Recibos (PDF)</button>
                            </div>
                            
                            <div className="table-responsive">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Nome</th>
                                            <th>CPF</th>
                                            <th>Função (Detectada)</th>
                                            <th>Valor (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importedData.map(item => (
                                            <tr key={item.id} className={item.isManual ? 'warning-row' : ''}>
                                                <td>{item.nome}</td>
                                                <td>{item.cpf}</td>
                                                <td>
                                                    <select value={item.funcao} onChange={(e) => handleRoleChange(item.id, e.target.value)} className="role-select">
                                                        <option value="" disabled>Selecione...</option>
                                                        {roles.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
                                                        {!roles.some(r => r.role === item.funcao) && item.funcao && <option value={item.funcao}>{item.funcao} (Detectado)</option>}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input type="text" value={formatCurrencyInput(item.valor * 100)} onChange={(e) => handleValueChange(item.id, e.target.value)} className="value-input"/>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ReceiptsGeneratorPage;