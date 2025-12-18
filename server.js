// server.js (VERSÃO DEFINITIVA: SYNC, HISTORY, EXPORT, EDIT/DELETE (WAITERS), EVENTS (ADD/STATUS), RECEIPT ROLES (PROTECTED))
console.log("--- INICIANDO SERVIDOR: SISTEMA COMPLETO ---");

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();
const syncingEvents = new Set();

// ==========================================
// 1. CONFIGURAÇÃO E AMBIENTE
// ==========================================
const isRunningInElectron = !!process.versions['electron'];
const isProduction = process.env.NODE_ENV === 'production';
const isProdElectron = isRunningInElectron && isProduction;
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname;

require('dotenv').config({ path: path.join(resourcesPath, '.env') });

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ==========================================
// 2. FUNÇÕES AUXILIARES
// ==========================================

// Normalização para comparação (remove acentos, espaços extras e minúsculas)
const normalizeString = (str) => {
    if (!str) return '';
    return String(str).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const parseSisfoCurrency = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    
    let originalString = String(val).trim();
    if (originalString === '') return 0;

    let cleanCheck = originalString.replace(/R\$|\s/gi, '');
    const isNegative = cleanCheck.includes('-') || (cleanCheck.startsWith('(') && cleanCheck.endsWith(')'));

    let cleanString = originalString.replace(/[()]/g, '').replace(/[^0-9.,]/g, '');

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

const excelDateToJSDate = (serial) => {
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;
   return new Date(utc_value * 1000);
};

const getValFromRow = (row, headerMap, possibleKeys) => {
    for (const key of possibleKeys) {
        const idx = headerMap[key.toUpperCase().trim()];
        if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
            return parseSisfoCurrency(row[idx]);
        }
    }
    return 0;
};

const getTextFromRow = (row, headerMap, possibleKeys) => {
    for (const key of possibleKeys) {
        const idx = headerMap[key.toUpperCase().trim()];
        if (idx !== undefined && row[idx] !== undefined) {
            return String(row[idx]).trim();
        }
    }
    return '';
};

// ==========================================
// 3. CLIENTE GOOGLE SHEETS
// ==========================================

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

// IDs das Planilhas
const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE'; // Base de Dados
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ'; // Histórico

// ==========================================
// 4. ROTAS DA APLICAÇÃO
// ==========================================

// --- ROTA 1: OBTER DADOS MESTRE (GARÇONS, EVENTOS E RECIBOS) ---
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.batchGet({
            spreadsheetId: spreadsheetId_sync,
            ranges: ['Garcons!A2:B', 'Eventos!A2:B', 'DadosRecibos!A2:B'], 
        });
        const valueRanges = response.data.valueRanges || [];
        
        // Garçons
        const waiters = (valueRanges[0]?.values || []).map(row => ({ cpf: row[0], name: row[1] }));
        
        // Eventos
        const events = (valueRanges[1]?.values || []).map(row => ({
          name: row[0],
          active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true,
        })).filter(e => e.name);

        // Funções de Recibo
        const receiptRoles = (valueRanges[2]?.values || []).map(row => ({
            role: row[0],
            value: parseSisfoCurrency(row[1])
        })).filter(r => r.role);

        res.status(200).json({ waiters, events, receiptRoles });
    } catch (error) {
        console.error('Erro master-data:', error);
        res.status(500).json({ message: 'Erro interno ao buscar dados mestre.' });
    }
});

// --- ROTA: ADICIONAR FUNÇÃO DE RECIBO (COM SENHA E TRAVA) ---
app.post('/api/add-receipt-role', async (req, res) => {
    const { role, value, password } = req.body;
    
    if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Senha incorreta ou não informada.' });
    }
    if (!role) return res.status(400).json({ message: 'Nome da função obrigatório.' });

    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({ 
            spreadsheetId: spreadsheetId_sync, 
            range: 'DadosRecibos!A:A' 
        });
        
        // Verificação Robusta de Duplicidade
        const normalizedNewRole = normalizeString(role);
        const existingRoles = (response.data.values || []).map(r => r[0] ? normalizeString(r[0]) : '');
        
        if (existingRoles.includes(normalizedNewRole)) {
            return res.status(409).json({ message: 'Função já existe (verifique acentos/maiúsculas).' });
        }

        await googleSheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId_sync,
            range: 'DadosRecibos!A:B',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[role.trim(), value]] }
        });

        res.status(200).json({ message: 'Função adicionada.' });
    } catch (error) {
        console.error('Erro add-receipt-role:', error);
        res.status(500).json({ message: 'Erro ao adicionar função.' });
    }
});

// --- ROTA: EDITAR FUNÇÃO DE RECIBO (COM SENHA E TRAVA) ---
app.post('/api/edit-receipt-role', async (req, res) => {
    const { originalRole, newRole, newValue, password } = req.body;

    if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Senha incorreta ou não informada.' });
    }
    if (!originalRole || !newRole) return res.status(400).json({ message: 'Dados incompletos.' });

    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({ 
            spreadsheetId: spreadsheetId_sync, 
            range: 'DadosRecibos!A:A' 
        });
        const rows = response.data.values || [];

        // Encontra índice (busca normalizada)
        const rowIndex = rows.findIndex(row => row[0] && normalizeString(row[0]) === normalizeString(originalRole));
        if (rowIndex === -1) return res.status(404).json({ message: 'Função original não encontrada.' });

        // Verifica duplicidade se nome mudou
        if (normalizeString(originalRole) !== normalizeString(newRole)) {
            const normalizedNew = normalizeString(newRole);
            const exists = rows.some((row, idx) => idx !== rowIndex && row[0] && normalizeString(row[0]) === normalizedNew);
            if (exists) return res.status(409).json({ message: 'Já existe outra função com esse nome.' });
        }

        const sheetRowNumber = rowIndex + 1;
        await googleSheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId_sync,
            range: `DadosRecibos!A${sheetRowNumber}:B${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[newRole.trim(), newValue]] }
        });

        res.status(200).json({ message: 'Função atualizada.' });
    } catch (error) {
        console.error('Erro edit-receipt-role:', error);
        res.status(500).json({ message: 'Erro ao editar função.' });
    }
});

// --- ROTA: EXCLUIR FUNÇÃO DE RECIBO (COM SENHA) ---
app.post('/api/delete-receipt-role', async (req, res) => {
    const { role, password } = req.body;

    if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Senha incorreta ou não informada.' });
    }
    if (!role) return res.status(400).json({ message: 'Função obrigatória.' });

    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_sync });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'DadosRecibos');
        if (!sheet) return res.status(404).json({ message: 'Aba DadosRecibos não encontrada.' });

        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'DadosRecibos!A:A' });
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] && normalizeString(row[0]) === normalizeString(role));

        if (rowIndex === -1) return res.status(404).json({ message: 'Função não encontrada.' });

        await googleSheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId_sync,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
                    }
                }]
            }
        });
        res.status(200).json({ message: 'Função excluída.' });
    } catch (error) {
        console.error('Erro delete-receipt-role:', error);
        res.status(500).json({ message: 'Erro ao excluir função.' });
    }
});

// --- ROTA 2: ATUALIZAÇÃO EM MASSA (IMPORTAÇÃO VIA EXCEL) ---
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
    res.status(200).json({ message: 'Base atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro update-base:', error);
    res.status(500).json({ message: 'Erro ao atualizar base de dados.' });
  }
});

// --- ROTA 3: EDIÇÃO DE FUNCIONÁRIO ---
app.post('/api/edit-waiter', async (req, res) => {
    const { originalCpf, newCpf, newName } = req.body;
    if (!originalCpf || !newCpf || !newName) return res.status(400).json({ message: 'Dados incompletos.' });

    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:A' });
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] && String(row[0]).trim() === String(originalCpf).trim());

        if (rowIndex === -1) return res.status(404).json({ message: 'Funcionário não encontrado.' });

        const sheetRowNumber = rowIndex + 1;
        await googleSheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId_sync,
            range: `Garcons!A${sheetRowNumber}:B${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[newCpf, newName]] }
        });
        res.status(200).json({ message: 'Atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro edit-waiter:', error);
        res.status(500).json({ message: 'Erro ao editar.' });
    }
});

// --- ROTA 4: EXCLUSÃO DE FUNCIONÁRIO ---
app.post('/api/delete-waiter', async (req, res) => {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ message: 'CPF é obrigatório.' });

    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_sync });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Garcons');
        if (!sheet) return res.status(500).json({ message: 'Aba Garcons não encontrada.' });
        const sheetId = sheet.properties.sheetId;

        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:A' });
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] && String(row[0]).trim() === String(cpf).trim());

        if (rowIndex === -1) return res.status(404).json({ message: 'Funcionário não encontrado na nuvem.' });

        await googleSheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId_sync,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: { sheetId: sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
                    }
                }]
            }
        });

        res.status(200).json({ message: 'Funcionário excluído.' });

    } catch (error) {
        console.error('Erro delete-waiter:', error);
        res.status(500).json({ message: 'Erro ao excluir funcionário.' });
    }
});

// --- ROTA 5: ADICIONAR EVENTO ---
app.post('/api/add-event', async (req, res) => {
    const { name, active } = req.body;
    if (!name) return res.status(400).json({ message: 'Nome obrigatório.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A:A' });
        const existing = (response.data.values || []).map(r => r[0] ? r[0].trim().toUpperCase() : '');
        
        if (existing.includes(name.trim().toUpperCase())) {
            return res.status(409).json({ message: 'Evento já existe.' });
        }

        await googleSheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId_sync,
            range: 'Eventos!A:B',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[name.trim(), active ? 'ATIVO' : 'INATIVO']] }
        });
        res.status(200).json({ message: 'Evento criado.' });
    } catch (error) { res.status(500).json({ message: 'Erro ao criar evento.' }); }
});

// --- ROTA 6: ATUALIZAR STATUS DO EVENTO ---
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
    console.error('Erro update-event-status:', error);
    res.status(500).json({ message: 'Erro ao atualizar status.' });
  }
});

// --- ROTA 7: SYNC PARA A NUVEM (FECHAMENTOS) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  if (syncingEvents.has(eventName)) {
    return res.status(429).json({ message: `Sincronização já em andamento.` });
  }
  syncingEvents.add(eventName);
  console.log(`[SYNC] Iniciando ${eventName}...`);

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let counts = { newW: 0, updW: 0, newZ: 0, updZ: 0, newC: 0, updC: 0 };

    const processSheet = async (data, sheetNameRaw, headerRef) => {
        if (!data || data.length === 0) return;

        const safeSheetName = `'${sheetNameRaw.trim()}'`;

        let sheet = sheets.find(s => s.properties.title === sheetNameRaw.trim());
        if (!sheet) {
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetNameRaw.trim() } } }] } });
            await googleSheets.spreadsheets.values.update({ spreadsheetId: spreadsheetId_cloud_sync, range: `${safeSheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
        } else {
            const hCheck = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${safeSheetName}!A1:Z1` });
            if (!hCheck.data.values || hCheck.data.values[0].length < headerRef.length || hCheck.data.values[0].join(',') !== headerRef.join(',')) {
                await googleSheets.spreadsheets.values.update({ spreadsheetId: spreadsheetId_cloud_sync, range: `${safeSheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
            }
        }

        const isWaiterSheet = sheetNameRaw.includes('Garço') || sheetNameRaw.includes('Garco');

        const rows = data.map(c => {
             if (isWaiterSheet) {
                 let val = c.diferencaPagarReceber;
                 if (val === undefined || val === null) val = 0;
                 let absVal = Math.abs(parseFloat(val) || 0);
                 const label = String(c.diferencaLabel || '').toLowerCase();
                 let acertoFinal = absVal; 
                 if (label.includes('pagar') || label.includes('faltou')) {
                     acertoFinal = -absVal; 
                 }

                 const ts = String(c.timestamp || '').trim();
                 const proto = String(c.protocol || '').trim();
                 const tp = String(c.type || 'waiter').trim();
                 const cpf = String(c.cpf || '').trim();
                 const nome = String(c.waiterName || '').trim();
                 const maq = String(c.numeroMaquina || '').trim();
                 const op = String(c.operatorName || '').trim();
                 const appVer = String(c.appVersion || '').trim();

                 if (sheetNameRaw.includes('GarçomZIG')) {
                     return [
                        ts, proto, 'waiter_zig', cpf, nome, maq,
                        c.valorTotal??0, 
                        c.credito??0, c.debito??0, c.pix??0, 
                        c.valorTotalProdutos??0, c.valorEstorno??0, c.comissaoTotal??0, 
                        acertoFinal, op, appVer
                     ];
                 } else { 
                     return [
                        ts, proto, tp, cpf, nome, maq,
                        c.valorTotal??0, 
                        c.credito??0, c.debito??0, c.pix??0, c.cashless??0,
                        c.valorEstorno??0, 
                        c.comissao8  || 0,
                        c.comissao10 || 0,
                        c.comissao4  || 0,
                        c.comissaoTotal??0, 
                        acertoFinal, op, appVer
                     ];
                 }
             } else { 
                 const ts = String(c.timestamp || '').trim();
                 const proto = String(c.protocol || '').trim();
                 const tp = String(c.type || '').trim();
                 const cpf = String(c.cpf || '').trim();
                 const nome = String(c.cashierName || '').trim();
                 const maq = String(c.numeroMaquina || '').trim();
                 const op = String(c.operatorName || '').trim();
                 const appVer = String(c.appVersion || '').trim();

                 return [
                    proto, ts, tp, cpf, nome, maq,
                    c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco,
                    c.valorEstorno, c.dinheiroFisico, c.valorAcerto, 
                    c.diferenca, op, appVer
                 ];
             }
        });

        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${safeSheetName}!A:A` });
        const existingRows = response.data.values || [];
        
        let nextRowIndex = existingRows.length + 1; 
        if (nextRowIndex < 2) nextRowIndex = 2; 

        const protocolIdx = sheetNameRaw.includes('Caixas') ? 0 : 1; 
        const fullCheck = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${safeSheetName}!A:B` });
        const checkRows = fullCheck.data.values || [];
        
        const protocolMap = new Map();
        checkRows.forEach((row, idx) => {
            if(row[protocolIdx]) protocolMap.set(String(row[protocolIdx]).trim(), idx + 1);
        });

        const toAdd = [], toUpdate = [];
        rows.forEach(row => {
            const p = String(row[protocolIdx]).trim();
            if (protocolMap.has(p)) {
                const rowNum = protocolMap.get(p);
                toUpdate.push({ range: `${safeSheetName}!A${rowNum}`, values: [row] });
            } else {
                toAdd.push(row);
            }
        });

        if (toAdd.length > 0) {
            await googleSheets.spreadsheets.values.update({ 
                spreadsheetId: spreadsheetId_cloud_sync, 
                range: `${safeSheetName}!A${nextRowIndex}`, 
                valueInputOption: 'USER_ENTERED', 
                resource: { values: toAdd } 
            });

            if (sheetNameRaw.includes('GarçomZIG')) counts.newZ += toAdd.length;
            else if (isWaiterSheet) counts.newW += toAdd.length;
            else counts.newC += toAdd.length;
        }
        
        if (toUpdate.length > 0) {
            await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (isWaiterSheet) {
                 if(sheetNameRaw.includes('ZIG')) counts.updZ += toUpdate.length;
                 else counts.updW += toUpdate.length;
            } else {
                 counts.updC += toUpdate.length;
            }
        }
    };

    const headerGarcom = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Devolução/Estorno", "Comissão (8%)", "Comissão (10%)", "Comissão (4%)", "Comissão Total", "Acerto", "Operador", "Versão"];
    const headerZIG = ["Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina", "Recarga Cashless", "Crédito", "Débito", "Pix", "Valor Total Produtos", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador", "Versão"];
    const headerCaixa = ["Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Troco", "Devolução/Estorno", "Dinheiro Físico", "Valor Acerto", "Diferença", "Operador", "Versão"];

    const normalWaiters = waiterData ? waiterData.filter(c => c.type !== 'waiter_zig') : [];
    const zigWaiters = waiterData ? waiterData.filter(c => c.type === 'waiter_zig') : [];

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

// --- ROTA 8: HISTÓRICO ONLINE ---
app.post('/api/online-history', async (req, res) => {
    const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    }
    
    try {
        const googleSheets = await getGoogleSheetsClient();
        const sheetNames = [`Garçons - ${eventName}`, `GarçomZIG - ${eventName}`, `Caixas - ${eventName}`];
        
        const results = await Promise.allSettled(sheetNames.map(sn => 
            googleSheets.spreadsheets.values.get({ 
                spreadsheetId: spreadsheetId_cloud_sync, 
                range: `'${sn}'`, 
                valueRenderOption: 'UNFORMATTED_VALUE' 
            })
        ));

        let allClosings = [];

        const processGenericSheet = (result, typeCategory) => {
            if (result.status === 'fulfilled' && result.value.data.values?.length > 1) {
                const [header, ...rows] = result.value.data.values;
                const headerMap = {};
                header.forEach((col, idx) => {
                    if (col) headerMap[String(col).trim().toUpperCase()] = idx;
                });

                return rows.map(row => {
                    const vTotal = getValFromRow(row, headerMap, ['VENDA TOTAL', 'TOTAL', 'RECARGA CASHLESS', 'RECARGA']);
                    const vCred  = getValFromRow(row, headerMap, ['CRÉDITO', 'CREDITO', 'CREDIT']);
                    const vDeb   = getValFromRow(row, headerMap, ['DÉBITO', 'DEBITO', 'DEBIT']);
                    const vPix   = getValFromRow(row, headerMap, ['PIX']);
                    const vCash  = getValFromRow(row, headerMap, ['CASHLESS']);
                    const vProd  = getValFromRow(row, headerMap, ['VALOR TOTAL PRODUTOS', 'PRODUTOS', 'TOTAL PRODUTOS']);
                    const vEst   = getValFromRow(row, headerMap, ['DEVOLUÇÃO/ESTORNO', 'ESTORNO', 'DEVOLUCAO']);
                    
                    const vCom8  = getValFromRow(row, headerMap, ['COMISSÃO (8%)', 'COMISSAO (8%)']);
                    const vCom10 = getValFromRow(row, headerMap, ['COMISSÃO (10%)', 'COMISSAO (10%)']);
                    const vCom4  = getValFromRow(row, headerMap, ['COMISSÃO (4%)', 'COMISSAO (4%)']);
                    const vComTotal = getValFromRow(row, headerMap, ['COMISSÃO TOTAL', 'COMISSAO', 'COMISSAO TOTAL']);

                    const vTroco = getValFromRow(row, headerMap, ['TROCO', 'VALOR TROCO']);
                    const vFisico = getValFromRow(row, headerMap, ['DINHEIRO FÍSICO', 'DINHEIRO FISICO']);
                    const vDif   = getValFromRow(row, headerMap, ['DIFERENÇA', 'DIFERENCA']);
                    const vAcerto = getValFromRow(row, headerMap, ['VALOR ACERTO', 'ACERTO']);

                    const cpf = getTextFromRow(row, headerMap, ['CPF']);
                    const nome = getTextFromRow(row, headerMap, ['NOME GARÇOM', 'NOME DO CAIXA', 'GARÇOM', 'CAIXA']);
                    const protocol = getTextFromRow(row, headerMap, ['PROTOCOLO']); 
                    const maquina = getTextFromRow(row, headerMap, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']);
                    const operador = getTextFromRow(row, headerMap, ['OPERADOR']);
                    const data = row[headerMap['DATA']] || row[headerMap['DATE']]; 
                    const versao = getTextFromRow(row, headerMap, ['VERSÃO', 'VERSAO', 'VERSION']);

                    if (typeCategory === 'waiter' || typeCategory === 'waiter_zig') {
                        const isPagar = vAcerto < -0.001; 
                        return {
                            type: typeCategory, cpf, waiterName: nome, protocol, 
                            valorTotal: vTotal, valorEstorno: vEst, 
                            comissao8: vCom8, comissao10: vCom10, comissao4: vCom4, comissaoTotal: vComTotal,
                            diferencaPagarReceber: Math.abs(vAcerto),
                            diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                            credito: vCred, debito: vDeb, pix: vPix, cashless: vCash,
                            valorTotalProdutos: vProd, numeroMaquina: maquina, operatorName: operador, timestamp: data,
                            appVersion: versao
                        };
                    } else {
                        const tipoCaixa = getTextFromRow(row, headerMap, ['TIPO']);
                        const base = {
                            protocol, eventName, operatorName: operador, timestamp: data, cpf,
                            cashierName: nome, numeroMaquina: maquina,
                            valorTotalVenda: vTotal, credito: vCred, debito: vDeb, pix: vPix, 
                            cashless: vCash, valorTroco: vTroco, valorEstorno: vEst, 
                            dinheiroFisico: vFisico, valorAcerto: vAcerto,
                            diferenca: vDif, temEstorno: vEst > 0,
                            appVersion: versao
                        };
                        return { ...base, type: (tipoCaixa.toUpperCase()==='FIXO') ? 'individual_fixed_cashier' : 'cashier', groupProtocol: base.protocol };
                    }
                });
            }
            return [];
        };

        allClosings.push(...processGenericSheet(results[0], 'waiter'));
        allClosings.push(...processGenericSheet(results[1], 'waiter_zig'));
        allClosings.push(...processGenericSheet(results[2], 'cashier'));

        allClosings.forEach(c => {
             if(typeof c.timestamp === 'number') {
                 c.timestamp = excelDateToJSDate(c.timestamp).toISOString();
             } else if(typeof c.timestamp === 'string') {
                 const m = c.timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                 if(m) {
                     c.timestamp = new Date(`${m[3]}-${m[2]}-${m[1]}`).toISOString();
                 } else if(!isNaN(Date.parse(c.timestamp))) {
                     c.timestamp = new Date(c.timestamp).toISOString();
                 }
             }
        });

        if (allClosings.length === 0) return res.status(404).json({ message: 'Nenhum dado encontrado.' });
        res.status(200).json(allClosings);

    } catch(error) { 
        console.error('Erro history:', error); 
        res.status(500).json({message:'Erro interno ao buscar histórico.'}); 
    }
});

// --- ROTA 9: EXPORTAÇÃO ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const fetchWithExtras = async (sheetName) => {
        try {
            const response = await googleSheets.spreadsheets.values.get({ 
                spreadsheetId: spreadsheetId_cloud_sync, 
                range: `'${sheetName}'`,
                valueRenderOption: 'UNFORMATTED_VALUE'
            });
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
        return res.status(404).json({ message: 'Nenhum dado encontrado para este evento.' });
    }
    res.status(200).json({ waiters, zigWaiters, cashiers });
  } catch (error) {
    console.error('Erro export:', error);
    res.status(500).json({ message: 'Erro interno na exportação.' });
  }
});

// --- ROTA 10: CONCILIAÇÃO YUZER ---
app.post('/api/reconcile-yuzer', async (req, res) => {
  const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) return res.status(400).json({ message: 'Dados incompletos.' });
  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetNames = [`Garçons - ${eventName}`, `GarçomZIG - ${eventName}`, `Caixas - ${eventName}`];
    
    const results = await Promise.allSettled(sheetNames.map(sn => 
        googleSheets.spreadsheets.values.get({ 
            spreadsheetId: spreadsheetId_cloud_sync, 
            range: `'${sn}'`, 
            valueRenderOption: 'UNFORMATTED_VALUE' 
        })
    ));
    
    let sisfoData = new Map();
    const getLast8Digits = (s) => (s ? String(s).replace(/\D/g, '').slice(-8) : '');
    
    const processSheet = (result, isZ = false) => {
        if (result.status === 'fulfilled' && result.value.data.values?.length > 1) {
            const [header, ...rows] = result.value.data.values;
            const headerMap = {};
            header.forEach((col, idx) => { if(col) headerMap[String(col).trim().toUpperCase()] = idx; });
            
            rows.forEach(row => {
                const cpf = getTextFromRow(row, headerMap, ['CPF']).replace(/\D/g,'');
                if(cpf) {
                    if(!sisfoData.has(cpf)) sisfoData.set(cpf,[]);
                    
                    sisfoData.get(cpf).push({
                        name: getTextFromRow(row, headerMap, ['NOME GARÇOM', 'NOME DO CAIXA', 'GARÇOM', 'CAIXA']),
                        machine: getLast8Digits(getTextFromRow(row, headerMap, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA'])),
                        
                        total: Math.round(getValFromRow(row, headerMap, isZ ? ['RECARGA CASHLESS'] : ['VENDA TOTAL'])*100),
                        credit: Math.round(getValFromRow(row, headerMap, ['CRÉDITO', 'CREDITO'])*100),
                        debit: Math.round(getValFromRow(row, headerMap, ['DÉBITO', 'DEBITO'])*100),
                        pix: Math.round(getValFromRow(row, headerMap, ['PIX'])*100),
                        cashless: Math.round(getValFromRow(row, headerMap, ['CASHLESS'])*100)
                    });
                }
            });
        }
    };

    processSheet(results[0]); 
    processSheet(results[1], true); 
    processSheet(results[2]);

    let divergences=[], totemsFound=0, recordsCompared=0, unmatchedYuzerRecords=0;
    
    yuzerData.forEach(y => {
        if (String(y['Operador de Caixa']||'').toLowerCase().includes('pdv')) { totemsFound++; return; }
        
        const cpf = String(y['CPF']||'').replace(/\D/g,'');
        const serial = y['Serial'];
        const machineKey = getLast8Digits(serial);
        
        if(!cpf || !machineKey) return;
        
        if(!sisfoData.has(cpf)) { unmatchedYuzerRecords++; return; }
        
        const recs = sisfoData.get(cpf);
        const rIdx = recs.findIndex(r => r.machine === machineKey);
        
        if(rIdx === -1) { unmatchedYuzerRecords++; return; }
        
        recordsCompared++;
        const sRec = recs[rIdx];
        
        const yRec = { 
            total: Math.round(parseSisfoCurrency(y['Total'])*100), 
            credit: Math.round(parseSisfoCurrency(y['Crédito'])*100), 
            debit: Math.round(parseSisfoCurrency(y['Débito'])*100), 
            pix: Math.round(parseSisfoCurrency(y['Pix'])*100), 
            cashless: Math.round(parseSisfoCurrency(y['Cashless'])*100) 
        };
        
        const check = (f, yV, sV) => { 
            if(Math.abs(yV-sV) > 1) { 
                divergences.push({ 
                    name: sRec.name, cpf, machine: machineKey, field: f, 
                    yuzerValue: (yV/100).toFixed(2), 
                    sisfoValue: (sV/100).toFixed(2) 
                }); 
            }
        };
        
        check('Valor Total', yRec.total, sRec.total); 
        check('Crédito', yRec.credit, sRec.credit); 
        check('Débito', yRec.debit, sRec.debit); 
        check('PIX', yRec.pix, sRec.pix); 
        check('Cashless', yRec.cashless, sRec.cashless);
        
        recs.splice(rIdx, 1);
    });
    
    res.status(200).json({ recordsCompared, totemsFound, unmatchedYuzerRecords, divergencesFound: divergences.length, divergences });

  } catch(error) { 
      console.error('Erro na conciliação Yuzer:', error); 
      res.status(500).json({message:'Erro interno do servidor ao processar a conciliação.'}); 
  }
});

// --- ROTA 11: DELETE CLOSING (ONLINE) ---
app.post('/api/delete-closing', async (req, res) => {
    const { eventName, protocolToDelete, password } = req.body;
    if (!eventName || !protocolToDelete) {
        return res.status(400).json({ message: 'Dados incompletos.' });
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
        
        const safeSheetName = `'${sheetName}'`;

        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        
        if (!sheet) return res.status(404).json({ message: `Registro não encontrado.` });
        
        const sheetId = sheet.properties.sheetId;
        const rangeToRead = `${safeSheetName}!${String.fromCharCode(65 + protocolColumnIndex)}:${String.fromCharCode(65 + protocolColumnIndex)}`;
        
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
        let requests = rowIndicesToDelete.map(idx => ({ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 } } }));
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
        res.status(200).json({ message: `${requests.length} registro(s) excluído(s) com sucesso da planilha online.` });

    } catch (error) {
        console.error(`[BACKEND][delete-closing][${eventName}] Erro:`, error.message);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar excluir o registro online.' });
    }
});

// ==========================================
// 5. INICIALIZAÇÃO DO SERVIDOR
// ==========================================

module.exports = app;
if (!isRunningInElectron) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend (Render) rodando na porta ${PORT}`);
  });
} else {
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}