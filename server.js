// server.js (VERSÃO CORRIGIDA - Com Bloqueio, Leitura Única e Logs Detalhados)
console.log("--- EXECUTANDO VERSÃO FINAL COM BLOQUEIO, LEITURA ÚNICA E LOGS DETALHADOS ---"); //

const express = require('express'); //
const { google } = require('googleapis'); //
const cors = require('cors'); //
const path = require('path'); //
const app = express(); //
const syncingEvents = new Set(); // Guarda os nomes dos eventos em sincronização

// --- LÓGICA DE CAMINHO UNIVERSAL ---
const isRunningInElectron = !!process.versions['electron']; //
const isProduction = process.env.NODE_ENV === 'production'; //
const isProdElectron = isRunningInElectron && isProduction; //
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname; //
require('dotenv').config({ path: path.join(resourcesPath, '.env') }); //
// --- FIM DA LÓGICA DE CAMINHO ---

app.use(express.json({ limit: '50mb' })); //
app.use(cors()); //

// --- parseSisfoCurrency CORRIGIDO (VERSÃO ROBUSTA - FUNÇÃO AUXILIAR) ---
const parseSisfoCurrency = (val) => { //
    if (val === null || val === undefined || String(val).trim() === '') return 0; //
    let stringValue = String(val).trim(); //
    if (stringValue.toUpperCase().startsWith('R$')) { //
        stringValue = stringValue.substring(2).trim(); //
    }
    const lastPointIndex = stringValue.lastIndexOf('.'); //
    const lastCommaIndex = stringValue.lastIndexOf(','); //
    if (lastCommaIndex > lastPointIndex) { //
        stringValue = stringValue.replace(/\./g, ''); //
        stringValue = stringValue.replace(/,/g, '.'); //
    } else if (lastPointIndex > lastCommaIndex) { //
         stringValue = stringValue.replace(/,/g, ''); //
    }
    stringValue = stringValue.replace(/[^0-9.]/g, ''); //
    const numberValue = parseFloat(stringValue); //
    return isNaN(numberValue) ? 0 : numberValue; //
};

// --- NOVA FUNÇÃO DE NORMALIZAÇÃO CORRIGIDA ---
const normalizeToCentavos = (val) => { //
    const numberValue = parseSisfoCurrency(val); //
    return Math.round(numberValue * 100); //
};


async function getGoogleSheetsClient() { //
  try {
    const auth = new google.auth.GoogleAuth({ //
      credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : undefined, //
      keyFilename: process.env.GOOGLE_CREDENTIALS ? undefined : path.join(resourcesPath, 'credentials.json'), //
      scopes: 'https://www.googleapis.com/auth/spreadsheets', //
    });
    const client = await auth.getClient(); //
    return google.sheets({ version: 'v4', auth: client }); //
  } catch (error) {
    console.error('Erro na autenticação com a Google Sheets API:', error); //
    console.error('Caminho procurado para credentials.json:', path.join(resourcesPath, 'credentials.json')); //
    throw new Error('Falha na autenticação da API do Google Sheets.'); //
  }
}

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE'; // Ajuste se necessário
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ'; // Ajuste se necessário

// --- ROTA DE SYNC MASTER-DATA ---
app.get('/api/sync/master-data', async (req, res) => { //
    try {
        const googleSheets = await getGoogleSheetsClient(); //
        const response = await googleSheets.spreadsheets.values.batchGet({ //
            spreadsheetId: spreadsheetId_sync, //
            ranges: ['Garcons!A2:B', 'Eventos!A2:B'], //
        });
        const valueRanges = response.data.valueRanges || []; //
        const waiterRows = valueRanges[0]?.values || []; //
        const waiters = waiterRows.map(row => ({ cpf: row[0], name: row[1] })); //
        const eventRows = valueRanges[1]?.values || []; //
        const events = eventRows.map(row => ({ //
          name: row[0], //
          active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true, //
        })).filter(e => e.name); //
        console.log(`[BACKEND] Encontrados ${waiters.length} funcionários e ${events.length} eventos.`); //
        res.status(200).json({ waiters, events }); //
    } catch (error) {
        console.error('Erro ao buscar master-data:', error); //
        res.status(500).json({ message: 'Erro interno do servidor ao buscar dados mestre.' }); //
    }
});

// --- ROTA: ATUALIZAR BASE DE CADASTRO ONLINE ---
app.post('/api/update-base', async (req, res) => { //
  const { waiters, events } = req.body; //
  try {
    const googleSheets = await getGoogleSheetsClient(); //
    let addedWaitersCount = 0; //
    let addedEventsCount = 0; //
    if (waiters && waiters.length > 0) { //
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A2:A' }); //
      const existingCpfs = new Set((response.data.values || []).map(row => row[0].trim())); //
      const newWaiters = waiters.filter(waiter => waiter.cpf && !existingCpfs.has(waiter.cpf.trim())); //
      if (newWaiters.length > 0) { //
        const values = newWaiters.map(w => [w.cpf, w.name]); //
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:B', valueInputOption: 'USER_ENTERED', resource: { values } }); //
        addedWaitersCount = newWaiters.length; //
      }
    }
    if (events && events.length > 0) { //
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A2:A' }); //
      const existingEventNames = new Set((response.data.values || []).map(row => row[0].trim())); //
      const newEvents = events.filter(event => event.name && !existingEventNames.has(event.name.trim())); //
      if (newEvents.length > 0) { //
        const values = newEvents.map(e => [e.name, e.active ? 'ATIVO' : 'INATIVO']); //
        await googleSheets.spreadsheets.values.append({ //
            spreadsheetId: spreadsheetId_sync, //
            range: 'Eventos!A:B', // Salva em A:B
            valueInputOption: 'USER_ENTERED', //
            resource: { values } //
        });
        addedEventsCount = newEvents.length; //
      }
    }
    res.status(200).json({ message: `Base de cadastro online atualizada com sucesso!\n- ${addedWaitersCount} novo(s) funcionário(s) adicionado(s).\n- ${addedEventsCount} novo(s) evento(s) adicionado(s).` }); //
  } catch (error) {
    console.error('Erro ao atualizar base de cadastro online:', error); //
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar a base de cadastro.' }); //
  }
});

// --- ROTA: ATUALIZAR STATUS DE UM ÚNICO EVENTO ---
app.post('/api/update-event-status', async (req, res) => { //
  const { name, active } = req.body; //
  if (!name) { return res.status(400).json({ message: 'O nome do evento é obrigatório.' }); } //
  try {
    const googleSheets = await getGoogleSheetsClient(); //
    const range = 'Eventos!A2:B'; // Lê A:B
    const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: range }); //
    const rows = response.data.values || []; //
    const eventIndex = rows.findIndex(row => row[0] && row[0].trim() === name.trim()); //
    if (eventIndex === -1) { return res.status(404).json({ message: `Evento "${name}" não encontrado na planilha online.` }); } //
    const targetRow = eventIndex + 2; //
    const targetRange = `Eventos!B${targetRow}`; // Atualiza a Coluna B (Status)
    const newStatus = active ? 'ATIVO' : 'INATIVO'; //
    await googleSheets.spreadsheets.values.update({ //
      spreadsheetId: spreadsheetId_sync, //
      range: targetRange, //
      valueInputOption: 'USER_ENTERED', //
      resource: { values: [[newStatus]] }, //
    });
    res.status(200).json({ message: `Status do evento "${name}" atualizado para ${newStatus} com sucesso.` }); //
  } catch (error) {
    console.error('Erro ao atualizar status do evento online:', error); //
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar o status do evento.' }); //
  }
});

// --- ROTA DE SYNC PARA A NUVEM (COM BLOQUEIO POR EVENTO E LEITURA ÚNICA) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  // --- INÍCIO DO BLOQUEIO ---
  if (syncingEvents.has(eventName)) {
    console.warn(`[BACKEND][cloud-sync][${eventName}] Rejeitado: Sincronização já em andamento para este evento.`);
    return res.status(429).json({ message: `Sincronização já em andamento para o evento "${eventName}". Tente novamente mais tarde.` });
  }
  syncingEvents.add(eventName);
  console.log(`[BACKEND][cloud-sync][${eventName}] === INICIANDO SYNC (LOCK ADQUIRIDO) ===`);
  // --- FIM DO BLOQUEIO ---

  console.log(`[BACKEND][cloud-sync][${eventName}] Recebidos Garçons: ${waiterData?.length || 0}, Caixas: ${cashierData?.length || 0}.`);
  let writeConfirmationError = null;

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let newW = 0, updatedW = 0, newC = 0, updatedC = 0;

    // --- Processamento Garçons ---
    if (waiterData && waiterData.length > 0) {
      const sheetName = `Garçons - ${eventName}`;
      console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Processando aba: ${sheetName}`);

      const header = [
          "Data", "Protocolo", "CPF", "Nome Garçom", "Nº Máquina",
          "Venda Total", "Crédito", "Débito", "Pix", "Cashless",
          "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"
      ];
      const rows = waiterData.map(c => [
          c.timestamp || '', c.protocol || '', c.cpf || '', c.waiterName || '', c.numeroMaquina || '',
          c.valorTotal ?? 0, c.credito ?? 0, c.debito ?? 0, c.pix ?? 0, c.cashless ?? 0,
          c.valorEstorno ?? 0, c.comissaoTotal ?? 0, c.acerto ?? 0, c.operatorName || ''
      ]);

      const sheet = sheets.find(s => s.properties.title === sheetName);

      if (!sheet) {
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Aba não existe. Criando...`);
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Aba criada. Adicionando cabeçalho...`);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
        if (rows.length > 0) {
            console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Adicionando ${rows.length} linhas iniciais...`);
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            // --- CONFIRMAÇÃO APPEND ---
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                console.error(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION FAIL] Append inicial falhou. Esperado: ${rows.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                writeConfirmationError = `Falha ao confirmar escrita inicial (Garçom) para ${sheetName}.`;
            } else {
                 console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION OK] Append inicial confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                 newW = rows.length;
            }
        }
      } else { // Aba já existe
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Aba encontrada. Lendo dados completos...`); // Log
        // --- LEITURA ÚNICA ---
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || []; // Inclui cabeçalho
        const protocolColumnIndex = 1; // Índice da coluna 'Protocolo' (0-based)
        const protocolMap = new Map();

        // Mapeia protocolos a partir da segunda linha (índice 1 do array)
        existingRows.slice(1).forEach((row, arrayIndex) => {
            if (row && row.length > protocolColumnIndex && row[protocolColumnIndex]) {
               const protocol = String(row[protocolColumnIndex]).trim();
               if (protocol) {
                   // Armazena a linha *completa* e o índice da linha na *planilha* (arrayIndex + 2)
                   protocolMap.set(protocol, { row: row, index: arrayIndex + 2 });
               }
            }
        });
        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] ${protocolMap.size} protocolos existentes mapeados a partir de ${existingRows.length -1} linhas de dados.`);
        // --- FIM LEITURA ÚNICA ---

        const toAdd = [], toUpdate = [];
        rows.forEach((newRow) => { // Não precisa mais de await aqui dentro
            const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
            const pExists = p ? protocolMap.has(p) : false;
            console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Verificando Proto Recebido: "${p}" | Existe no Map? ${pExists}`);

            if (pExists) {
                const existingInfo = protocolMap.get(p);
                const existingRow = existingInfo.row; // Pega a linha completa do map
                const existingIndex = existingInfo.index; // Pega o índice da planilha do map

                let hasChanged = false;
                console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][Proto "${p}"] Comparando com linha ${existingIndex}:`);
                // --- COMPARAÇÃO (sem alterações, mas usando existingRow do map) ---
                for (let i = 0; i < header.length; i++) {
                     const existingValue = existingRow[i] ?? '';
                     const newValue = newRow[i] ?? '';
                     let comparisonChanged = false;
                     if ([0, 1, 2, 3, 4, 13].includes(i)) {
                         comparisonChanged = String(existingValue).trim() !== String(newValue).trim();
                     } else {
                         const existingNum = parseSisfoCurrency(existingValue);
                         const newNum = typeof newValue === 'number' ? newValue : parseSisfoCurrency(newValue);
                         comparisonChanged = Math.abs(existingNum - newNum) > 0.01;
                     }
                     if (comparisonChanged) {
                         console.log(`  => [COL ${i}-${header[i]}] DETECTADA MUDANÇA! Planilha: "${existingValue}" vs Recebido: "${newValue}"`);
                         hasChanged = true;
                         break;
                     }
                }
                // --- FIM COMPARAÇÃO ---

                if (hasChanged) {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][Proto "${p}"] => DECISÃO: UPDATE`);
                    toUpdate.push({ range: `${sheetName}!A${existingIndex}`, values: [newRow] });
                } else {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][Proto "${p}"] => DECISÃO: SEM MUDANÇAS`);
                }
            } else {
                console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][Proto "${p}"] => DECISÃO: ADD`);
                toAdd.push(newRow);
            }
        }); // Fim do rows.forEach

        console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Itens para adicionar: ${toAdd.length}, Itens para atualizar: ${toUpdate.length}`);

        if (toAdd.length > 0) {
            console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Executando append para ${toAdd.length} linhas...`);
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                 console.error(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION FAIL] Append falhou. Esperado: ${toAdd.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                 writeConfirmationError = writeConfirmationError || `Falha ao confirmar append (Garçom) para ${sheetName}.`;
            } else {
                 console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION OK] Append confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                 newW = toAdd.length;
            }
        }
        if (toUpdate.length > 0) {
            console.log(`[BACKEND][cloud-sync][${eventName}][Garçom] Executando batchUpdate para ${toUpdate.length} linhas...`);
            const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                 console.error(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION FAIL] BatchUpdate falhou. Esperado: ${toUpdate.length}, Atualizado: ${batchUpdateResult.data?.totalUpdatedRows}`);
                 writeConfirmationError = writeConfirmationError || `Falha ao confirmar update (Garçom) para ${sheetName}.`;
            } else {
                 console.log(`[BACKEND][cloud-sync][${eventName}][Garçom][CONFIRMATION OK] BatchUpdate confirmado: ${batchUpdateResult.data.totalUpdatedRows} linhas.`);
                 updatedW = toUpdate.length;
            }
        }
      } // Fim do else (aba já existe)
    } // Fim Garçons

    // Lança erro se a confirmação de escrita de Garçom falhou
    if (writeConfirmationError) throw new Error(writeConfirmationError);

    // --- Processamento Caixas (COM BLOQUEIO POR EVENTO E LEITURA ÚNICA) ---
    if (cashierData && cashierData.length > 0) {
        const sheetName = `Caixas - ${eventName}`;
        console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Processando aba: ${sheetName}`);

        const header = [
            "Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina",
            "Venda Total", "Crédito", "Débito", "Pix", "Cashless",
            "Troco", "Devolução/Estorno", "Dinheiro Físico",
            "Valor Acerto", "Diferença", "Operador"
        ];
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
           console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Aba criada. Adicionando cabeçalho...`);
           await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
           if (rows.length > 0) {
               console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Adicionando ${rows.length} linhas iniciais...`);
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                    console.error(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION FAIL] Append inicial falhou. Esperado: ${rows.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                    writeConfirmationError = `Falha ao confirmar escrita inicial (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION OK] Append inicial confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                    newC = rows.length;
                }
           }
        } else { // Aba já existe
            console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Aba encontrada. Lendo dados completos...`); // Log
            // --- LEITURA ÚNICA ---
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            const existingRows = response.data.values || []; // Inclui cabeçalho
            const protocolColumnIndex = 0; // Índice da coluna 'Protocolo' (0-based)
            const protocolMap = new Map();

            existingRows.slice(1).forEach((row, arrayIndex) => {
                 if (row && row.length > protocolColumnIndex && row[protocolColumnIndex]) {
                   const protocol = String(row[protocolColumnIndex]).trim();
                   if (protocol) {
                       protocolMap.set(protocol, { row: row, index: arrayIndex + 2 });
                   }
                }
            });
            console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] ${protocolMap.size} protocolos existentes mapeados a partir de ${existingRows.length - 1} linhas de dados.`);
            // --- FIM LEITURA ÚNICA ---

            const toAdd = [], toUpdate = [];
            rows.forEach((newRow) => { // Não precisa mais de await
                const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
                const pExists = p ? protocolMap.has(p) : false;
                console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Verificando Proto Recebido: "${p}" | Existe no Map? ${pExists}`);

                if (pExists) {
                    const existingInfo = protocolMap.get(p);
                    const existingRow = existingInfo.row;
                    const existingIndex = existingInfo.index;

                    let hasChanged = false;
                    console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][Proto "${p}"] Comparando com linha ${existingIndex}:`);
                    // --- COMPARAÇÃO (sem alterações, mas usando existingRow do map) ---
                    for (let i = 0; i < header.length; i++) {
                        const existingValue = existingRow[i] ?? '';
                        const newValue = newRow[i] ?? '';
                        let comparisonChanged = false;
                        if ([0, 1, 2, 3, 4, 5, 16].includes(i)) {
                            comparisonChanged = String(existingValue).trim() !== String(newValue).trim();
                        } else {
                            const existingNum = parseSisfoCurrency(existingValue);
                            const newNum = typeof newValue === 'number' ? newValue : parseSisfoCurrency(newValue);
                            comparisonChanged = Math.abs(existingNum - newNum) > 0.01;
                        }
                        if (comparisonChanged) {
                             console.log(`  => [COL ${i}-${header[i]}] DETECTADA MUDANÇA! Planilha: "${existingValue}" vs Recebido: "${newValue}"`);
                            hasChanged = true;
                            break;
                        }
                    }
                    // --- FIM COMPARAÇÃO ---

                    if (hasChanged) {
                        console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][Proto "${p}"] => DECISÃO: UPDATE`);
                        toUpdate.push({ range: `${sheetName}!A${existingIndex}`, values: [newRow] });
                    } else {
                        console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][Proto "${p}"] => DECISÃO: SEM MUDANÇAS`);
                    }
                } else {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][Proto "${p}"] => DECISÃO: ADD`);
                    toAdd.push(newRow);
                }
            }); // Fim do rows.forEach

            console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Itens para adicionar: ${toAdd.length}, Itens para atualizar: ${toUpdate.length}`);

            if (toAdd.length > 0) {
                 console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Executando append para ${toAdd.length} linhas...`);
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                    console.error(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION FAIL] Append falhou. Esperado: ${toAdd.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                    writeConfirmationError = writeConfirmationError || `Falha ao confirmar append (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION OK] Append confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                    newC = toAdd.length;
                }
            }
            if (toUpdate.length > 0) {
                 console.log(`[BACKEND][cloud-sync][${eventName}][Caixa] Executando batchUpdate para ${toUpdate.length} linhas...`);
                const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
                if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                    console.error(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION FAIL] BatchUpdate falhou. Esperado: ${toUpdate.length}, Atualizado: ${batchUpdateResult.data?.totalUpdatedRows}`);
                    writeConfirmationError = writeConfirmationError || `Falha ao confirmar update (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][${eventName}][Caixa][CONFIRMATION OK] BatchUpdate confirmado: ${batchUpdateResult.data.totalUpdatedRows} linhas.`);
                    updatedC = toUpdate.length;
                }
            }
        } // Fim do else (aba já existe)
    } // Fim Caixas

    // Lança erro se a confirmação de escrita de Caixa falhou
    if (writeConfirmationError) throw new Error(writeConfirmationError);

    console.log(`[BACKEND][cloud-sync][${eventName}] === SYNC FINALIZADO === Resultado:`, { newW, updatedW, newC, updatedC });
    res.status(200).json({ newWaiters: newW, updatedWaiters: updatedW, newCashiers: newC, updatedCashiers: updatedC });

  } catch (error) {
    // Se writeConfirmationError foi definido OU ocorreu outro erro
    console.error(`[BACKEND][cloud-sync][${eventName}] Erro durante o processamento:`, error); // Log de Erro com nome do evento
    res.status(500).json({ message: writeConfirmationError || `Erro interno do servidor ao salvar na nuvem para ${eventName}.` });
  } finally {
      // --- LIBERA O BLOQUEIO ---
      syncingEvents.delete(eventName);
      console.log(`[BACKEND][cloud-sync][${eventName}] === LOCK LIBERADO ===`);
      // --- FIM LIBERA O BLOQUEIO ---
  }
});

// --- ROTA DE HISTÓRICO ONLINE ---
app.post('/api/online-history', async (req, res) => { //
     const { eventName, password } = req.body; //
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' }); //
    try {
        const googleSheets = await getGoogleSheetsClient(); //
        const waiterSheetName = `Garçons - ${eventName}`; //
        const cashierSheetName = `Caixas - ${eventName}`; //
        const [waiterResult, cashierResult] = await Promise.allSettled([ //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName }), //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName }) //
        ]);
        let allClosings = []; //
        // Processamento de Garçons
        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) { //
            const [header, ...rows] = waiterResult.value.data.values; //
            if (header && rows.length > 0) { //
                const data = rows.map(row => { //
                    const rowObj = Object.fromEntries(header.map((key, i) => [String(key || '').trim(), row[i]])); // Garante que key é string
                    const closingObject = { //
                        type: 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['Nome Garçom'], protocol: rowObj['Protocolo'], //
                        valorTotal: parseSisfoCurrency(rowObj['Venda Total']), //
                        valorEstorno: parseSisfoCurrency(rowObj['Devolução/Estorno']), //
                        comissaoTotal: parseSisfoCurrency(rowObj['Comissão Total']), //
                        diferencaPagarReceber: parseSisfoCurrency(rowObj['Acerto']), //
                        credito: parseSisfoCurrency(rowObj['Crédito']), //
                        debito: parseSisfoCurrency(rowObj['Débito']), //
                        pix: parseSisfoCurrency(rowObj['Pix']), //
                        cashless: parseSisfoCurrency(rowObj['Cashless']), //
                        numeroMaquina: rowObj['Nº Máquina'] || rowObj['Nº MAQUINA'], // Considera variações
                        operatorName: rowObj['Operador'], timestamp: rowObj['Data'], //
                    };
                    closingObject.diferencaLabel = closingObject.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom'; //
                    closingObject.diferencaPagarReceber = Math.abs(closingObject.diferencaPagarReceber); //
                    return closingObject; //
                });
                allClosings.push(...data); //
            }
        }
        // Processamento de Caixas
        if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) { //
            const [header, ...rows] = cashierResult.value.data.values; //
            if (header && rows.length > 0) { //
                const data = rows.map(row => { //
                    const rowObj = Object.fromEntries(header.map((key, i) => [String(key || '').trim(), row[i]])); // Garante que key é string
                    const type = rowObj['Tipo'] || ''; //
                    const protocol = rowObj['Protocolo'] || ''; //
                    const baseCashierObject = { //
                        protocol, eventName, operatorName: rowObj['Operador'], timestamp: rowObj['Data'], cpf: rowObj['CPF'], //
                        cashierName: rowObj['Nome do Caixa'], numeroMaquina: rowObj['Nº Máquina'] || rowObj['Nº MAQUINA'], // Considera variações
                        valorTotalVenda: parseSisfoCurrency(rowObj['Venda Total']), //
                        credito: parseSisfoCurrency(rowObj['Crédito']), //
                        debito: parseSisfoCurrency(rowObj['Débito']), //
                        pix: parseSisfoCurrency(rowObj['Pix']), //
                        cashless: parseSisfoCurrency(rowObj['Cashless']), //
                        valorTroco: parseSisfoCurrency(rowObj['Troco']), //
                        valorEstorno: parseSisfoCurrency(rowObj['Devolução/Estorno']), //
                        dinheiroFisico: parseSisfoCurrency(rowObj['Dinheiro Físico']), //
                        valorAcerto: parseSisfoCurrency(rowObj['Valor Acerto']), //
                        diferenca: parseSisfoCurrency(rowObj['Diferença']), //
                    };
                    baseCashierObject.temEstorno = baseCashierObject.valorEstorno > 0; //

                    if (type === 'Fixo') { //
                        return { ...baseCashierObject, type: 'individual_fixed_cashier', groupProtocol: protocol.includes('-') ? protocol.substring(0, protocol.lastIndexOf('-')) : protocol }; // Ajuste para pegar grupo
                    } else {
                        return { ...baseCashierObject, type: 'cashier' }; //
                    }
                }).filter(Boolean); //
                allClosings.push(...data); //
            }
        }

        // Formatação de data (prioriza ISO, fallback pt-BR com vírgula opcional)
        allClosings.forEach(closing => { //
            const dateString = closing.timestamp; //
            let finalDate = new Date(0); //
            if (dateString && typeof dateString === 'string') { //
                let parsedDate = new Date(dateString); //
                if (!isNaN(parsedDate) && parsedDate.getFullYear() > 2000) { // Tenta ISO primeiro
                    finalDate = parsedDate;
                } else { // Fallback pt-BR
                    const matchBr = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/); // Vírgula opcional
                    if (matchBr) {
                        const [, day, month, year, hour, minute, second] = matchBr;
                        const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`; //
                        parsedDate = new Date(isoDateString); //
                         if (!isNaN(parsedDate)) finalDate = parsedDate; //
                    }
                }
            }
            closing.timestamp = finalDate.toISOString(); //
        });

        if (allClosings.length === 0) { //
            return res.status(404).json({ message: `Nenhum fechamento (garçom ou caixa) foi encontrado para o evento "${eventName}" na nuvem.` }); //
        }
        res.status(200).json(allClosings); //
    } catch (error) {
        console.error('Erro ao buscar histórico online (versão unificada):', error); //
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' }); //
    }
});


// --- ROTA DE EXPORTAÇÃO ONLINE ---
app.post('/api/export-online-data', async (req, res) => { //
  const { password, eventName } = req.body; //
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) { //
    return res.status(401).json({ message: 'Acesso não autorizado.' }); //
  }
  try {
    const googleSheets = await getGoogleSheetsClient(); //
    let consolidatedWaiters = [], consolidatedCashiers = []; //

    // --- SEÇÃO DE GARÇONS (FUNCIONÁRIOS) ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Garçons - ${eventName}` }); //
      if (response.data.values && response.data.values.length > 1) { //
          const header = response.data.values[0].map(h => String(h).trim().toUpperCase()); //
          // Mapeamento robusto de colunas (com fallbacks para nomes comuns)
          const findIndex = (headers, possibleNames) => headers.findIndex(h => possibleNames.includes(h));
          const idxData = findIndex(header, ['DATA']); //
          const idxProtocolo = findIndex(header, ['PROTOCOLO']); //
          const idxCpf = findIndex(header, ['CPF']); //
          const idxNome = findIndex(header, ['NOME GARÇOM', 'GARÇOM']); //
          const idxMaquina = findIndex(header, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']); //
          const idxVendaTotal = findIndex(header, ['VENDA TOTAL', 'VALOR TOTAL VENDA', 'TOTAL']); //
          const idxCredito = findIndex(header, ['CRÉDITO', 'CREDITO']); //
          const idxDebito = findIndex(header, ['DÉBITO', 'DEBITO']); //
          const idxPix = findIndex(header, ['PIX']); //
          const idxCashless = findIndex(header, ['CASHLESS']); //
          const idxEstorno = findIndex(header, ['DEVOLUÇÃO/ESTORNO', 'ESTORNO', 'DEVOLUÇÃO ESTORNO', 'DEVOLUCAO/ESTORNO', 'DEVOLUCAO ESTORNO']); //
          const idxComissao = findIndex(header, ['COMISSÃO TOTAL', 'COMISSAO TOTAL']); //
          const idxAcerto = findIndex(header, ['ACERTO']); //
          const idxOperador = findIndex(header, ['OPERADOR']); //
          const rows = response.data.values.slice(1); //

          consolidatedWaiters = rows.map(row => { //
              // Usar um objeto para facilitar a leitura e fallback
              const getVal = (index) => (index !== -1 && row[index] !== undefined) ? row[index] : '';
              const rowData = { //
                  eventName: eventName, //
                  'DATA': getVal(idxData),
                  'PROTOCOLO': getVal(idxProtocolo),
                  'CPF': getVal(idxCpf),
                  'NOME GARÇOM': getVal(idxNome),
                  'Nº MAQUINA': getVal(idxMaquina),
                  'VALOR TOTAL VENDA': getVal(idxVendaTotal),
                  'CRÉDITO': getVal(idxCredito),
                  'DÉBITO': getVal(idxDebito),
                  'PIX': getVal(idxPix),
                  'CASHLESS': getVal(idxCashless),
                  'DEVOLUÇÃO ESTORNO': getVal(idxEstorno),
                  'COMISSÃO TOTAL': getVal(idxComissao),
                  'ACERTO': getVal(idxAcerto),
                  'OPERADOR': getVal(idxOperador)
              };
              return rowData; //
          });
      }
    } catch (e) { console.log(`Aba de Garçons para o evento "${eventName}" não encontrada ou erro ao ler. Continuando...`, e.message); } // Log do erro

    // --- SEÇÃO DE CAIXAS ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Caixas - ${eventName}` }); //
      if (response.data.values && response.data.values.length > 1) { //
          const header = response.data.values[0].map(h => String(h).trim().toUpperCase()); // Padroniza header
          consolidatedCashiers = response.data.values.slice(1).map(row => { //
              const rowData = { eventName }; //
              header.forEach((key, index) => { rowData[key] = row[index] || ''; }); // Mapeia direto
              return rowData; //
          });
      }
    } catch (e) { console.log(`Aba de Caixas para o evento "${eventName}" não encontrada ou erro ao ler. Continuando...`, e.message); } // Log do erro

    if (consolidatedWaiters.length === 0 && consolidatedCashiers.length === 0) { //
        return res.status(404).json({ message: 'Nenhum dado encontrado para este evento na nuvem.' }); //
    }
    res.status(200).json({ waiters: consolidatedWaiters, cashiers: consolidatedCashiers }); //
  } catch (error) {
    console.error('Erro ao exportar dados da nuvem por evento:', error); //
    res.status(500).json({ message: 'Erro interno do servidor ao processar os dados.' }); //
  }
});


// --- ROTA DE RECONCILIAÇÃO YUZER (CORREÇÃO FINAL) ---
app.post('/api/reconcile-yuzer', async (req, res) => { //
  const { eventName, yuzerData } = req.body; //
  if (!eventName || !yuzerData) { //
    return res.status(400).json({ message: 'Nome do evento e dados da planilha são obrigatórios.' }); //
  }
  try {
    const googleSheets = await getGoogleSheetsClient(); //
    const waiterSheetName = `Garçons - ${eventName}`; //
    const cashierSheetName = `Caixas - ${eventName}`; //
    let sisfoData = new Map(); //
    const getLast8Digits = (serial) => { //
        if (!serial) return ''; //
        const digitsOnly = String(serial).replace(/\D/g, ''); //
        return digitsOnly.slice(-8); //
    };

    const processSheet = (response, isWaiterSheet) => { //
        if (!response.data.values || response.data.values.length < 2) return; //
        const [header, ...rows] = response.data.values; //
        const findIndex = (headers, possibleNames) => headers.findIndex(h => possibleNames.includes(h.toUpperCase()));
        const cpfIndex = findIndex(header, ['CPF']); //
        const nameIndex = findIndex(header, isWaiterSheet ? ['NOME GARÇOM', 'GARÇOM'] : ['NOME DO CAIXA', 'CAIXA']); //
        const machineIndex = findIndex(header, ['Nº MAQUINA', 'Nº MÁQUINA', 'MAQUINA']); //
        const totalIndex = findIndex(header, ['VENDA TOTAL', 'VALOR TOTAL VENDA', 'TOTAL']); //
        const creditIndex = findIndex(header, ['CRÉDITO', 'CREDITO']); //
        const debitIndex = findIndex(header, ['DÉBITO', 'DEBITO']); //
        const pixIndex = findIndex(header, ['PIX']); //
        const cashlessIndex = findIndex(header, ['CASHLESS']); //
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) { //
            console.warn(`[RECONCILE] Cabeçalhos essenciais (CPF, Nome, Máquina) não encontrados na aba ${isWaiterSheet ? 'Garçons' : 'Caixas'}. Cabeçalhos encontrados: ${header.join(', ')}`); // Log aprimorado
            return; //
        }
        rows.forEach(row => { //
            const cpf = row[cpfIndex]?.replace(/\D/g, ''); //
            if (cpf) { //
                if (!sisfoData.has(cpf)) { sisfoData.set(cpf, []); } //
                sisfoData.get(cpf).push({ //
                    name: row[nameIndex], //
                    machine: getLast8Digits(row[machineIndex]), //
                    total: totalIndex !== -1 ? normalizeToCentavos(row[totalIndex]) : 0, //
                    credit: creditIndex !== -1 ? normalizeToCentavos(row[creditIndex]) : 0, //
                    debit: debitIndex !== -1 ? normalizeToCentavos(row[debitIndex]) : 0, //
                    pix: pixIndex !== -1 ? normalizeToCentavos(row[pixIndex]) : 0, //
                    cashless: cashlessIndex !== -1 ? normalizeToCentavos(row[cashlessIndex]) : 0 //
                });
            }
        });
    };

    try {
        const [waiterRes, cashierRes] = await Promise.allSettled([ //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A:Z` }), //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` }) //
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true); //
         else if (waiterRes.reason?.response?.status !== 400) console.error("[RECONCILE] Erro ao ler aba Garçons:", waiterRes.reason); // Loga erro se não for 'Range not found'
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false); //
         else if (cashierRes.reason?.response?.status !== 400) console.error("[RECONCILE] Erro ao ler aba Caixas:", cashierRes.reason); // Loga erro
    } catch (e) { console.log(`Erro geral ao ler abas SisFO para o evento "${eventName}".`); } //

    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`); //
    console.log(`${sisfoData.size} CPFs distintos carregados do SisFO.`); //
    let divergences = [], totemsFound = 0, recordsCompared = 0, unmatchedYuzerRecords = 0; //

    yuzerData.forEach((yuzerRow) => { //
      const operator = yuzerRow['Operador de Caixa']; //
      if (operator && String(operator).toLowerCase().includes('pdv')) { totemsFound++; return; } //
      const cpf = String(yuzerRow['CPF'] || '').replace(/\D/g, ''); //
      const serial = yuzerRow['Serial']; //
      if (!cpf || !serial) { //
          console.log(`[RECONCILE] Linha Yuzer ignorada: CPF ou Serial ausente. Operador: ${operator || 'N/A'}, Linha: ${JSON.stringify(yuzerRow)}`); // Log aprimorado
          return; //
      }
      const machineKey = getLast8Digits(serial); //
      if (!machineKey) { //
          console.log(`[RECONCILE] Linha Yuzer ignorada: Não foi possível extrair 8 dígitos da máquina. Serial: ${serial}, Linha: ${JSON.stringify(yuzerRow)}`); // Log aprimorado
          return; //
      }
      if (!sisfoData.has(cpf)) { //
          unmatchedYuzerRecords++; //
          console.log(`[RECONCILE] CPF ${cpf} (Máquina ${machineKey}) do Yuzer não encontrado no SisFO.`); //
          return; //
      }
      const sisfoRecordsForCpf = sisfoData.get(cpf); //
      const recordIndex = sisfoRecordsForCpf.findIndex(rec => rec.machine === machineKey); //
      if (recordIndex === -1) { //
        unmatchedYuzerRecords++; //
        console.log(`[RECONCILE] CPF ${cpf} encontrado no SisFO, mas NENHUM registro com os 8 dígitos da máquina (${machineKey}). Máquinas SisFO: ${sisfoRecordsForCpf.map(r => r.machine).join(', ')}`); //
        return; //
      }
      recordsCompared++; //
      const sisfoRecord = sisfoRecordsForCpf[recordIndex]; //

      const yuzerRecord = { //
        total: normalizeToCentavos(yuzerRow['Total']), //
        credit: normalizeToCentavos(yuzerRow['Crédito']), //
        debit: normalizeToCentavos(yuzerRow['Débito']), //
        pix: normalizeToCentavos(yuzerRow['Pix']), //
        cashless: normalizeToCentavos(yuzerRow['Cashless']) //
      };

      console.log(`--> COMPARANDO CPF: ${cpf}, CHAVE MÁQUINA: ${machineKey}`); //
      console.log("    DADOS YUZER (em CENTAVOS) ->", JSON.stringify(yuzerRecord)); //
      console.log("    DADOS SISFO (em CENTAVOS) ->", JSON.stringify(sisfoRecord)); //

      const checkDiff = (field, yuzerVal_centavos, sisfoVal_centavos) => { //
        if (Math.abs(yuzerVal_centavos - sisfoVal_centavos) > 0.01) { //
          const yuzerLog = (Math.round(yuzerVal_centavos) / 100).toFixed(2); //
          const sisfoLog = (Math.round(sisfoVal_centavos) / 100).toFixed(2); //
          console.log(`    !!! DIVERGÊNCIA [${field}]: Yuzer=${yuzerLog}, SisFO=${sisfoLog}`); //
          divergences.push({ //
              name: sisfoRecord.name, //
              cpf, //
              machine: machineKey, //
              field, //
              yuzerValue: yuzerLog, //
              sisfoValue: sisfoLog  //
            });
        }
      };

      checkDiff('Valor Total', yuzerRecord.total, sisfoRecord.total); //
      checkDiff('Crédito', yuzerRecord.credit, sisfoRecord.credit); //
      checkDiff('Débito', yuzerRecord.debit, sisfoRecord.debit); //
      checkDiff('PIX', yuzerRecord.pix, sisfoRecord.pix); //
      checkDiff('Cashless', yuzerRecord.cashless, sisfoRecord.cashless); //

      sisfoRecordsForCpf.splice(recordIndex, 1); //
    });

    console.log("\n--- CONCILIAÇÃO FINALIZADA ---"); //
    res.status(200).json({ //
      recordsCompared, //
      totemsFound, //
      unmatchedYuzerRecords, //
      divergencesFound: divergences.length, //
      divergences //
    });
  } catch (error) {
    console.error('Erro na conciliação Yuzer:', error); //
    res.status(500).json({ message: 'Erro interno do servidor ao processar a conciliação.' }); //
  }
});


// --- INICIALIZAÇÃO CONDICIONAL ---
module.exports = app; //

if (!isRunningInElectron) { //
  const PORT = process.env.PORT || 10000; //
  app.listen(PORT, '0.0.0.0', () => { //
    console.log(`Servidor backend (Render) rodando na porta ${PORT}`); //
  });
} else {
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}