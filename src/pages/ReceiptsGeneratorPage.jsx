import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { formatCurrencyInput, formatCurrencyResult, formatCpf } from '../utils/formatters';
import AlertModal from '../components/AlertModal.jsx';
import './ReceiptsGeneratorPage.css';

// Função auxiliar para número por extenso
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

// Função para formatar data do evento por extenso
const formatDateToExtenso = (dateStr) => {
    if (!dateStr) return "";
    let parts = dateStr.split(/[./-]/);
    let d, m, y;

    if (parts.length === 3) {
        if (parts[0].length === 4) {
            y = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1;
            d = parseInt(parts[2]);
        } else {
            d = parseInt(parts[0]);
            m = parseInt(parts[1]) - 1;
            y = parseInt(parts[2]);
        }
        const dateObj = new Date(y, m, d);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    return dateStr;
};

function ReceiptsGeneratorPage() {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventCity, setEventCity] = useState('');
    
    const [importedData, setImportedData] = useState([]);
    const [fileName, setFileName] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        const storedRoles = JSON.parse(localStorage.getItem('receipt_roles')) || [];
        setRoles(storedRoles);

        const activeEvent = localStorage.getItem('activeEvent') || '';
        if (activeEvent) {
            const parts = activeEvent.split(' - ');
            if (parts.length >= 1) setEventName(parts[0]);
            if (parts.length >= 2) setEventDate(parts[1]);
            if (parts.length >= 3) setEventCity(parts[2]);
        }
    }, []);

    const normalize = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

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
                        id: index,
                        nome: String(nome || '').trim(),
                        cpf: formatCpf(String(cpf || '')),
                        funcao: matchedRole ? matchedRole.role : (String(funcaoRaw || '').trim()),
                        valor: matchedRole ? matchedRole.value : 0,
                        isManual: !matchedRole
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

    const handlePrint = () => {
        if (importedData.length === 0) { setAlertMessage("Nenhum dado para gerar."); return; }
        if (!eventCity) { setAlertMessage("Por favor, preencha a Cidade do evento."); return; }

        const printWindow = window.open('', '', 'width=900,height=600');
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
                padding: 20px 30px; 
                height: 32%; 
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
            }
            
            /* CABEÇALHO REESTRUTURADO PARA LOGO ABSOLUTA */
            .header { 
                position: relative; /* Permite posicionar logo e valor absolutamente */
                display: flex; 
                justify-content: center; /* Centraliza o título */
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
                height: 60px; /* Altura fixa para manter o layout estável */
            }
            
            /* LOGO SOBREPOSTA */
            .logo-img { 
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 150px;  /* Tamanho solicitado */
                opacity: 0.45; /* Transparência solicitada */
                object-fit: contain;
                z-index: 0;
            }
            
            .title { 
                font-size: 24px; 
                font-weight: 900; 
                text-transform: uppercase; 
                text-align: center; 
                z-index: 1;
            }
            
            /* VALOR ABSOLUTO A DIREITA */
            .value-box { 
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                font-size: 18px; 
                font-weight: bold; 
                border: 1px solid #000; 
                padding: 8px 15px; 
                background-color: #f0f0f0;
                min-width: 140px;
                text-align: center;
                z-index: 1;
            }

            .content { 
                flex-grow: 0; 
                font-size: 14px; 
                line-height: 1.6; 
                text-align: justify; 
                margin-bottom: 10px;
            }
            
            .content strong { text-transform: uppercase; }

            /* NOME E CPF - CENTRALIZADO VERTICALMENTE NO ESPAÇO VAZIO */
            .collab-info {
                flex-grow: 1; 
                display: flex;
                flex-direction: column;
                justify-content: center; 
                align-items: flex-start; 
                font-size: 13px;
                font-weight: bold;
                text-transform: uppercase;
                padding-left: 5px;
            }

            .footer-row {
                flex-grow: 0;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }

            .date-loc {
                font-size: 14px;
                margin-bottom: 28px; 
            }

            .signature-box {
                text-align: center;
                width: 250px;
            }
            
            .sig-line { 
                border-top: 1px solid #000; 
                margin-bottom: 5px;
            }
            
            .sig-name {
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }
        `;

        let htmlContent = `<html><head><style>${styles}</style></head><body>`;
        
        // Data formatada baseada na Data do Evento
        const dateExtenso = formatDateToExtenso(eventDate);

        for (let i = 0; i < importedData.length; i += 3) {
            const chunk = importedData.slice(i, i + 3);
            htmlContent += `<div class="page-container">`;
            
            chunk.forEach(rec => {
                const valorExtenso = numeroPorExtenso(rec.valor);
                
                htmlContent += `
                    <div class="receipt-box">
                        <div class="header">
                            <img src="logo.png" class="logo-img" alt="LOGO" onerror="this.style.display='none';" />
                            
                            <div class="title">RECIBO</div>
                            
                            <div class="value-box">${formatCurrencyResult(rec.valor)}</div>
                        </div>
                        
                        <div class="content">
                            Recebi de <strong>FABINHO EVENTOS</strong>, a importância de <strong>${formatCurrencyResult(rec.valor)}</strong> (${valorExtenso}), 
                            referente a 01 - diária na função de <strong>${rec.funcao}</strong> no evento <strong>${eventName}</strong> realizado em <strong>${eventDate}</strong>.
                            <br/>
                            Por ser verdade, firmo o presente recibo dando plena e geral quitação.
                        </div>
                        
                        <div class="collab-info">
                            ${rec.nome.toUpperCase()}<br/>
                            CPF: ${rec.cpf}
                        </div>
                        
                        <div class="footer-row">
                            <div class="date-loc">
                                ${eventCity}, ${dateExtenso}
                            </div>
                            
                            <div class="signature-box">
                                <div class="sig-line"></div>
                                <div class="sig-name">${rec.nome.toUpperCase()}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            htmlContent += `</div>`;
        }
        
        htmlContent += `</body></html>`;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
    };

    return (
        <div className="receipts-container">
            <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
            <div className="page-header">
                <h1>Gerador de Recibos em Massa</h1>
                <button className="back-btn" onClick={() => navigate('/admin')}>Voltar</button>
            </div>

            <div className="config-panel">
                <div className="panel-row">
                    <div className="input-group">
                        <label>Nome do Evento</label>
                        <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label>Data do Evento</label>
                        <input type="text" value={eventDate} onChange={e => setEventDate(e.target.value)} placeholder="dd.mm.aaaa" />
                    </div>
                    <div className="input-group">
                        <label>Cidade (p/ Recibo)</label>
                        <input type="text" value={eventCity} onChange={e => setEventCity(e.target.value)} placeholder="Ex: São Paulo" />
                    </div>
                </div>
            </div>

            <div className="upload-area">
                <input type="file" id="upload-recibos" accept=".xlsx, .xls" onChange={handleFileUpload} style={{display:'none'}} />
                <label htmlFor="upload-recibos" className="upload-label">
                    📂 Importar Lista de Prestadores (.xlsx)
                </label>
                {fileName && <span className="file-name">Arquivo: {fileName}</span>}
            </div>

            {importedData.length > 0 && (
                <div className="preview-section">
                    <div className="preview-header">
                        <h3>Pré-visualização ({importedData.length} registros)</h3>
                        <button className="generate-btn" onClick={handlePrint}>🖨️ Gerar Recibos (PDF)</button>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>CPF</th>
                                    <th>Função (Detectada/Editável)</th>
                                    <th>Valor (R$)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importedData.map(item => (
                                    <tr key={item.id} className={item.isManual ? 'warning-row' : ''}>
                                        <td>{item.nome}</td>
                                        <td>{item.cpf}</td>
                                        <td>
                                            <select 
                                                value={item.funcao} 
                                                onChange={(e) => handleRoleChange(item.id, e.target.value)}
                                                className="role-select"
                                            >
                                                <option value="" disabled>Selecione...</option>
                                                {roles.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
                                                {!roles.some(r => r.role === item.funcao) && item.funcao && (
                                                    <option value={item.funcao}>{item.funcao} (Detectado)</option>
                                                )}
                                            </select>
                                        </td>
                                        <td>
                                            <input 
                                                type="text" 
                                                value={formatCurrencyInput(item.valor * 100)} 
                                                onChange={(e) => handleValueChange(item.id, e.target.value)}
                                                className="value-input"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReceiptsGeneratorPage;