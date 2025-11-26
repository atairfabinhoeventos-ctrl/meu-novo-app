// server.js (VERSÃO CORRIGIDA: DETECÇÃO ESTRITA DE SINAL)
console.log("--- EXECUTANDO VERSÃO: CORREÇÃO ONLINE PAGAR/RECEBER ---"); 

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();
const syncingEvents = new Set();

// --- LÓGICA DE CAMINHO UNIVERSAL ---
const isRunningInElectron = !!process.versions['electron'];
const isProduction = process.env.NODE_ENV === 'production';
const isProdElectron = isRunningInElectron && isProduction;
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname;
require('dotenv').config({ path: path.join(resourcesPath, '.env') });

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- FUNÇÃO DE PARSE CORRIGIDA (ESTRITA) ---
const parseSisfoCurrency = (val) => {
    // 1. Retorno imediato para números ou nulos
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    
    let originalString = String(val).trim();
    if (originalString === '') return 0;

    // 2. DETECÇÃO DE SINAL ESTRITA
    // Removemos espaços e R$ para analisar a posição do sinal
    const cleanForSignCheck = originalString.replace(/R\$|\s/gi, '');
    
    const isParenthesis = cleanForSignCheck.startsWith('(') && cleanForSignCheck.endsWith(')');
    
    // Verifica se começa ou termina com os símbolos de menos
    const negativeSymbols = ['-', '\u2010', '\u2011', '\u2012', '\u2013', '\u2014', '\u2015', '\u2212'];
    const startsWithMinus = negativeSymbols.some(s => cleanForSignCheck.startsWith(s));
    const endsWithMinus = negativeSymbols.some(s => cleanForSignCheck.endsWith(s));

    const isNegative = isParenthesis || startsWithMinus || endsWithMinus;

    // 3. LIMPEZA PARA FORMATO NUMÉRICO ABSOLUTO
    let cleanString = originalString;

    // Remove parênteses
    if (isParenthesis) cleanString = cleanString.replace(/[()]/g, '');
    
    // Remove R$ e textos
    cleanString = cleanString.replace(/R\$/gi, '').trim();

    // Tratamento de Pontuação (Milhar vs Decimal)
    const lastPoint = cleanString.lastIndexOf('.');
    const lastComma = cleanString.lastIndexOf(',');

    if (lastComma > lastPoint) {
        // Formato BR: 1.000,00 -> 1000.00
        cleanString = cleanString.replace(/\./g, '');
        cleanString = cleanString.replace(/,/g, '.');
    } else if (lastPoint > lastComma) {
         // Formato US: 1,000.00 -> 1000.00
         cleanString = cleanString.replace(/,/g, '');
    }

    // REMOVE TUDO QUE NÃO FOR NÚMERO OU PONTO
    cleanString = cleanString.replace(/[^0-9.]/g, ''); 

    // 4. CONVERSÃO E APLICAÇÃO DO SINAL
    let numberValue = parseFloat(cleanString);
    if (isNaN(numberValue)) return 0;

    // Aplica o negativo
    return isNegative ? -Math.abs(numberValue) : Math.abs(numberValue);
};

const normalizeToCentavos = (val) => {
    const numberValue = parseSisfoCurrency(val);
    return Math.round(numberValue * 100);
};

// Helper híbrido
const getValueHybrid = (rowObj, rowArray, keys, fallbackIndex) => {
    for (const key of keys) {
        if (rowObj[key] !== undefined && String(rowObj[key]).trim() !== '') {
            return rowObj[key];
        }
    }
    if (rowArray && rowArray[fallbackIndex] !== undefined) {
        return rowArray[fallbackIndex];
    }
    return 0;
};

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

// --- ROTAS DE ADMIN ---
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.batchGet({
            spreadsheetId: spreadsheetId_sync,
            ranges: ['Garcons!A2:B', 'Eventos!A2:B'],
        });
        const valueRanges = response.data.valueRanges || [];
        const waiters = (valueRanges[0]?.values || []).map(row => ({ cpf: row[0], name: row[1] }));
        const events = (valueRanges[1]?.values || []).map(row => ({
          name: row[0],
          active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true,
        })).filter(e => e.name);
        res.status(200).json({ waiters, events });
    } catch (error) {
        console.error('Erro master-data:', error);
        res.status(500).json({ message: 'Erro interno ao buscar dados mestre.' });
    }
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
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar base.' });
  }
});

app.post('/api/update-event-status', async (req, res) => {
  const { name, active } = req.body;
  try {
    const googleSheets = await getGoogleSheetsClient();
    const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A2:B' });
    const rows = response.data.values || [];
    const eventIndex = rows.findIndex(row => row[0] && row[0].trim() === name.trim());
    if (eventIndex !== -1) {
        await googleSheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId_sync,
            range: `Eventos!B${eventIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[active ? 'ATIVO' : 'INATIVO']] },
        });
    }
    res.status(200).json({ message: 'Status atualizado.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar status.' });
  }
});


// --- ROTA DE SYNC PARA A NUVEM ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  if (syncingEvents.has(eventName)) {
    return res.status(429).json({ message: `Sync em andamento para ${eventName}.` });
  }
  syncingEvents.add(eventName);
  console.log(`[BACKEND][cloud-sync][${eventName}] Iniciando sync...`);

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
            console.log(`[BACKEND] Criando aba ${sheetName}...`);
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
        } else {
            const headerCheck = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1:Z1` });
            const currentHeader = headerCheck.data.values ? headerCheck.data.values[0] : [];
            const isOutdated = headerRef.length > currentHeader.length || headerRef.some((h, i) => currentHeader[i] !== h);
            
            if (isOutdated) {
                console.log(`[BACKEND] CORRIGINDO CABEÇALHO DA ABA: ${sheetName}`);
                await googleSheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId_cloud_sync,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [headerRef] }
                });
            }
        }

        const rows = data.map(c => {
             if (sheetName.includes('Garçom')) {
                 let val = c.diferencaPagarReceber;
                 if (val === undefined || val === null) val = 0;
                 
                 // Garante envio negativo se o label for pagar
                 let absVal = Math.abs(parseFloat(val) || 0);
                 const label = String(c.diferencaLabel || '').toLowerCase();
                 let acertoFinal = absVal; 
                 if (label.includes('pagar') || label.includes('faltou')) {
                     acertoFinal = -absVal; 
                 }

                 if (sheetName.includes('GarçomZIG')) {
                     return [
                        c.timestamp, c.protocol, 'waiter_zig', c.cpf, c.waiterName, c.numeroMaquina,
                        c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, 
                        c.valorTotalProdutos ?? 0, c.valorEstorno ?? 0, c.comissaoTotal ?? 0, 
                        acertoFinal, c.operatorName
                     ];
                 } else { 
                     return [
                        c.timestamp, c.protocol, c.type || 'waiter', c.cpf, c.waiterName, c.numeroMaquina,
                        c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, c.cashless ?? 0,
                        c.valorEstorno ?? 0, c.comissaoTotal ?? 0, 
                        acertoFinal, c.operatorName
                     ];
                 }
             } else { 
                 return [
                    c.protocol, c.timestamp, c.type, c.cpf, c.cashierName, c.numeroMaquina,
                    c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco,
                    c.valorEstorno, c.dinheiroFisico, c.valorAcerto, 
                    c.diferenca, c.operatorName
                 ];
             }
        });

        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolIdx = sheetName.includes('Caixas') ? 0 : 1; 
        const protocolMap = new Map();
        
        existingRows.slice(1).forEach((row, idx) => {
            if(row[protocolIdx]) protocolMap.set(String(row[protocolIdx]).trim(), idx + 2);
        });

        const toAdd = [], toUpdate = [];
        rows.forEach(row => {
            const p = String(row[protocolIdx]).trim();
            if (protocolMap.has(p)) {
                toUpdate.push({ range: `${sheetName}!A${protocolMap.get(p)}`, values: [row] });
            } else {
                toAdd.push(row);
            }
        });

        if (toAdd.length > 0) {
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (sheetName.includes('GarçomZIG')) counts.newZ += toAdd.length;
            else if (sheetName.includes('Garçons')) counts.newW += toAdd.length;
            else counts.newC += toAdd.length;
        }
        if (toUpdate.length > 0) {
            await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (sheetName.includes('GarçomZIG')) counts.updZ += toUpdate.length;
            else if (sheetName.includes('Garçons')) counts.updW += toUpdate.length;
            else counts.updC += toUpdate.length;
        }
    };

    const headerGarcom = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
    const headerZIG = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Recarga Cashless", "Crédito", "Débito", "Pix", "Valor Total Produtos", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
    const headerCaixa = ["Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Troco", "Devolução/Estorno", "Dinheiro Físico", "Valor Acerto", "Diferença", "Operador"];

    if (normalWaiters.length > 0) await processSheet(normalWaiters, `Garçons - ${eventName}`, headerGarcom);
    if (zigWaiters.length > 0) await processSheet(zigWaiters, `GarçomZIG - ${eventName}`, headerZIG);
    if (cashierData && cashierData.length > 0) await processSheet(cashierData, `Caixas - ${eventName}`, headerCaixa);

    res.status(200).json({ 
        newWaiters: counts.newW, updatedWaiters: counts.updW, 
        newZigWaiters: counts.newZ, updatedZigWaiters: counts.updZ, 
        newCashiers: counts.newC, updatedCashiers: counts.updC 
    });

  } catch (error) {
    console.error('Erro no sync:', error);
    res.status(500).json({ message: 'Erro ao salvar na nuvem.' });
  } finally {
      syncingEvents.delete(eventName);
  }
});


// --- ROTA DE EXPORTAÇÃO ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const fetchWithExtras = async (sheetName) => {
        try {
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            if (!response.data.values || response.data.values.length < 2) return [];
            const header = response.data.values[0];
            const rows = response.data.values.slice(1);
            return rows.map(row => {
                const rowData = { eventName };
                header.forEach((key, index) => { rowData[key] = row[index] || ''; });
                if (row.length > header.length) {
                    for (let i = header.length; i < row.length; i++) {
                        rowData[`EXTRA_${i}`] = row[i];
                    }
                }
                return rowData;
            });
        } catch (e) { return []; }
    };
    const waiters = await fetchWithExtras(`Garçons - ${eventName}`);
    const zigWaiters = await fetchWithExtras(`GarçomZIG - ${eventName}`);
    const cashiers = await fetchWithExtras(`Caixas - ${eventName}`);

    if (!waiters.length && !zigWaiters.length && !cashiers.length) {
        return res.status(404).json({ message: 'Nenhum dado encontrado.' });
    }
    res.status(200).json({ waiters, zigWaiters, cashiers });
  } catch (error) {
    console.error('Erro export:', error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});


// --- ROTA DE HISTÓRICO ONLINE (LEITURA COM NOVA FUNÇÃO BLINDADA) ---
app.post('/api/online-history', async (req, res) => {
     const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const waiterSheetName = `Garçons - ${eventName}`;
        const zigSheetName = `GarçomZIG - ${eventName}`;
        const cashierSheetName = `Caixas - ${eventName}`;
        
        const [waiterResult, zigResult, cashierResult] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: zigSheetName }), 
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName })
        ]);
        
        let allClosings = [];
        
        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
            const [header, ...rows] = waiterResult.value.data.values;
            if (header && rows.length > 0) {
                allClosings.push(...rows.map(row => {
                    const rowObj = {}; header.forEach((key, i) => rowObj[String(key || '').trim().toUpperCase()] = row[i]);
                    
                    const valAcertoRaw = getValueHybrid(rowObj, row, ['ACERTO', 'VALOR ACERTO'], 13);
                    const valAcerto = parseSisfoCurrency(valAcertoRaw); // Detecção manual de sinal
                    
                    // LÓGICA CORRIGIDA: < 0 é Pagar, >= 0 é Receber
                    const isPagar = valAcerto < 0;

                    return {
                        type: rowObj['TIPO'] || 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'], valorTotal: parseSisfoCurrency(rowObj['VENDA TOTAL']), 
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']), comissaoTotal: parseSisfoCurrency(rowObj['COMISSÃO TOTAL']),
                        
                        diferencaPagarReceber: Math.abs(valAcerto), // Valor Absoluto para o frontend
                        diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                        
                        credito: parseSisfoCurrency(rowObj['CRÉDITO']), debito: parseSisfoCurrency(rowObj['DÉBITO']),
                        pix: parseSisfoCurrency(rowObj['PIX']), cashless: parseSisfoCurrency(rowObj['CASHLESS']),
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
                    
                    const valAcertoRaw = getValueHybrid(rowObj, row, ['ACERTO', 'VALOR ACERTO'], 13);
                    const valAcerto = parseSisfoCurrency(valAcertoRaw);

                    const isPagar = valAcerto < 0;

                    return {
                        type: 'waiter_zig', cpf: rowObj['CPF'], waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'], valorTotal: parseSisfoCurrency(rowObj['RECARGA CASHLESS']), 
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']), comissaoTotal: parseSisfoCurrency(rowObj['COMISSÃO TOTAL']),
                        
                        diferencaPagarReceber: Math.abs(valAcerto),
                        diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                        
                        credito: parseSisfoCurrency(rowObj['CRÉDITO']), debito: parseSisfoCurrency(rowObj['DÉBITO']),
                        pix: parseSisfoCurrency(rowObj['PIX']), cashless: 0, 
                        valorTotalProdutos: parseSisfoCurrency(rowObj['VALOR TOTAL PRODUTOS']), 
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
                    
                    const difValRaw = getValueHybrid(rowObj, row, ['DIFERENÇA', 'DIFERENCA'], 15);
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
            const dateString = closing.timestamp;
            let finalDate = new Date(0);
            if (dateString && typeof dateString === 'string') {
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


// --- ROTA DE RECONCILIAÇÃO YUZER (RESTAURADA COMPLETA) ---
app.post('/api/reconcile-yuzer', async (req, res) => {
  const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) {
    return res.status(400).json({ message: 'Nome do evento e dados da planilha são obrigatórios.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const waiterSheetName = `Garçons - ${eventName}`;
    const zigSheetName = `GarçomZIG - ${eventName}`;
    const cashierSheetName = `Caixas - ${eventName}`;
    let sisfoData = new Map();
    const getLast8Digits = (serial) => {
        if (!serial) return '';
        const digitsOnly = String(serial).replace(/\D/g, '');
        return digitsOnly.slice(-8);
    };

    const processSheet = (response, isWaiterSheet, isZigSheet = false) => {
        if (!response.data.values || response.data.values.length < 2) return;
        const [header, ...rows] = response.data.values;
        const findIndex = (headers, possibleNames) => headers.findIndex(h => possibleNames.includes(h.toUpperCase()));
        
        const cpfIndex = findIndex(header, ['CPF']);
        const nameIndex = findIndex(header, isWaiterSheet ? ['NOME GARÇOM', 'GARÇOM'] : ['NOME DO CAIXA', 'CAIXA']);
        const machineIndex = findIndex(header, ['Nº MAQUINA', 'Nº MÁQUINA', 'MAQUINA']);
        const totalIndex = findIndex(header, isZigSheet ? ['RECARGA CASHLESS'] : ['VENDA TOTAL']); 
        
        const creditIndex = findIndex(header, ['CRÉDITO', 'CREDITO']);
        const debitIndex = findIndex(header, ['DÉBITO', 'DEBITO']);
        const pixIndex = findIndex(header, ['PIX']);
        const cashlessIndex = findIndex(header, ['CASHLESS']); 
        
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) return;

        rows.forEach(row => {
            const cpf = row[cpfIndex]?.replace(/\D/g, '');
            if (cpf) {
                if (!sisfoData.has(cpf)) { sisfoData.set(cpf, []); }
                sisfoData.get(cpf).push({
                    name: row[nameIndex],
                    machine: getLast8Digits(row[machineIndex]),
                    total: totalIndex !== -1 ? normalizeToCentavos(row[totalIndex]) : 0,
                    credit: creditIndex !== -1 ? normalizeToCentavos(row[creditIndex]) : 0,
                    debit: debitIndex !== -1 ? normalizeToCentavos(row[debitIndex]) : 0,
                    pix: pixIndex !== -1 ? normalizeToCentavos(row[pixIndex]) : 0,
                    cashless: cashlessIndex !== -1 ? normalizeToCentavos(row[cashlessIndex]) : 0
                });
            }
        });
    };

    try {
        const [waiterRes, zigRes, cashierRes] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A:Z` }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${zigSheetName}!A:Z` }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` })
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true, false); 
        if (zigRes.status === 'fulfilled') processSheet(zigRes.value, true, true); 
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false, false);
    } catch (e) { console.log(`Erro geral ao ler abas SisFO para o evento "${eventName}".`); }

    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`);
    let divergences = [], totemsFound = 0, recordsCompared = 0, unmatchedYuzerRecords = 0;

    yuzerData.forEach((yuzerRow) => {
      const operator = yuzerRow['Operador de Caixa'];
      if (operator && String(operator).toLowerCase().includes('pdv')) { totemsFound++; return; }
      const cpf = String(yuzerRow['CPF'] || '').replace(/\D/g, '');
      const serial = yuzerRow['Serial'];
      if (!cpf || !serial) return;
      const machineKey = getLast8Digits(serial);
      if (!machineKey) return;
      
      if (!sisfoData.has(cpf)) { unmatchedYuzerRecords++; return; }
      const sisfoRecordsForCpf = sisfoData.get(cpf);
      const recordIndex = sisfoRecordsForCpf.findIndex(rec => rec.machine === machineKey);
      if (recordIndex === -1) { unmatchedYuzerRecords++; return; }
      recordsCompared++;
      const sisfoRecord = sisfoRecordsForCpf[recordIndex];

      const yuzerRecord = {
        total: normalizeToCentavos(yuzerRow['Total']),
        credit: normalizeToCentavos(yuzerRow['Crédito']),
        debit: normalizeToCentavos(yuzerRow['Débito']),
        pix: normalizeToCentavos(yuzerRow['Pix']),
        cashless: normalizeToCentavos(yuzerRow['Cashless'])
      };

      const checkDiff = (field, yuzerVal_centavos, sisfoVal_centavos) => {
        if (Math.abs(yuzerVal_centavos - sisfoVal_centavos) > 0.01) {
          divergences.push({
              name: sisfoRecord.name, cpf, machine: machineKey, field,
              yuzerValue: (Math.round(yuzerVal_centavos) / 100).toFixed(2), 
              sisfoValue: (Math.round(sisfoVal_centavos) / 100).toFixed(2) 
            });
        }
      };
      checkDiff('Valor Total', yuzerRecord.total, sisfoRecord.total);
      checkDiff('Crédito', yuzerRecord.credit, sisfoRecord.credit);
      checkDiff('Débito', yuzerRecord.debit, sisfoRecord.debit);
      checkDiff('PIX', yuzerRecord.pix, sisfoRecord.pix);
      checkDiff('Cashless', yuzerRecord.cashless, sisfoRecord.cashless);
      sisfoRecordsForCpf.splice(recordIndex, 1);
    });

    res.status(200).json({
      recordsCompared, totemsFound, unmatchedYuzerRecords,
      divergencesFound: divergences.length, divergences
    });
  } catch (error) {
    console.error('Erro na conciliação Yuzer:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar a conciliação.' });
  }
});


// --- ROTA DE EXCLUSÃO ONLINE ---
app.post('/api/delete-closing', async (req, res) => {
    const { eventName, protocolToDelete, password } = req.body;
    if (!eventName || !protocolToDelete) {
        return res.status(400).json({ message: 'Nome do evento e protocolo são obrigatórios.' });
    }
    if (password && password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Senha incorreta para exclusão online.' });
    }
    
    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = spreadsheetId_cloud_sync;

        const isZigProtocol = protocolToDelete.startsWith('GZ-');
        const isWaiterProtocol = protocolToDelete.startsWith('G8-') || protocolToDelete.startsWith('G10-');

        let sheetName;
        let protocolColumnIndex; 

        if (isZigProtocol) { sheetName = `GarçomZIG - ${eventName}`; protocolColumnIndex = 1; } 
        else if (isWaiterProtocol) { sheetName = `Garçons - ${eventName}`; protocolColumnIndex = 1; } 
        else { sheetName = `Caixas - ${eventName}`; protocolColumnIndex = 0; }

        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) return res.status(404).json({ message: `Registro não encontrado.` });
        const sheetId = sheet.properties.sheetId;

        const rangeToRead = `${sheetName}!${String.fromCharCode(65 + protocolColumnIndex)}:${String.fromCharCode(65 + protocolColumnIndex)}`;
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId, range: rangeToRead });
        const protocolsInSheet = response.data.values || [];

        const rowIndicesToDelete = [];
        protocolsInSheet.forEach((row, index) => {
            if (row && row[0]) {
                const currentProtocol = String(row[0]).trim();
                if (currentProtocol === protocolToDelete || currentProtocol.startsWith(protocolToDelete + '-')) {
                    rowIndicesToDelete.push(index);
                }
            }
        });

        if (rowIndicesToDelete.length === 0) return res.status(404).json({ message: 'Registro não encontrado na planilha online.' });

        rowIndicesToDelete.sort((a, b) => b - a); 
        let requests = [];
        rowIndicesToDelete.forEach(rowIndex => {
            requests.push({
                deleteDimension: {
                    range: { sheetId: sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
                }
            });
        });

        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
        res.status(200).json({ message: `${requests.length} registro(s) excluído(s) com sucesso da planilha online.` });

    } catch (error) {
        console.error(`[BACKEND][delete-closing][${eventName}] Erro:`, error.message);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar excluir o registro online.' });
    }
});

// --- INICIALIZAÇÃO ---
module.exports = app;
if (!isRunningInElectron) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend (Render) rodando na porta ${PORT}`);
  });
} else {
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}