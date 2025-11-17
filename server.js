// server.js (VERSÃO ATUALIZADA - SEPARAÇÃO DA ABA GARÇOMZIG)
console.log("--- EXECUTANDO VERSÃO COM SEPARAÇÃO DE ABAS (GARÇOM vs ZIG) ---"); 

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
// --- FIM DA LÓGICA DE CAMINHO ---

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- FUNÇÕES AUXILIARES (parseSisfoCurrency, normalizeToCentavos, getGoogleSheetsClient) ---
const parseSisfoCurrency = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return 0;
    let stringValue = String(val).trim();
    if (stringValue.toUpperCase().startsWith('R$')) {
        stringValue = stringValue.substring(2).trim();
    }
    const lastPointIndex = stringValue.lastIndexOf('.');
    const lastCommaIndex = stringValue.lastIndexOf(',');
    if (lastCommaIndex > lastPointIndex) {
        stringValue = stringValue.replace(/\./g, '');
        stringValue = stringValue.replace(/,/g, '.');
    } else if (lastPointIndex > lastCommaIndex) {
         stringValue = stringValue.replace(/,/g, '');
    }
    stringValue = stringValue.replace(/[^0-9.]/g, '');
    const numberValue = parseFloat(stringValue);
    return isNaN(numberValue) ? 0 : numberValue;
};

const normalizeToCentavos = (val) => {
    const numberValue = parseSisfoCurrency(val);
    return Math.round(numberValue * 100);
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
    console.error('Erro na autenticação com a Google Sheets API:', error);
    console.error('Caminho procurado para credentials.json:', path.join(resourcesPath, 'credentials.json'));
    throw new Error('Falha na autenticação da API do Google Sheets.');
  }
}
// --- FIM FUNÇÕES AUXILIARES ---

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE';
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ';

// --- ROTAS DE ADMIN (master-data, update-base, update-event-status) ---
// (Sem alterações nessas rotas)
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.batchGet({
            spreadsheetId: spreadsheetId_sync,
            ranges: ['Garcons!A2:B', 'Eventos!A2:B'],
        });
        const valueRanges = response.data.valueRanges || [];
        const waiterRows = valueRanges[0]?.values || [];
        const waiters = waiterRows.map(row => ({ cpf: row[0], name: row[1] }));
        const eventRows = valueRanges[1]?.values || [];
        const events = eventRows.map(row => ({
          name: row[0],
          active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true,
        })).filter(e => e.name);
        console.log(`[BACKEND] Encontrados ${waiters.length} funcionários e ${events.length} eventos.`);
        res.status(200).json({ waiters, events });
    } catch (error) {
        console.error('Erro ao buscar master-data:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar dados mestre.' });
    }
});

app.post('/api/update-base', async (req, res) => {
  const { waiters, events } = req.body;
  try {
    const googleSheets = await getGoogleSheetsClient();
    let addedWaitersCount = 0;
    let addedEventsCount = 0;
    if (waiters && waiters.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A2:A' });
      const existingCpfs = new Set((response.data.values || []).map(row => row[0].trim()));
      const newWaiters = waiters.filter(waiter => waiter.cpf && !existingCpfs.has(waiter.cpf.trim()));
      if (newWaiters.length > 0) {
        const values = newWaiters.map(w => [w.cpf, w.name]);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:B', valueInputOption: 'USER_ENTERED', resource: { values } });
        addedWaitersCount = newWaiters.length;
      }
    }
    if (events && events.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A2:A' });
      const existingEventNames = new Set((response.data.values || []).map(row => row[0].trim()));
      const newEvents = events.filter(event => event.name && !existingEventNames.has(event.name.trim()));
      if (newEvents.length > 0) {
        const values = newEvents.map(e => [e.name, e.active ? 'ATIVO' : 'INATIVO']);
        await googleSheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId_sync,
            range: 'Eventos!A:B',
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        addedEventsCount = newEvents.length;
      }
    }
    res.status(200).json({ message: `Base de cadastro online atualizada com sucesso!\n- ${addedWaitersCount} novo(s) funcionário(s) adicionado(s).\n- ${addedEventsCount} novo(s) evento(s) adicionado(s).` });
  } catch (error) {
    console.error('Erro ao atualizar base de cadastro online:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar a base de cadastro.' });
  }
});

app.post('/api/update-event-status', async (req, res) => {
  const { name, active } = req.body;
  if (!name) { return res.status(400).json({ message: 'O nome do evento é obrigatório.' }); }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const range = 'Eventos!A2:B';
    const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: range });
    const rows = response.data.values || [];
    const eventIndex = rows.findIndex(row => row[0] && row[0].trim() === name.trim());
    if (eventIndex === -1) { return res.status(404).json({ message: `Evento "${name}" não encontrado na planilha online.` }); }
    const targetRow = eventIndex + 2;
    const targetRange = `Eventos!B${targetRow}`;
    const newStatus = active ? 'ATIVO' : 'INATIVO';
    await googleSheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId_sync,
      range: targetRange,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[newStatus]] },
    });
    res.status(200).json({ message: `Status do evento "${name}" atualizado para ${newStatus} com sucesso.` });
  } catch (error) {
    console.error('Erro ao atualizar status do evento online:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar o status do evento.' });
  }
});
// --- FIM ROTAS DE ADMIN ---


// --- ROTA DE SYNC PARA A NUVEM (MODIFICADA PARA SEPARAR ABAS) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  if (syncingEvents.has(eventName)) {
    console.warn(`[BACKEND][cloud-sync][${eventName}] Rejeitado: Sincronização já em andamento.`);
    return res.status(429).json({ message: `Sincronização já em andamento para o evento "${eventName}".` });
  }
  syncingEvents.add(eventName);
  console.log(`[BACKEND][cloud-sync][${eventName}] === INICIANDO SYNC (LOCK ADQUIRIDO) ===`);

  console.log(`[BACKEND][cloud-sync][${eventName}] Recebidos Garçons (Total): ${waiterData?.length || 0}, Caixas: ${cashierData?.length || 0}.`);
  let writeConfirmationError = null;

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let newW = 0, updatedW = 0, newZ = 0, updatedZ = 0, newC = 0, updatedC = 0; // Adicionado newZ e updatedZ

    // --- *** INÍCIO DA MODIFICAÇÃO: SEPARAÇÃO DOS DADOS DE GARÇOM *** ---
    
    // 1. Separa os dados de Garçom (8/10) e ZIG
    const normalWaiters = waiterData ? waiterData.filter(c => c.type !== 'waiter_zig') : [];
    const zigWaiters = waiterData ? waiterData.filter(c => c.type === 'waiter_zig') : [];
    
    console.log(`[BACKEND][cloud-sync][${eventName}] Separados: ${normalWaiters.length} Garçons (8/10) e ${zigWaiters.length} Garçons ZIG.`);

    // --- Processamento Garçons (8% e 10%) ---
    if (normalWaiters.length > 0) {
      const sheetName = `Garçons - ${eventName}`;
      console.log(`[BACKEND][cloud-sync][${eventName}][Garçom 8/10] Processando aba: ${sheetName}`);
      
      // Cabeçalho ORIGINAL (sem campos ZIG)
      const header = [
          "Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina",
          "Venda Total", // Venda Total (Não "Venda Total / Recarga")
          "Crédito", "Débito", "Pix", "Cashless", // Cashless EXISTE aqui
          // "Valor Total Produtos" (NÃO EXISTE AQUI)
          "Devolução/Estorno", "Comissão Total", 
          "Acerto", "Operador"
      ];
      const textColumnIndices = [0, 1, 2, 3, 4, 5, 14]; // Índices de colunas de texto
      const protocolColumnIndex = 1;

      // Mapeamento ORIGINAL
      const rows = normalWaiters.map(c => {
          const acertoValue = c.diferencaPagarReceber ?? 0;
          const acertoSign = (c.diferencaLabel === 'Pagar ao Garçom') ? -1 : 1;
          const signedAcerto = acertoValue * acertoSign; 
          return [
              c.timestamp || '', c.protocol || '', c.type || 'waiter', c.cpf || '', c.waiterName || '', c.numeroMaquina || '',
              c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0,
              c.cashless ?? 0, // Garçom 8/10 tem cashless
              c.valorEstorno ?? 0,
              c.comissaoTotal ?? 0,
              signedAcerto,
              c.operatorName || ''
          ];
      });

      // Lógica de processamento de aba (Cópia 1)
      const sheet = sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom 8/10] Aba não existe. Criando...`);
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
        if (rows.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                writeConfirmationError = `Falha escrita (Garçom 8/10) para ${sheetName}.`;
            } else { newW = rows.length; }
        }
      } else { 
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolMap = new Map();
        existingRows.slice(1).forEach((row, arrayIndex) => {
            if (row && row.length > protocolColumnIndex && row[protocolColumnIndex]) {
               const protocol = String(row[protocolColumnIndex]).trim();
               if (protocol) { protocolMap.set(protocol, { row: row, index: arrayIndex + 2 }); }
            }
        });
        const toAdd = [], toUpdate = [];
        rows.forEach((newRow) => {
            const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
            if (p && protocolMap.has(p)) {
                const { row: existingRow, index: existingIndex } = protocolMap.get(p);
                let hasChanged = false;
                for (let i = 0; i < header.length; i++) {
                     const existingValue = existingRow[i] ?? '';
                     const newValue = newRow[i] ?? '';
                     let comparisonChanged = false;
                     if (textColumnIndices.includes(i)) {
                         comparisonChanged = String(existingValue).trim() !== String(newValue).trim();
                     } else {
                         const existingNum = parseSisfoCurrency(existingValue);
                         const newNum = typeof newValue === 'number' ? newValue : parseSisfoCurrency(newValue);
                         comparisonChanged = Math.abs(existingNum - newNum) > 0.01;
                     }
                     if (comparisonChanged) { hasChanged = true; break; }
                }
                if (hasChanged) { toUpdate.push({ range: `${sheetName}!A${existingIndex}`, values: [newRow] }); }
            } else { toAdd.push(newRow); }
        });
        if (toAdd.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                 writeConfirmationError = writeConfirmationError || `Falha append (Garçom 8/10) para ${sheetName}.`;
            } else { newW = toAdd.length; }
        }
        if (toUpdate.length > 0) {
            const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                 writeConfirmationError = writeConfirmationError || `Falha update (Garçom 8/10) para ${sheetName}.`;
            } else { updatedW = toUpdate.length; }
        }
      }
    }
    if (writeConfirmationError) throw new Error(writeConfirmationError); // Para o processo se falhar


    // --- Processamento Garçons ZIG ---
    if (zigWaiters.length > 0) {
      const sheetName = `GarçomZIG - ${eventName}`; // NOVA ABA
      console.log(`[BACKEND][cloud-sync][${eventName}][Garçom ZIG] Processando aba: ${sheetName}`);
      
      // Cabeçalho ZIG
      const header = [
          "Data", "Protocolo", "Tipo", "CPF", "Nome Garçom", "Nº Máquina",
          "Recarga Cashless", // Nome ZIG
          "Crédito", "Débito", "Pix", 
          // "Cashless" (NÃO EXISTE AQUI)
          "Valor Total Produtos", // NOVO CAMPO ZIG
          "Devolução/Estorno", "Comissão Total", 
          "Acerto", "Operador"
      ];
      const textColumnIndices = [0, 1, 2, 3, 4, 5, 14]; // Índices de colunas de texto
      const protocolColumnIndex = 1;

      // Mapeamento ZIG
      const rows = zigWaiters.map(c => {
          const acertoValue = c.diferencaPagarReceber ?? 0;
          const acertoSign = (c.diferencaLabel === 'Pagar ao Garçom') ? -1 : 1;
          const signedAcerto = acertoValue * acertoSign; 
          return [
              c.timestamp || '', c.protocol || '', c.type || 'waiter_zig', c.cpf || '', c.waiterName || '', c.numeroMaquina || '',
              c.valorTotal ?? 0,       // "valorTotal" é a Recarga Cashless
              c.credito ?? 0, c.debito ?? 0, c.pix ?? 0,
              // Sem Cashless
              c.valorTotalProdutos ?? 0, // Novo campo
              c.valorEstorno ?? 0,
              c.comissaoTotal ?? 0,
              signedAcerto,
              c.operatorName || ''
          ];
      });
      
      // Lógica de processamento de aba (Cópia 2)
      const sheet = sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom ZIG] Aba não existe. Criando...`);
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
        if (rows.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                writeConfirmationError = `Falha escrita (ZIG) para ${sheetName}.`;
            } else { newZ = rows.length; }
        }
      } else { 
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolMap = new Map();
        existingRows.slice(1).forEach((row, arrayIndex) => {
            if (row && row.length > protocolColumnIndex && row[protocolColumnIndex]) {
               const protocol = String(row[protocolColumnIndex]).trim();
               if (protocol) { protocolMap.set(protocol, { row: row, index: arrayIndex + 2 }); }
            }
        });
        const toAdd = [], toUpdate = [];
        rows.forEach((newRow) => {
            const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
            if (p && protocolMap.has(p)) {
                const { row: existingRow, index: existingIndex } = protocolMap.get(p);
                let hasChanged = false;
                for (let i = 0; i < header.length; i++) {
                     const existingValue = existingRow[i] ?? '';
                     const newValue = newRow[i] ?? '';
                     let comparisonChanged = false;
                     if (textColumnIndices.includes(i)) {
                         comparisonChanged = String(existingValue).trim() !== String(newValue).trim();
                     } else {
                         const existingNum = parseSisfoCurrency(existingValue);
                         const newNum = typeof newValue === 'number' ? newValue : parseSisfoCurrency(newValue);
                         comparisonChanged = Math.abs(existingNum - newNum) > 0.01;
                     }
                     if (comparisonChanged) { hasChanged = true; break; }
                }
                if (hasChanged) { toUpdate.push({ range: `${sheetName}!A${existingIndex}`, values: [newRow] }); }
            } else { toAdd.push(newRow); }
        });
        if (toAdd.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                 writeConfirmationError = writeConfirmationError || `Falha append (ZIG) para ${sheetName}.`;
            } else { newZ = toAdd.length; }
        }
        if (toUpdate.length > 0) {
            const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                 writeConfirmationError = writeConfirmationError || `Falha update (ZIG) para ${sheetName}.`;
            } else { updatedZ = toUpdate.length; }
        }
      }
    }
    if (writeConfirmationError) throw new Error(writeConfirmationError); // Para o processo se falhar

    // --- *** FIM DA MODIFICAÇÃO: SEPARAÇÃO DOS DADOS DE GARÇOM *** ---


    // --- Processamento Caixas (Sem alterações) ---
    if (cashierData && cashierData.length > 0) {
        const sheetName = `Caixas - ${eventName}`;
        console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Processando aba: ${sheetName}`);
        const header = [
            "Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina",
            "Venda Total", "Crédito", "Débito", "Pix", "Cashless",
            "Troco", "Devolução/Estorno", "Dinheiro Físico",
            "Valor Acerto", "Diferença", "Operador"
        ];
        const textColumnIndices = [0, 1, 2, 3, 4, 5, 16];
        const protocolColumnIndex = 0;
        const rows = cashierData.map(c => [
            c.protocol || '', c.timestamp || '', c.type || '', c.cpf || '', c.cashierName || '', c.numeroMaquina || '',
            c.valorTotalVenda ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, c.cashless ?? 0,
            c.valorTroco ?? 0, c.valorEstorno ?? 0, c.dinheiroFisico ?? 0,
            c.valorAcerto ?? 0, c.diferenca ?? 0, c.operatorName || ''
        ]);
        const sheet = sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
           console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Aba não existe. Criando...`);
           await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
           await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
           if (rows.length > 0) {
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                    writeConfirmationError = `Falha escrita (Caixa) para ${sheetName}.`;
                } else { newC = rows.length; }
           }
        } else { 
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            const existingRows = response.data.values || [];
            const protocolMap = new Map();
            existingRows.slice(1).forEach((row, arrayIndex) => {
                 if (row && row.length > protocolColumnIndex && row[protocolColumnIndex]) {
                   const protocol = String(row[protocolColumnIndex]).trim();
                   if (protocol) { protocolMap.set(protocol, { row: row, index: arrayIndex + 2 }); }
                }
            });
            const toAdd = [], toUpdate = [];
            rows.forEach((newRow) => {
                const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
                if (p && protocolMap.has(p)) {
                    const { row: existingRow, index: existingIndex } = protocolMap.get(p);
                    let hasChanged = false;
                    for (let i = 0; i < header.length; i++) {
                        const existingValue = existingRow[i] ?? '';
                        const newValue = newRow[i] ?? '';
                        let comparisonChanged = false;
                        if (textColumnIndices.includes(i)) {
                            comparisonChanged = String(existingValue).trim() !== String(newValue).trim();
                        } else {
                            const existingNum = parseSisfoCurrency(existingValue);
                            const newNum = typeof newValue === 'number' ? newValue : parseSisfoCurrency(newValue);
                            comparisonChanged = Math.abs(existingNum - newNum) > 0.01;
                        }
                        if (comparisonChanged) { hasChanged = true; break; }
                    }
                    if (hasChanged) { toUpdate.push({ range: `${sheetName}!A${existingIndex}`, values: [newRow] }); }
                } else { toAdd.push(newRow); }
            });
            if (toAdd.length > 0) {
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || !appendResult.data.updates.updatedRows < toAdd.length) {
                    writeConfirmationError = writeConfirmationError || `Falha append (Caixa) para ${sheetName}.`;
                } else { newC = toAdd.length; }
            }
            if (toUpdate.length > 0) {
                const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
                if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                    writeConfirmationError = writeConfirmationError || `Falha update (Caixa) para ${sheetName}.`;
                } else { updatedC = toUpdate.length; }
            }
        } 
    }
    if (writeConfirmationError) throw new Error(writeConfirmationError);
    // --- Fim Caixas ---

    console.log(`[BACKEND][cloud-sync][${eventName}] === SYNC FINALIZADO === Resultado:`, { newW, updatedW, newZ, updatedZ, newC, updatedC });
    // Retorna os contadores ZIG também
    res.status(200).json({ newWaiters: newW, updatedWaiters: updatedW, newZigWaiters: newZ, updatedZigWaiters: updatedZ, newCashiers: newC, updatedCashiers: updatedC });

  } catch (error) {
    console.error(`[BACKEND][cloud-sync][${eventName}] Erro durante o processamento:`, error);
    res.status(500).json({ message: writeConfirmationError || `Erro interno do servidor ao salvar na nuvem para ${eventName}.` });
  } finally {
      syncingEvents.delete(eventName);
      console.log(`[BACKEND][cloud-sync][${eventName}] === LOCK LIBERADO ===`);
  }
});

// --- ROTA DE HISTÓRICO ONLINE (MODIFICADA PARA LER 3 ABAS) ---
app.post('/api/online-history', async (req, res) => {
     const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const waiterSheetName = `Garçons - ${eventName}`;
        const zigSheetName = `GarçomZIG - ${eventName}`; // Nova aba
        const cashierSheetName = `Caixas - ${eventName}`;
        
        const [waiterResult, zigResult, cashierResult] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: zigSheetName }), // Lê a nova aba
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName })
        ]);
        
        let allClosings = [];
        
        // Processamento de Garçons (8/10)
        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
            const [header, ...rows] = waiterResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [String(key || '').trim().toUpperCase(), row[i]]));
                    const closingObject = {
                        type: rowObj['TIPO'] || 'waiter',
                        cpf: rowObj['CPF'], 
                        waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'],
                        valorTotal: parseSisfoCurrency(rowObj['VENDA TOTAL']), // Venda Total
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']),
                        comissaoTotal: parseSisfoCurrency(rowObj['COMISSÃO TOTAL']),
                        diferencaPagarReceber: parseSisfoCurrency(rowObj['ACERTO']),
                        credito: parseSisfoCurrency(rowObj['CRÉDITO']),
                        debito: parseSisfoCurrency(rowObj['DÉBITO']),
                        pix: parseSisfoCurrency(rowObj['PIX']),
                        cashless: parseSisfoCurrency(rowObj['CASHLESS']),
                        valorTotalProdutos: 0, // Garçom normal não tem
                        numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        operatorName: rowObj['OPERADOR'], 
                        timestamp: rowObj['DATA'],
                    };
                    closingObject.diferencaLabel = closingObject.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom';
                    closingObject.diferencaPagarReceber = Math.abs(closingObject.diferencaPagarReceber);
                    return closingObject;
                });
                allClosings.push(...data);
            }
        }

        // Processamento de Garçons ZIG
        if (zigResult.status === 'fulfilled' && zigResult.value.data.values) {
            const [header, ...rows] = zigResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [String(key || '').trim().toUpperCase(), row[i]]));
                    const closingObject = {
                        type: rowObj['TIPO'] || 'waiter_zig',
                        cpf: rowObj['CPF'], 
                        waiterName: rowObj['NOME GARÇOM'], 
                        protocol: rowObj['PROTOCOLO'],
                        valorTotal: parseSisfoCurrency(rowObj['RECARGA CASHLESS']), // Recarga
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']),
                        comissaoTotal: parseSisfoCurrency(rowObj['COMISSÃO TOTAL']),
                        diferencaPagarReceber: parseSisfoCurrency(rowObj['ACERTO']),
                        credito: parseSisfoCurrency(rowObj['CRÉDITO']),
                        debito: parseSisfoCurrency(rowObj['DÉBITO']),
                        pix: parseSisfoCurrency(rowObj['PIX']),
                        cashless: 0, // ZIG não tem
                        valorTotalProdutos: parseSisfoCurrency(rowObj['VALOR TOTAL PRODUTOS']), // Campo ZIG
                        numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        operatorName: rowObj['OPERADOR'], 
                        timestamp: rowObj['DATA'],
                    };
                    closingObject.diferencaLabel = closingObject.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom';
                    closingObject.diferencaPagarReceber = Math.abs(closingObject.diferencaPagarReceber);
                    return closingObject;
                });
                allClosings.push(...data);
            }
        }
        
        // Processamento de Caixas (Sem alterações)
        if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) {
            const [header, ...rows] = cashierResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [String(key || '').trim().toUpperCase(), row[i]]));
                    const type = rowObj['TIPO'] || '';
                    const protocol = rowObj['PROTOCOLO'] || '';
                    const baseCashierObject = {
                        protocol, eventName, operatorName: rowObj['OPERADOR'], timestamp: rowObj['DATA'], cpf: rowObj['CPF'],
                        cashierName: rowObj['NOME DO CAIXA'], numeroMaquina: rowObj['Nº MÁQUINA'] || rowObj['Nº MAQUINA'],
                        valorTotalVenda: parseSisfoCurrency(rowObj['VENDA TOTAL']),
                        credito: parseSisfoCurrency(rowObj['CRÉDITO']),
                        debito: parseSisfoCurrency(rowObj['DÉBITO']),
                        pix: parseSisfoCurrency(rowObj['PIX']),
                        cashless: parseSisfoCurrency(rowObj['CASHLESS']),
                        valorTroco: parseSisfoCurrency(rowObj['TROCO']),
                        valorEstorno: parseSisfoCurrency(rowObj['DEVOLUÇÃO/ESTORNO']),
                        dinheiroFisico: parseSisfoCurrency(rowObj['DINHEIRO FÍSICO']),
                        valorAcerto: parseSisfoCurrency(rowObj['VALOR ACERTO']),
                        diferenca: parseSisfoCurrency(rowObj['DIFERENÇA']),
                    };
                    baseCashierObject.temEstorno = baseCashierObject.valorEstorno > 0;
                    if (type.toUpperCase() === 'FIXO') {
                        return { ...baseCashierObject, type: 'individual_fixed_cashier', groupProtocol: protocol.includes('-') ? protocol.substring(0, protocol.lastIndexOf('-')) : protocol };
                    } else {
                        return { ...baseCashierObject, type: 'cashier' };
                    }
                }).filter(Boolean);
                allClosings.push(...data);
            }
        }

        // Formatação de data (sem alterações)
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
                        const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
                        parsedDate = new Date(isoDateString);
                         if (!isNaN(parsedDate)) finalDate = parsedDate;
                    }
                }
            }
            closing.timestamp = finalDate.toISOString();
        });

        if (allClosings.length === 0) {
            return res.status(404).json({ message: `Nenhum fechamento (garçom ou caixa) foi encontrado para o evento "${eventName}" na nuvem.` });
        }
        res.status(200).json(allClosings);
    } catch (error) {
        console.error('Erro ao buscar histórico online (versão unificada):', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
    }
});


// --- ROTA DE EXPORTAÇÃO ONLINE (MODIFICADA PARA LER 3 ABAS) ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    let consolidatedWaiters = [], consolidatedZigWaiters = [], consolidatedCashiers = []; // Adicionado ZIG

    // --- SEÇÃO DE GARÇONS (8/10) ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Garçons - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0];
          const rows = response.data.values.slice(1);
          consolidatedWaiters = rows.map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => { rowData[key] = row[index] || ''; });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Garçons (8/10) para o evento "${eventName}" não encontrada.`, e.message); }

    // --- SEÇÃO DE GARÇONS ZIG ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `GarçomZIG - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0];
          const rows = response.data.values.slice(1);
          consolidatedZigWaiters = rows.map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => { rowData[key] = row[index] || ''; });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de GarçomZIG para o evento "${eventName}" não encontrada.`, e.message); }


    // --- SEÇÃO DE CAIXAS --- (Sem alteração)
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Caixas - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0];
          consolidatedCashiers = response.data.values.slice(1).map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => { rowData[key] = row[index] || ''; });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Caixas para o evento "${eventName}" não encontrada.`, e.message); }

    if (consolidatedWaiters.length === 0 && consolidatedZigWaiters.length === 0 && consolidatedCashiers.length === 0) {
        return res.status(404).json({ message: 'Nenhum dado encontrado para este evento na nuvem.' });
    }
    // Retorna os 3 arrays
    res.status(200).json({ waiters: consolidatedWaiters, zigWaiters: consolidatedZigWaiters, cashiers: consolidatedCashiers });
  } catch (error) {
    console.error('Erro ao exportar dados da nuvem por evento:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar os dados.' });
  }
});


// --- ROTA DE RECONCILIAÇÃO YUZER (MODIFICADA PARA LER 3 ABAS) ---
app.post('/api/reconcile-yuzer', async (req, res) => {
  const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) {
    return res.status(400).json({ message: 'Nome do evento e dados da planilha são obrigatórios.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const waiterSheetName = `Garçons - ${eventName}`;
    const zigSheetName = `GarçomZIG - ${eventName}`; // Nova aba
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
        
        // Coluna de Venda/Recarga (Yuzer só vê o total da máquina)
        const totalIndex = findIndex(header, isZigSheet ? ['RECARGA CASHLESS'] : ['VENDA TOTAL']); 
        
        const creditIndex = findIndex(header, ['CRÉDITO', 'CREDITO']);
        const debitIndex = findIndex(header, ['DÉBITO', 'DEBITO']);
        const pixIndex = findIndex(header, ['PIX']);
        const cashlessIndex = findIndex(header, ['CASHLESS']); // ZIG não tem, vai dar -1 (correto)
        
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) {
            console.warn(`[RECONCILE] Cabeçalhos essenciais não encontrados na aba ${isWaiterSheet ? 'Garçons' : 'Caixas'}.`);
            return;
        }
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
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${zigSheetName}!A:Z` }), // Lê ZIG
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` })
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true, false); // Garçom 8/10
         else if (waiterRes.reason?.response?.status !== 400) console.error("[RECONCILE] Erro ao ler aba Garçons:", waiterRes.reason);
        if (zigRes.status === 'fulfilled') processSheet(zigRes.value, true, true); // Garçom ZIG
         else if (zigRes.reason?.response?.status !== 400) console.error("[RECONCILE] Erro ao ler aba GarçomZIG:", zigRes.reason);
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false, false); // Caixa
         else if (cashierRes.reason?.response?.status !== 400) console.error("[RECONCILE] Erro ao ler aba Caixas:", cashierRes.reason);
    } catch (e) { console.log(`Erro geral ao ler abas SisFO para o evento "${eventName}".`); }

    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`);
    console.log(`${sisfoData.size} CPFs distintos carregados do SisFO.`);
    let divergences = [], totemsFound = 0, recordsCompared = 0, unmatchedYuzerRecords = 0;

    yuzerData.forEach((yuzerRow) => {
      const operator = yuzerRow['Operador de Caixa'];
      if (operator && String(operator).toLowerCase().includes('pdv')) { totemsFound++; return; }
      const cpf = String(yuzerRow['CPF'] || '').replace(/\D/g, '');
      const serial = yuzerRow['Serial'];
      if (!cpf || !serial) {
          console.log(`[RECONCILE] Linha Yuzer ignorada: CPF ou Serial ausente.`);
          return;
      }
      const machineKey = getLast8Digits(serial);
      if (!machineKey) {
          console.log(`[RECONCILE] Linha Yuzer ignorada: Não foi possível extrair 8 dígitos da máquina.`);
          return;
      }
      if (!sisfoData.has(cpf)) {
          unmatchedYuzerRecords++;
          console.log(`[RECONCILE] CPF ${cpf} (Máquina ${machineKey}) do Yuzer não encontrado no SisFO.`);
          return;
      }
      const sisfoRecordsForCpf = sisfoData.get(cpf);
      const recordIndex = sisfoRecordsForCpf.findIndex(rec => rec.machine === machineKey);
      if (recordIndex === -1) {
        unmatchedYuzerRecords++;
        console.log(`[RECONCILE] CPF ${cpf} encontrado no SisFO, mas NENHUM registro com os 8 dígitos da máquina (${machineKey}).`);
        return;
      }
      recordsCompared++;
      const sisfoRecord = sisfoRecordsForCpf[recordIndex];

      const yuzerRecord = {
        total: normalizeToCentavos(yuzerRow['Total']),
        credit: normalizeToCentavos(yuzerRow['Crédito']),
        debit: normalizeToCentavos(yuzerRow['Débito']),
        pix: normalizeToCentavos(yuzerRow['Pix']),
        cashless: normalizeToCentavos(yuzerRow['Cashless'])
      };

      console.log(`--> COMPARANDO CPF: ${cpf}, CHAVE MÁQUINA: ${machineKey}`);
      console.log("    DADOS YUZER (em CENTAVOS) ->", JSON.stringify(yuzerRecord));
      console.log("    DADOS SISFO (em CENTAVOS) ->", JSON.stringify(sisfoRecord));

      const checkDiff = (field, yuzerVal_centavos, sisfoVal_centavos) => {
        if (Math.abs(yuzerVal_centavos - sisfoVal_centavos) > 0.01) {
          const yuzerLog = (Math.round(yuzerVal_centavos) / 100).toFixed(2);
          const sisfoLog = (Math.round(sisfoVal_centavos) / 100).toFixed(2);
          console.log(`    !!! DIVERGÊNCIA [${field}]: Yuzer=${yuzerLog}, SisFO=${sisfoLog}`);
          divergences.push({
              name: sisfoRecord.name, cpf, machine: machineKey, field,
              yuzerValue: yuzerLog, sisfoValue: sisfoLog 
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

    console.log("\n--- CONCILIAÇÃO FINALIZADA ---");
    res.status(200).json({
      recordsCompared, totemsFound, unmatchedYuzerRecords,
      divergencesFound: divergences.length, divergences
    });
  } catch (error) {
    console.error('Erro na conciliação Yuzer:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar a conciliação.' });
  }
});


// --- ROTA DE EXCLUSÃO ONLINE (MODIFICADA PARA LER 3 ABAS) ---
app.post('/api/delete-closing', async (req, res) => {
    const { eventName, protocolToDelete, password } = req.body;
    if (!eventName || !protocolToDelete) {
        return res.status(400).json({ message: 'Nome do evento e protocolo são obrigatórios.' });
    }
    console.log(`[BACKEND][delete-closing][${eventName}] Recebida requisição para excluir protocolo base: ${protocolToDelete}`);
    if (password && password !== process.env.ONLINE_HISTORY_PASSWORD) {
        console.warn(`[BACKEND][delete-closing][${eventName}] Falha na autenticação por senha.`);
        return res.status(401).json({ message: 'Senha incorreta para exclusão online.' });
    }
    
    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = spreadsheetId_cloud_sync;

        const isZigProtocol = protocolToDelete.startsWith('GZ-');
        const isWaiterProtocol = protocolToDelete.startsWith('G8-') || protocolToDelete.startsWith('G10-');
        const isMobileCashierProtocol = protocolToDelete.startsWith('CXM-');
        const isFixedCashierGroupProtocol = protocolToDelete.startsWith('CXF-');

        let sheetName;
        let protocolColumnIndex; // 0-based index

        if (isZigProtocol) {
            sheetName = `GarçomZIG - ${eventName}`;
            protocolColumnIndex = 1; // Coluna B
        } else if (isWaiterProtocol) {
            sheetName = `Garçons - ${eventName}`;
            protocolColumnIndex = 1; // Coluna B
        } else if (isMobileCashierProtocol || isFixedCashierGroupProtocol) {
            sheetName = `Caixas - ${eventName}`;
            protocolColumnIndex = 0; // Coluna A
        } else {
            console.error(`[BACKEND][delete-closing][${eventName}] Protocolo ${protocolToDelete} não reconhecido.`);
            return res.status(400).json({ message: 'Formato de protocolo não reconhecido.' });
        }
        console.log(`[BACKEND][delete-closing][${eventName}] Procurando na aba "${sheetName}"`);

        const spreadsheet = await googleSheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            console.log(`[BACKEND][delete-closing][${eventName}] Aba "${sheetName}" não encontrada.`);
            return res.status(404).json({ message: `Registro não encontrado (Aba ${sheetName} não existe).` });
        }
        const sheetId = sheet.properties.sheetId;

        const rangeToRead = `${sheetName}!${String.fromCharCode(65 + protocolColumnIndex)}:${String.fromCharCode(65 + protocolColumnIndex)}`;
        console.log(`[BACKEND][delete-closing][${eventName}] Lendo coluna de protocolos: ${rangeToRead}`);
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId, range: rangeToRead });
        const protocolsInSheet = response.data.values || [];
        console.log(`[BACKEND][delete-closing][${eventName}] ${protocolsInSheet.length} protocolos lidos da coluna.`);

        const rowIndicesToDelete = [];
        protocolsInSheet.forEach((row, index) => {
            if (row && row[0]) {
                const currentProtocol = String(row[0]).trim();
                if (currentProtocol === protocolToDelete || (isFixedCashierGroupProtocol && currentProtocol.startsWith(protocolToDelete + '-'))) {
                    rowIndicesToDelete.push(index);
                    console.log(`[BACKEND][delete-closing][${eventName}] Marcada linha ${index + 1} para exclusão (Protocolo: ${currentProtocol})`);
                }
            }
        });

        if (rowIndicesToDelete.length === 0) {
            console.log(`[BACKEND][delete-closing][${eventName}] Protocolo ${protocolToDelete} não encontrado na aba "${sheetName}".`);
            return res.status(404).json({ message: 'Registro não encontrado na planilha online.' });
        }

        rowIndicesToDelete.sort((a, b) => b - a); // Exclui do maior para o menor
        let requests = [];
        rowIndicesToDelete.forEach(rowIndex => {
            requests.push({
                deleteDimension: {
                    range: { sheetId: sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
                }
            });
        });

        console.log(`[BACKEND][delete-closing][${eventName}] Enviando ${requests.length} requisições de exclusão.`);
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });

        console.log(`[BACKEND][delete-closing][${eventName}] Exclusão online concluída. ${requests.length} linha(s) removida(s).`);
        res.status(200).json({ message: `${requests.length} registro(s) excluído(s) com sucesso da planilha online.` });

    } catch (error) {
        console.error(`[BACKEND][delete-closing][${eventName}] Erro ao excluir registro ${protocolToDelete}:`, error.response?.data || error.message);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar excluir o registro online.' });
    }
});


// --- INICIALIZAÇÃO CONDICIONAL ---
module.exports = app;
if (!isRunningInElectron) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend (Render) rodando na porta ${PORT}`);
  });
} else {
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}