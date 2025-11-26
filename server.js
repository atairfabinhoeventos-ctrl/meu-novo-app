// server.js (VERSÃO FINAL: RECÁLCULO MATEMÁTICO NO BACKEND)
console.log("--- EXECUTANDO VERSÃO: RECÁLCULO MATEMÁTICO (IGNORA COLUNA ACERTO) ---"); 

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();
const syncingEvents = new Set();

// --- AMBIENTE ---
const isRunningInElectron = !!process.versions['electron'];
const isProduction = process.env.NODE_ENV === 'production';
const isProdElectron = isRunningInElectron && isProduction;
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname;
require('dotenv').config({ path: path.join(resourcesPath, '.env') });

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- PARSER DE DATA EXCEL ---
const excelDateToJSDate = (serial) => {
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;
   const date_info = new Date(utc_value * 1000);
   return date_info;
};

// --- PARSER DE MOEDA ---
const parseSisfoCurrency = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    
    let originalString = String(val).trim();
    if (originalString === '') return 0;

    // Detecção de sinal visual
    const cleanCheck = originalString.replace(/R\$|\s/gi, '');
    const isNegative = cleanCheck.startsWith('-') || (cleanCheck.startsWith('(') && cleanCheck.endsWith(')'));

    let cleanString = originalString;
    if (cleanCheck.startsWith('(') && cleanCheck.endsWith(')')) cleanString = cleanString.replace(/[()]/g, '');
    cleanString = cleanString.replace(/[^0-9.,]/g, '');

    const lastPoint = cleanString.lastIndexOf('.');
    const lastComma = cleanString.lastIndexOf(',');

    if (lastComma > lastPoint) {
        cleanString = cleanString.replace(/\./g, '').replace(/,/g, '.');
    } else if (lastPoint > lastComma) {
         cleanString = cleanString.replace(/,/g, '');
    }

    let numberValue = parseFloat(cleanString);
    if (isNaN(numberValue)) return 0;

    return isNegative ? -Math.abs(numberValue) : Math.abs(numberValue);
};

const normalizeToCentavos = (val) => {
    return Math.round(parseSisfoCurrency(val) * 100);
};

// --- GOOGLE SHEETS CLIENT ---
async function getGoogleSheetsClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : undefined,
      keyFilename: process.env.GOOGLE_CREDENTIALS ? undefined : path.join(resourcesPath, 'credentials.json'),
      scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  } catch (error) {
    console.error('Erro Auth Google:', error);
    throw new Error('Falha na autenticação da API do Google Sheets.');
  }
}

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE';
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ';

// --- ROTAS DE ADMIN (Sync Master Data, Update Base, Event Status) ---
// (Mantidas iguais para economizar espaço, lógica não muda)
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.batchGet({ spreadsheetId: spreadsheetId_sync, ranges: ['Garcons!A2:B', 'Eventos!A2:B'] });
        const valueRanges = response.data.valueRanges || [];
        const waiters = (valueRanges[0]?.values || []).map(row => ({ cpf: row[0], name: row[1] }));
        const events = (valueRanges[1]?.values || []).map(row => ({ name: row[0], active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true })).filter(e => e.name);
        res.status(200).json({ waiters, events });
    } catch (error) { res.status(500).json({ message: 'Erro interno.' }); }
});

app.post('/api/update-base', async (req, res) => {
  const { waiters, events } = req.body;
  try {
    const googleSheets = await getGoogleSheetsClient();
    if (waiters && waiters.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A2:A' });
      const existingCpfs = new Set((response.data.values || []).map(row => row[0].trim()));
      const newWaiters = waiters.filter(waiter => waiter.cpf && !existingCpfs.has(waiter.cpf.trim()));
      if (newWaiters.length > 0) {
        const values = newWaiters.map(w => [w.cpf, w.name]);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:B', valueInputOption: 'USER_ENTERED', resource: { values } });
      }
    }
    if (events && events.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A2:A' });
      const existingEventNames = new Set((response.data.values || []).map(row => row[0].trim()));
      const newEvents = events.filter(event => event.name && !existingEventNames.has(event.name.trim()));
      if (newEvents.length > 0) {
        const values = newEvents.map(e => [e.name, e.active ? 'ATIVO' : 'INATIVO']);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A:B', valueInputOption: 'USER_ENTERED', resource: { values } });
      }
    }
    res.status(200).json({ message: 'Base atualizada.' });
  } catch (error) { res.status(500).json({ message: 'Erro ao atualizar base.' }); }
});

app.post('/api/update-event-status', async (req, res) => {
  const { name, active } = req.body;
  try {
    const googleSheets = await getGoogleSheetsClient();
    const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A2:B' });
    const rows = response.data.values || [];
    const eventIndex = rows.findIndex(row => row[0] && row[0].trim() === name.trim());
    if (eventIndex !== -1) {
        await googleSheets.spreadsheets.values.update({ spreadsheetId: spreadsheetId_sync, range: `Eventos!B${eventIndex + 2}`, valueInputOption: 'USER_ENTERED', resource: { values: [[active ? 'ATIVO' : 'INATIVO']] } });
    }
    res.status(200).json({ message: 'Status atualizado.' });
  } catch (error) { res.status(500).json({ message: 'Erro ao atualizar status.' }); }
});


// --- ROTA DE SYNC PARA A NUVEM ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  if (syncingEvents.has(eventName)) return res.status(429).json({ message: `Sync em andamento para ${eventName}.` });
  syncingEvents.add(eventName);

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let counts = { newW: 0, updW: 0, newZ: 0, updZ: 0, newC: 0, updC: 0 };

    const normalWaiters = waiterData ? waiterData.filter(c => c.type !== 'waiter_zig') : [];
    const zigWaiters = waiterData ? waiterData.filter(c => c.type === 'waiter_zig') : [];

    const processSheet = async (data, sheetName, headerRef) => {
        if (!data || data.length === 0) return;
        let sheet = sheets.find(s => s.properties.title === sheetName);
        
        if (!sheet) {
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
        } else {
             const headerCheck = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1:Z1` });
             const currentHeader = headerCheck.data.values ? headerCheck.data.values[0] : [];
             if (headerRef.length > currentHeader.length || headerRef.some((h, i) => currentHeader[i] !== h)) {
                await googleSheets.spreadsheets.values.update({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
             }
        }

        const rows = data.map(c => {
             if (sheetName.includes('Garçom')) {
                 let val = c.diferencaPagarReceber;
                 if (val === undefined || val === null) val = 0;
                 let absVal = Math.abs(parseFloat(val) || 0);
                 const label = String(c.diferencaLabel || '').toLowerCase();
                 let acertoFinal = absVal; 
                 if (label.includes('pagar') || label.includes('faltou')) acertoFinal = -absVal; // Força negativo no envio

                 if (sheetName.includes('GarçomZIG')) {
                     return [c.timestamp, c.protocol, 'waiter_zig', c.cpf, c.waiterName, c.numeroMaquina, c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, c.valorTotalProdutos ?? 0, c.valorEstorno ?? 0, c.comissaoTotal ?? 0, acertoFinal, c.operatorName];
                 } else { 
                     return [c.timestamp, c.protocol, c.type || 'waiter', c.cpf, c.waiterName, c.numeroMaquina, c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, c.cashless ?? 0, c.valorEstorno ?? 0, c.comissaoTotal ?? 0, acertoFinal, c.operatorName];
                 }
             } else { 
                 return [c.protocol, c.timestamp, c.type, c.cpf, c.cashierName, c.numeroMaquina, c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco, c.valorEstorno, c.dinheiroFisico, c.valorAcerto, c.diferenca, c.operatorName];
             }
        });

        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolIdx = sheetName.includes('Caixas') ? 0 : 1; 
        const protocolMap = new Map();
        existingRows.slice(1).forEach((row, idx) => { if(row[protocolIdx]) protocolMap.set(String(row[protocolIdx]).trim(), idx + 2); });

        const toAdd = [], toUpdate = [];
        rows.forEach(row => {
            const p = String(row[protocolIdx]).trim();
            if (protocolMap.has(p)) toUpdate.push({ range: `${sheetName}!A${protocolMap.get(p)}`, values: [row] });
            else toAdd.push(row);
        });

        if (toAdd.length > 0) {
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (sheetName.includes('GarçomZIG')) counts.newZ += toAdd.length; else if (sheetName.includes('Garçons')) counts.newW += toAdd.length; else counts.newC += toAdd.length;
        }
        if (toUpdate.length > 0) {
            await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (sheetName.includes('GarçomZIG')) counts.updZ += toUpdate.length; else if (sheetName.includes('Garçons')) counts.updW += toUpdate.length; else counts.updC += toUpdate.length;
        }
    };

    const headerGarcom = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
    const headerZIG = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Recarga Cashless", "Crédito", "Débito", "Pix", "Valor Total Produtos", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
    const headerCaixa = ["Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Troco", "Devolução/Estorno", "Dinheiro Físico", "Valor Acerto", "Diferença", "Operador"];

    if (normalWaiters.length > 0) await processSheet(normalWaiters, `Garçons - ${eventName}`, headerGarcom);
    if (zigWaiters.length > 0) await processSheet(zigWaiters, `GarçomZIG - ${eventName}`, headerZIG);
    if (cashierData && cashierData.length > 0) await processSheet(cashierData, `Caixas - ${eventName}`, headerCaixa);

    res.status(200).json({ newWaiters: counts.newW, updatedWaiters: counts.updW, newZigWaiters: counts.newZ, updatedZigWaiters: counts.updZ, newCashiers: counts.newC, updatedCashiers: counts.updC });

  } catch (error) { res.status(500).json({ message: 'Erro ao salvar na nuvem.' }); } 
  finally { syncingEvents.delete(eventName); }
});

// --- ROTA DE EXPORTAÇÃO ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' });
  try {
    const googleSheets = await getGoogleSheetsClient();
    const fetchWithExtras = async (sheetName) => {
        try {
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueRenderOption: 'UNFORMATTED_VALUE' });
            if (!response.data.values || response.data.values.length < 2) return [];
            const header = response.data.values[0];
            const rows = response.data.values.slice(1);
            return rows.map(row => {
                const rowData = { eventName };
                header.forEach((key, index) => { rowData[key] = row[index] || ''; });
                if (row.length > header.length) for (let i = header.length; i < row.length; i++) rowData[`EXTRA_${i}`] = row[i];
                return rowData;
            });
        } catch (e) { return []; }
    };
    const waiters = await fetchWithExtras(`Garçons - ${eventName}`);
    const zigWaiters = await fetchWithExtras(`GarçomZIG - ${eventName}`);
    const cashiers = await fetchWithExtras(`Caixas - ${eventName}`);
    if (!waiters.length && !zigWaiters.length && !cashiers.length) return res.status(404).json({ message: 'Nenhum dado encontrado.' });
    res.status(200).json({ waiters, zigWaiters, cashiers });
  } catch (error) { res.status(500).json({ message: 'Erro interno.' }); }
});


// --- ROTA DE HISTÓRICO ONLINE (RECÁLCULO MATEMÁTICO - A CORREÇÃO REAL) ---
app.post('/api/online-history', async (req, res) => {
     const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const waiterSheetName = `Garçons - ${eventName}`;
        const zigSheetName = `GarçomZIG - ${eventName}`;
        const cashierSheetName = `Caixas - ${eventName}`;
        
        // Usamos UNFORMATTED_VALUE para garantir números
        const [waiterResult, zigResult, cashierResult] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName, valueRenderOption: 'UNFORMATTED_VALUE' }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: zigSheetName, valueRenderOption: 'UNFORMATTED_VALUE' }), 
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName, valueRenderOption: 'UNFORMATTED_VALUE' })
        ]);
        
        let allClosings = [];
        
        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
            const [header, ...rows] = waiterResult.value.data.values;
            if (header && rows.length > 0) {
                allClosings.push(...rows.map(row => {
                    const rowObj = {}; header.forEach((key, i) => rowObj[String(key || '').trim().toUpperCase()] = row[i]);
                    
                    // --- RECÁLCULO MATEMÁTICO PARA GARÇOM NORMAL ---
                    const vTotal = parseSisfoCurrency(rowObj['VENDA TOTAL']);
                    const vCredito = parseSisfoCurrency(rowObj['CRÉDITO']);
                    const vDebito = parseSisfoCurrency(rowObj['DÉBITO']);
                    const vPix = parseSisfoCurrency(rowObj['PIX']);
                    const vCashless = parseSisfoCurrency(rowObj['CASHLESS']);
                    const vEstorno = parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']);
                    const vComissao = parseSisfoCurrency(rowObj['COMISSÃO TOTAL']);

                    // Lógica Financeira:
                    // 1. Dinheiro Devido = (Vendas - Estornos) - (Pagamentos Digitais)
                    const vendaLiquida = vTotal - vEstorno;
                    const pagamentosDigitais = vCredito + vDebito + vPix + vCashless;
                    const dinheiroNaMao = vendaLiquida - pagamentosDigitais;

                    // 2. Acerto = Dinheiro na Mão - Comissão
                    // Se positivo: Garçom tem dinheiro sobrando -> Paga ao restaurante
                    // Se negativo: Garçom tem menos dinheiro que a comissão -> Restaurante paga ao garçom
                    // OBS: No seu sistema, a lógica visual é "Receber do Garçom" (Positivo) e "Pagar ao Garçom" (Negativo).
                    // Vamos manter a lógica do cálculo original da tela WaiterClosingPage:
                    // diferenca = dinheiroDevido - comissaoTotal
                    const diferencaCalculada = dinheiroNaMao - vComissao;

                    // Tolerância pequena para erro de ponto flutuante
                    const isPagar = diferencaCalculada < -0.01;

                    return {
                        type: rowObj['TIPO'] || 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'], valorTotal: vTotal, 
                        valorEstorno: vEstorno, comissaoTotal: vComissao,
                        
                        // IGNORA A COLUNA ACERTO, USA O CÁLCULO
                        diferencaPagarReceber: Math.abs(diferencaCalculada), 
                        diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                        
                        credito: vCredito, debito: vDebito, pix: vPix, cashless: vCashless,
                        valorTotalProdutos: 0, numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        operatorName: rowObj['OPERADOR'], timestamp: rowObj['DATA'],
                    };
                }));
            }
        }

        if (zigResult.status === 'fulfilled' && zigResult.value.data.values) {
            const [header, ...rows] = zigResult.value.data.values;
            if (header && rows.length > 0) {
                allClosings.push(...rows.map(row => {
                    const rowObj = {}; header.forEach((key, i) => rowObj[String(key || '').trim().toUpperCase()] = row[i]);
                    
                    // --- RECÁLCULO MATEMÁTICO PARA ZIG ---
                    const vRecarga = parseSisfoCurrency(rowObj['RECARGA CASHLESS']);
                    const vCredito = parseSisfoCurrency(rowObj['CRÉDITO']);
                    const vDebito = parseSisfoCurrency(rowObj['DÉBITO']);
                    const vPix = parseSisfoCurrency(rowObj['PIX']);
                    const vEstorno = parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']);
                    const vComissao = parseSisfoCurrency(rowObj['COMISSÃO TOTAL']);
                    const vProd = parseSisfoCurrency(rowObj['VALOR TOTAL PRODUTOS']);

                    // Lógica ZIG (igual à normal para o acerto financeiro)
                    const vendaLiquida = vRecarga - vEstorno;
                    const pagamentosDigitais = vCredito + vDebito + vPix; // Cashless não entra aqui como pgto, é o produto
                    const dinheiroNaMao = vendaLiquida - pagamentosDigitais;
                    
                    const diferencaCalculada = dinheiroNaMao - vComissao;
                    const isPagar = diferencaCalculada < -0.01;

                    return {
                        type: 'waiter_zig', cpf: rowObj['CPF'], waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'], valorTotal: vRecarga, 
                        valorEstorno: vEstorno, comissaoTotal: vComissao,
                        
                        // IGNORA A COLUNA ACERTO, USA O CÁLCULO
                        diferencaPagarReceber: Math.abs(diferencaCalculada),
                        diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                        
                        credito: vCredito, debito: vDebito, pix: vPix, cashless: 0, 
                        valorTotalProdutos: vProd, 
                        numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        operatorName: rowObj['OPERADOR'], timestamp: rowObj['DATA'],
                    };
                }));
            }
        }
        
        if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) {
            const [header, ...rows] = cashierResult.value.data.values;
            if (header && rows.length > 0) {
                allClosings.push(...rows.map(row => {
                    const rowObj = {}; header.forEach((key, i) => rowObj[String(key || '').trim().toUpperCase()] = row[i]);
                    const type = rowObj['TIPO'] || '';
                    const protocol = rowObj['PROTOCOLO'] || '';
                    
                    // Para caixas, mantemos a leitura direta pois não temos todos os componentes do acerto no histórico simplificado
                    // Mas aplicamos a detecção de sinal rigorosa
                    const difValRaw = rowObj['DIFERENÇA'] || rowObj['DIFERENCA'];
                    const difVal = parseSisfoCurrency(difValRaw);
                    
                    const base = {
                        protocol, eventName, operatorName: rowObj['OPERADOR'], timestamp: rowObj['DATA'], cpf: rowObj['CPF'],
                        cashierName: rowObj['NOME DO CAIXA'], numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        valorTotalVenda: parseSisfoCurrency(rowObj['VENDA TOTAL']), credito: parseSisfoCurrency(rowObj['CRÉDITO']),
                        debito: parseSisfoCurrency(rowObj['DÉBITO']), pix: parseSisfoCurrency(rowObj['PIX']),
                        cashless: parseSisfoCurrency(rowObj['CASHLESS']), valorTroco: parseSisfoCurrency(rowObj['TROCO']),
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']), dinheiroFisico: parseSisfoCurrency(rowObj['DINHEIRO FÍSICO']),
                        valorAcerto: parseSisfoCurrency(rowObj['VALOR ACERTO']), 
                        diferenca: difVal, 
                        temEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']) > 0
                    };
                    if (type.toUpperCase() === 'FIXO') {
                        return { ...base, type: 'individual_fixed_cashier', groupProtocol: protocol.includes('-') ? protocol.split('-')[0] : protocol };
                    } else {
                        return { ...base, type: 'cashier' };
                    }
                }).filter(Boolean));
            }
        }

        allClosings.forEach(closing => {
            let finalDate = new Date(0);
            const rawDate = closing.timestamp;
            if (typeof rawDate === 'number') {
                finalDate = excelDateToJSDate(rawDate);
            } else if (typeof rawDate === 'string') {
                const dateString = rawDate;
                let parsedDate = new Date(dateString);
                if (!isNaN(parsedDate) && parsedDate.getFullYear() > 2000) {
                    finalDate = parsedDate;
                } else {
                    const matchBr = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
                    if (matchBr) {
                        const [, day, month, year, hour, minute, second] = matchBr;
                        finalDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`);
                    }
                }
            }
            closing.timestamp = finalDate.toISOString();
        });

        if (allClosings.length === 0) return res.status(404).json({ message: `Nenhum fechamento encontrado.` });
        res.status(200).json(allClosings);
    } catch (error) {
        console.error('Erro history:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
    }
});

// (Outras rotas mantidas: reconcile-yuzer e delete-closing...)
// ...

// --- ROTA DE RECONCILIAÇÃO YUZER ---
app.post('/api/reconcile-yuzer', async (req, res) => {
    // (Lógica mantida, apenas resumida para caber no arquivo)
    // O parser parseSisfoCurrency já está atualizado e será usado aqui também
    // ...
    const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) return res.status(400).json({ message: 'Dados incompletos.' });
  try {
    const googleSheets = await getGoogleSheetsClient();
    const waiterSheetName = `Garçons - ${eventName}`, zigSheetName = `GarçomZIG - ${eventName}`, cashierSheetName = `Caixas - ${eventName}`;
    let sisfoData = new Map();
    const getLast8Digits = (s) => (s ? String(s).replace(/\D/g, '').slice(-8) : '');
    const processSheet = (resp, isW, isZ = false) => {
        if (!resp.data.values || resp.data.values.length < 2) return;
        const [h, ...rows] = resp.data.values;
        const idx = (names) => h.findIndex(x => names.includes(String(x).toUpperCase()));
        const cpfI = idx(['CPF']), nameI = idx(isW?['NOME GARÇOM','GARÇOM']:['NOME DO CAIXA','CAIXA']), machI = idx(['Nº MAQUINA','Nº MÁQUINA','MAQUINA']);
        const totI = idx(isZ?['RECARGA CASHLESS']:['VENDA TOTAL']), credI = idx(['CRÉDITO','CREDITO']), debI = idx(['DÉBITO','DEBITO']), pixI = idx(['PIX']), cashI = idx(['CASHLESS']);
        if (cpfI===-1||nameI===-1||machI===-1) return;
        rows.forEach(r => {
            const cpf = String(r[cpfI]||'').replace(/\D/g,'');
            if(cpf) {
                if(!sisfoData.has(cpf)) sisfoData.set(cpf,[]);
                sisfoData.get(cpf).push({
                    name: r[nameI], machine: getLast8Digits(r[machI]),
                    total: totI!==-1?normalizeToCentavos(r[totI]):0, credit: credI!==-1?normalizeToCentavos(r[credI]):0,
                    debit: debI!==-1?normalizeToCentavos(r[debI]):0, pix: pixI!==-1?normalizeToCentavos(r[pixI]):0,
                    cashless: cashI!==-1?normalizeToCentavos(r[cashI]):0
                });
            }
        });
    };
    const [wR, zR, cR] = await Promise.allSettled([
        googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName, valueRenderOption: 'UNFORMATTED_VALUE' }),
        googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: zigSheetName, valueRenderOption: 'UNFORMATTED_VALUE' }),
        googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName, valueRenderOption: 'UNFORMATTED_VALUE' })
    ]);
    if (wR.status==='fulfilled') processSheet(wR.value, true);
    if (zR.status==='fulfilled') processSheet(zR.value, true, true);
    if (cR.status==='fulfilled') processSheet(cR.value, false);
    
    let divergences=[], totemsFound=0, recordsCompared=0, unmatchedYuzerRecords=0;
    yuzerData.forEach(y => {
        if (String(y['Operador de Caixa']||'').toLowerCase().includes('pdv')) { totemsFound++; return; }
        const cpf = String(y['CPF']||'').replace(/\D/g,''), serial = y['Serial'];
        const machineKey = getLast8Digits(serial);
        if(!cpf||!machineKey) return;
        if(!sisfoData.has(cpf)) { unmatchedYuzerRecords++; return; }
        const recs = sisfoData.get(cpf), rIdx = recs.findIndex(r => r.machine===machineKey);
        if(rIdx===-1) { unmatchedYuzerRecords++; return; }
        recordsCompared++;
        const sRec = recs[rIdx];
        const yRec = { total: normalizeToCentavos(y['Total']), credit: normalizeToCentavos(y['Crédito']), debit: normalizeToCentavos(y['Débito']), pix: normalizeToCentavos(y['Pix']), cashless: normalizeToCentavos(y['Cashless']) };
        const check = (f, yV, sV) => { if(Math.abs(yV-sV)>0.01) divergences.push({ name: sRec.name, cpf, machine: machineKey, field: f, yuzerValue: (yV/100).toFixed(2), sisfoValue: (sV/100).toFixed(2) }); };
        check('Valor Total', yRec.total, sRec.total); check('Crédito', yRec.credit, sRec.credit); check('Débito', yRec.debit, sRec.debit); check('PIX', yRec.pix, sRec.pix); check('Cashless', yRec.cashless, sRec.cashless);
        recs.splice(rIdx, 1);
    });
    res.status(200).json({ recordsCompared, totemsFound, unmatchedYuzerRecords, divergencesFound: divergences.length, divergences });
  } catch (e) { res.status(500).json({ message: 'Erro conciliação.' }); }
});

app.post('/api/delete-closing', async (req, res) => {
    // (Lógica de delete mantida igual)
    const { eventName, protocolToDelete, password } = req.body;
    if (!eventName || !protocolToDelete) return res.status(400).json({ message: 'Dados incompletos.' });
    if (password && password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Senha incorreta.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = spreadsheetId_cloud_sync;
        const isZig = protocolToDelete.startsWith('GZ-'), isWaiter = protocolToDelete.startsWith('G8-') || protocolToDelete.startsWith('G10-');
        const sheetName = isZig ? `GarçomZIG - ${eventName}` : (isWaiter ? `Garçons - ${eventName}` : `Caixas - ${eventName}`);
        const colIdx = isZig || isWaiter ? 1 : 0;
        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return res.status(404).json({ message: `Registro não encontrado.` });
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!${String.fromCharCode(65+colIdx)}:${String.fromCharCode(65+colIdx)}` });
        const rows = response.data.values || [];
        const toDel = [];
        rows.forEach((r, i) => { if (r[0] && (String(r[0]).trim() === protocolToDelete || String(r[0]).trim().startsWith(protocolToDelete+'-'))) toDel.push(i); });
        if (toDel.length === 0) return res.status(404).json({ message: 'Registro não encontrado.' });
        toDel.sort((a,b)=>b-a);
        const requests = toDel.map(i => ({ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: i, endIndex: i+1 } } }));
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
        res.status(200).json({ message: 'Registro excluído.' });
    } catch (e) { res.status(500).json({ message: 'Erro ao excluir.' }); }
});

module.exports = app;
if (!isRunningInElectron) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Backend rodando na porta ${PORT}`));
}