// server.js (VERSÃO CORRIGIDA - Mapeamento de Colunas e Leitura de Data)
console.log("--- EXECUTANDO VERSÃO FINAL COM parseSisfoCurrency CORRIGIDO e LOGS DETALHADOS ---"); //

const express = require('express'); //
const { google } = require('googleapis'); //
const cors = require('cors'); //
const path = require('path'); //
const app = express(); //

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
/**
 * Converte valor de formatos comuns (R$, ',', '.', inteiro) para número decimal.
 * Trata formatos brasileiros ("1.234,56") e americanos ("1234.56").
 * Esta função APENAS converte a string para número, ela NÃO normaliza a unidade.
 */
const parseSisfoCurrency = (val) => { //
    if (val === null || val === undefined || String(val).trim() === '') return 0; //

    let stringValue = String(val).trim(); //

    // Remove "R$" prefix if present
    if (stringValue.toUpperCase().startsWith('R$')) { //
        stringValue = stringValue.substring(2).trim(); //
    }

    const lastPointIndex = stringValue.lastIndexOf('.'); //
    const lastCommaIndex = stringValue.lastIndexOf(','); //

    // Se a vírgula vem DEPOIS do ponto (ex: "1.234,56")
    // ou se SÓ tem vírgula (ex: "1234,56" ou "4549,55")
    // -> É formato brasileiro.
    if (lastCommaIndex > lastPointIndex) { //
        stringValue = stringValue.replace(/\./g, ''); // Remove pontos de milhar
        stringValue = stringValue.replace(/,/g, '.'); // Troca vírgula decimal
    }
    // Se o ponto vem DEPOIS da vírgula (ex: "1,234.56")
    // -> É formato americano com vírgula de milhar.
    else if (lastPointIndex > lastCommaIndex) { //
         stringValue = stringValue.replace(/,/g, ''); // Remove vírgulas de milhar
    }
    // Se não tem vírgula (ex: "1234.56" ou "1234"),
    // assume que o formato está correto (ponto é decimal ou não há decimal).

    // Remove quaisquer outros caracteres não numéricos (exceto o ponto decimal)
    stringValue = stringValue.replace(/[^0-9.]/g, ''); //

    // Tenta converter para float
    const numberValue = parseFloat(stringValue); //

    // Retorna 0 se a conversão falhar (NaN)
    return isNaN(numberValue) ? 0 : numberValue; //
};

// --- NOVA FUNÇÃO DE NORMALIZAÇÃO CORRIGIDA ---
/**
 * Converte um valor (lido pelo parseSisfoCurrency) para CENTAVOS.
 * A função parseSisfoCurrency primeiro transforma a string (ex: "300" ou "3.002,50") em um número (ex: 300 ou 3002.5).
 * Esta função então assume que esse número é *SEMPRE* em Reais e o converte para centavos.
 */
const normalizeToCentavos = (val) => { //
    // 1. Converte a string para um número (ex: "300" -> 300, "1109" -> 1109, "3002,5" -> 3002.5)
    const numberValue = parseSisfoCurrency(val); //

    // 2. Assume que o valor é SEMPRE em Reais e multiplica por 100.
    // Ex: 300 * 100 = 30000 (R$ 300,00)
    // Ex: 1109 * 100 = 110900 (R$ 1109,00)
    // Ex: 3002.5 * 100 = 300250 (R$ 3002,50)
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

// server.js (VERSÃO COM CONFIRMAÇÃO PÓS-ESCRITA)

// ... (imports, setup, funções auxiliares, outras rotas - sem alterações) ...
// ... (parseSisfoCurrency, normalizeToCentavos, getGoogleSheetsClient) ...
// ... (rotas /api/sync/master-data, /api/update-base, /api/update-event-status) ...

// --- ROTA DE SYNC PARA A NUVEM (COM CONFIRMAÇÃO PÓS-ESCRITA) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  console.log(`\n[BACKEND][cloud-sync] Recebida requisição para evento: ${eventName}`);
  console.log(`[BACKEND][cloud-sync] Recebidos ${waiterData?.length || 0} garçom, ${cashierData?.length || 0} caixa.`);

  let writeConfirmationError = null; // Flag para erros de confirmação

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let newW = 0, updatedW = 0, newC = 0, updatedC = 0;

    // --- Processamento Garçons ---
    if (waiterData && waiterData.length > 0) {
      const sheetName = `Garçons - ${eventName}`;

      // --- INÍCIO DA MODIFICAÇÃO (PASSO 2.1) ---
      // SUBSTITUA O 'header' E 'rows' ANTIGOS POR ESTES:
      const header = [
          "Data", "Protocolo", "CPF", "Nome Garçom", "Nº Máquina",
          "Venda Total", "Crédito", "Débito", "Pix", "Cashless",
          "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"
      ];

      const rows = waiterData.map(c => [
          c.timestamp,
          c.protocol,
          c.cpf,
          c.waiterName,
          c.numeroMaquina,
          c.valorTotal,
          c.credito,
          c.debito,
          c.pix,
          c.cashless,
          c.valorEstorno,
          c.comissaoTotal,
          c.acerto,
          c.operatorName
      ]);
      // --- FIM DA MODIFICAÇÃO (PASSO 2.1) ---

      const sheet = sheets.find(s => s.properties.title === sheetName);

      if (!sheet) {
        console.log(`[BACKEND][cloud-sync][Garçom] Criando nova aba ${sheetName}...`);
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
        if (rows.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            // --- CONFIRMAÇÃO APPEND ---
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                console.error(`[BACKEND][cloud-sync][Garçom][CONFIRMATION FAIL] Append inicial falhou ou incompleto. Esperado: ${rows.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                writeConfirmationError = `Falha ao confirmar escrita inicial (Garçom) para ${sheetName}.`;
            } else {
                 console.log(`[BACKEND][cloud-sync][Garçom][CONFIRMATION OK] Append inicial confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                 newW = rows.length;
            }
        }
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolColumnIndex = 1;
        const protocolMap = new Map();
        existingRows.slice(1).forEach((row, index) => {
            const protocol = row[protocolColumnIndex];
            if (protocol) protocolMap.set(String(protocol).trim(), { row: row, index: index + 2 });
        });
        console.log(`[BACKEND][cloud-sync][Garçom] Protocolos existentes (${sheetName}):`, Array.from(protocolMap.keys()));

        const toAdd = [], toUpdate = [];
        rows.forEach((newRow, rowIndex) => {
            const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
            const pExists = p ? protocolMap.has(p) : false;
            console.log(`[BACKEND][cloud-sync][Garçom][ROW ${rowIndex + 1}] Verificando Proto: "${p}" | Existe? ${pExists}`);
            if (pExists) {
                const existing = protocolMap.get(p);
                let hasChanged = false; /* ... compara campos ... */
                 for (let i = 0; i < newRow.length; i++) {
                     if ([0, 1, 2, 3, 4, 13].includes(i)) { if (String(existing.row[i] || '').trim() !== String(newRow[i] ?? '').trim()) { hasChanged = true; break; } }
                     else { if (Math.abs(parseSisfoCurrency(existing.row[i]) - (typeof newRow[i] === 'number' ? newRow[i] : parseSisfoCurrency(newRow[i]))) > 0.01) { hasChanged = true; break; } }
                 }
                if (hasChanged) {
                    console.log(`[BACKEND][cloud-sync][Garçom][ROW ${rowIndex + 1}] => DECISÃO: UPDATE`);
                    toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [newRow] });
                } else {
                    console.log(`[BACKEND][cloud-sync][Garçom][ROW ${rowIndex + 1}] => DECISÃO: SEM MUDANÇAS`);
                }
            } else {
                console.log(`[BACKEND][cloud-sync][Garçom][ROW ${rowIndex + 1}] => DECISÃO: ADD`);
                toAdd.push(newRow);
            }
        });

        if (toAdd.length > 0) {
            const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            // --- CONFIRMAÇÃO APPEND ---
            if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                 console.error(`[BACKEND][cloud-sync][Garçom][CONFIRMATION FAIL] Append falhou ou incompleto. Esperado: ${toAdd.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                 writeConfirmationError = writeConfirmationError || `Falha ao confirmar append (Garçom) para ${sheetName}.`; // Não sobrescreve erro anterior
            } else {
                 console.log(`[BACKEND][cloud-sync][Garçom][CONFIRMATION OK] Append confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                 newW = toAdd.length;
            }
        }
        if (toUpdate.length > 0) {
            const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
             // --- CONFIRMAÇÃO BATCH UPDATE ---
            if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                 console.error(`[BACKEND][cloud-sync][Garçom][CONFIRMATION FAIL] BatchUpdate falhou ou incompleto. Esperado: ${toUpdate.length}, Atualizado: ${batchUpdateResult.data?.totalUpdatedRows}`);
                 writeConfirmationError = writeConfirmationError || `Falha ao confirmar update (Garçom) para ${sheetName}.`;
            } else {
                 console.log(`[BACKEND][cloud-sync][Garçom][CONFIRMATION OK] BatchUpdate confirmado: ${batchUpdateResult.data.totalUpdatedRows} linhas.`);
                 updatedW = toUpdate.length;
            }
        }
      }
    } // Fim Garçons

    // Lança erro se a confirmação de escrita de Garçom falhou
    if (writeConfirmationError) throw new Error(writeConfirmationError);

    // --- Processamento Caixas (COM CONFIRMAÇÃO PÓS-ESCRITA) ---
    if (cashierData && cashierData.length > 0) {
        const sheetName = `Caixas - ${eventName}`;
        
        // --- INÍCIO DA MODIFICAÇÃO (PASSO 2.2) ---
        // SUBSTITUA O 'header' E 'rows' ANTIGOS POR ESTES:
        const header = [
            "Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina",
            "Venda Total", "Crédito", "Débito", "Pix", "Cashless",
            "Troco", "Devolução/Estorno", "Dinheiro Físico",
            "Valor Acerto", "Diferença", "Operador"
        ];

        const rows = cashierData.map(c => [
            c.protocol,
            c.timestamp,
            c.type,
            c.cpf,
            c.cashierName,
            c.numeroMaquina,
            c.valorTotalVenda,
            c.credito,
            c.debito,
            c.pix,
            c.cashless,
            c.valorTroco,
            c.valorEstorno,
            c.dinheiroFisico,
            c.valorAcerto,
            c.diferenca,
            c.operatorName
        ]);
        // --- FIM DA MODIFICAÇÃO (PASSO 2.2) ---
        
        const sheet = sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
           console.log(`[BACKEND][cloud-sync][Caixa] Criando nova aba ${sheetName}...`);
           await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
           await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
           if (rows.length > 0) {
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
                // --- CONFIRMAÇÃO APPEND ---
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < rows.length) {
                    console.error(`[BACKEND][cloud-sync][Caixa][CONFIRMATION FAIL] Append inicial falhou ou incompleto. Esperado: ${rows.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                    writeConfirmationError = `Falha ao confirmar escrita inicial (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][Caixa][CONFIRMATION OK] Append inicial confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                    newC = rows.length;
                }
           }
        } else {
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            const existingRows = response.data.values || [];
            const protocolColumnIndex = 0;
            const protocolMap = new Map();
            existingRows.slice(1).forEach((row, index) => {
                const protocol = row[protocolColumnIndex];
                if (protocol) protocolMap.set(String(protocol).trim(), { row: row, index: index + 2 });
            });
            console.log(`[BACKEND][cloud-sync][Caixa] Protocolos existentes (${sheetName}):`, Array.from(protocolMap.keys()));

            const toAdd = [], toUpdate = [];
            rows.forEach((newRow, rowIndex) => {
                const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
                const pExists = p ? protocolMap.has(p) : false;
                console.log(`[BACKEND][cloud-sync][Caixa][ROW ${rowIndex + 1}] Verificando Proto: "${p}" | Existe? ${pExists}`);
                if (pExists) {
                    const existing = protocolMap.get(p);
                    let hasChanged = false; /* ... compara campos ... */
                    for (let i = 0; i < newRow.length; i++) {
                        if ([0, 1, 2, 3, 4, 5, 16].includes(i)) { if (String(existing.row[i] || '').trim() !== String(newRow[i] ?? '').trim()) { hasChanged = true; break; } }
                        else { if (Math.abs(parseSisfoCurrency(existing.row[i]) - (typeof newRow[i] === 'number' ? newRow[i] : parseSisfoCurrency(newRow[i]))) > 0.01) { hasChanged = true; break; } }
                    }
                    if (hasChanged) {
                        console.log(`[BACKEND][cloud-sync][Caixa][ROW ${rowIndex + 1}] => DECISÃO: UPDATE`);
                        toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [newRow] });
                    } else {
                        console.log(`[BACKEND][cloud-sync][Caixa][ROW ${rowIndex + 1}] => DECISÃO: SEM MUDANÇAS`);
                    }
                } else {
                    console.log(`[BACKEND][cloud-sync][Caixa][ROW ${rowIndex + 1}] => DECISÃO: ADD`);
                    toAdd.push(newRow);
                }
            });

            if (toAdd.length > 0) {
                const appendResult = await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
                 // --- CONFIRMAÇÃO APPEND ---
                if (!appendResult.data.updates || !appendResult.data.updates.updatedRows || appendResult.data.updates.updatedRows < toAdd.length) {
                    console.error(`[BACKEND][cloud-sync][Caixa][CONFIRMATION FAIL] Append falhou ou incompleto. Esperado: ${toAdd.length}, Atualizado: ${appendResult.data.updates?.updatedRows}`);
                    writeConfirmationError = writeConfirmationError || `Falha ao confirmar append (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][Caixa][CONFIRMATION OK] Append confirmado: ${appendResult.data.updates.updatedRows} linhas.`);
                    newC = toAdd.length;
                }
            }
            if (toUpdate.length > 0) {
                const batchUpdateResult = await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
                 // --- CONFIRMAÇÃO BATCH UPDATE ---
                if (!batchUpdateResult.data || !batchUpdateResult.data.totalUpdatedRows || batchUpdateResult.data.totalUpdatedRows < toUpdate.length) {
                    console.error(`[BACKEND][cloud-sync][Caixa][CONFIRMATION FAIL] BatchUpdate falhou ou incompleto. Esperado: ${toUpdate.length}, Atualizado: ${batchUpdateResult.data?.totalUpdatedRows}`);
                    writeConfirmationError = writeConfirmationError || `Falha ao confirmar update (Caixa) para ${sheetName}.`;
                } else {
                    console.log(`[BACKEND][cloud-sync][Caixa][CONFIRMATION OK] BatchUpdate confirmado: ${batchUpdateResult.data.totalUpdatedRows} linhas.`);
                    updatedC = toUpdate.length;
                }
            }
        }
    } // Fim Caixas

    // Lança erro se a confirmação de escrita de Caixa falhou
    if (writeConfirmationError) throw new Error(writeConfirmationError);

    console.log(`[BACKEND][cloud-sync] Finalizado com SUCESSO para ${eventName}. Resultado:`, { newW, updatedW, newC, updatedC });
    res.status(200).json({ newWaiters: newW, updatedWaiters: updatedW, newCashiers: newC, updatedCashiers: updatedC });

  } catch (error) {
    // Se writeConfirmationError foi definido OU ocorreu outro erro
    console.error(`[BACKEND][cloud-sync] Erro durante o processamento para ${eventName}:`, error);
    res.status(500).json({ message: writeConfirmationError || 'Erro interno do servidor ao salvar na nuvem.' });
  }
});

// ... (Resto das rotas: /api/online-history, /api/export-online-data, /api/reconcile-yuzer) ...
// ... (Inicialização condicional) ...
module.exports = app;

if (!isRunningInElectron) {
  // ... (código listen) ...
} else {
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}

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
                    const rowObj = Object.fromEntries(header.map((key, i) => [key.trim(), row[i]])); //
                    const closingObject = { //
                        type: 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['Nome Garçom'], protocol: rowObj['Protocolo'], //
                        valorTotal: parseSisfoCurrency(rowObj['Venda Total']), //
                        valorEstorno: parseSisfoCurrency(rowObj['Devolução/Estorno']), //
                        comissaoTotal: parseSisfoCurrency(rowObj['Comissão Total']), //
                        diferencaPagarReceber: parseSisfoCurrency(rowObj['Acerto']), //
                        credito: parseSisfoCurrency(rowObj['Crédito']), //
                        debito: parseSisfoCurrency(rowObj['Débito']), // Corrigido de 'Délito'
                        pix: parseSisfoCurrency(rowObj['Pix']), //
                        cashless: parseSisfoCurrency(rowObj['Cashless']), //
                        numeroMaquina: rowObj['Nº Máquina'], operatorName: rowObj['Operador'], timestamp: rowObj['Data'], //
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
                    const rowObj = Object.fromEntries(header.map((key, i) => [key.trim(), row[i]])); //
                    const type = rowObj['Tipo'] || ''; //
                    const protocol = rowObj['Protocolo'] || ''; //
                    const baseCashierObject = { //
                        protocol, eventName, operatorName: rowObj['Operador'], timestamp: rowObj['Data'], cpf: rowObj['CPF'], //
                        cashierName: rowObj['Nome do Caixa'], numeroMaquina: rowObj['Nº Máquina'], //
                        valorTotalVenda: parseSisfoCurrency(rowObj['Venda Total']), //
                        credito: parseSisfoCurrency(rowObj['Crédito']), //
                        debito: parseSisfoCurrency(rowObj['Débito']), // Corrigido de 'Délito'
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
                        // Adiciona identificador para caixa fixo individual vindo da nuvem
                        return { ...baseCashierObject, type: 'individual_fixed_cashier', groupProtocol: protocol.substring(0, protocol.lastIndexOf('-')) }; //
                    } else {
                        // Caixa Móvel mantém o type 'cashier'
                        return { ...baseCashierObject, type: 'cashier' }; //
                    }
                }).filter(Boolean); //
                allClosings.push(...data); //
            }
        }
        
        // --- INÍCIO DA MODIFICAÇÃO (PASSO 3.2) ---
        // Substituído o bloco de formatação de data
        allClosings.forEach(closing => { //
            const dateString = closing.timestamp; //
            let finalDate = new Date(0); // Data padrão inválida
            
            if (dateString && typeof dateString === 'string') { //
                
                // Tenta parsear como ISO string PRIMEIRO (que é o novo padrão)
                let parsedDate = new Date(dateString); //
                
                // Verifica se o parse ISO foi válido (datas válidas serão > 2000)
                if (!isNaN(parsedDate) && parsedDate.getFullYear() > 2000) {
                    finalDate = parsedDate;
                } else {
                    // Tenta o formato legado "DD/MM/YYYY HH:MM:SS" (fallback)
                    // Adicionada a vírgula opcional (,) na RegEx
                    const matchBr = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/); //
                    if (matchBr) {
                        const [, day, month, year, hour, minute, second] = matchBr;
                        const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`; //
                        parsedDate = new Date(isoDateString); //
                         if (!isNaN(parsedDate)) finalDate = parsedDate; //
                    }
                }
            }
            closing.timestamp = finalDate.toISOString(); // Converte para ISO string
        });
        // --- FIM DA MODIFICAÇÃO (PASSO 3.2) ---

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
          // Mapeamento robusto de colunas
          const idxData = header.indexOf('DATA'); //
          const idxProtocolo = header.indexOf('PROTOCOLO'); //
          const idxCpf = header.indexOf('CPF'); //
          const idxNome = header.indexOf('NOME GARÇOM'); //
          const idxMaquina = header.findIndex(h => h === 'Nº MÁQUINA' || h === 'Nº MAQUINA'); //
          const idxVendaTotal = header.findIndex(h => h === 'VENDA TOTAL' || h === 'VALOR TOTAL VENDA'); //
          const idxCredito = header.indexOf('CRÉDITO'); //
          const idxDebito = header.indexOf('DÉBITO'); //
          const idxPix = header.indexOf('PIX'); //
          const idxCashless = header.indexOf('CASHLESS'); //
          const idxEstorno = header.indexOf('DEVOLUÇÃO/ESTORNO'); //
          const idxComissao = header.indexOf('COMISSÃO TOTAL'); //
          const idxAcerto = header.indexOf('ACERTO'); //
          const idxOperador = header.indexOf('OPERADOR'); //
          const rows = response.data.values.slice(1); //

          consolidatedWaiters = rows.map(row => { //
              const rowData = { //
                  eventName: eventName, //
                  'DATA': idxData !== -1 ? row[idxData] : '', //
                  'PROTOCOLO': idxProtocolo !== -1 ? row[idxProtocolo] : '', //
                  'CPF': idxCpf !== -1 ? row[idxCpf] : '', //
                  'NOME GARÇOM': idxNome !== -1 ? row[idxNome] : '', //
                  'Nº MAQUINA': idxMaquina !== -1 ? row[idxMaquina] : '', //
                  'VALOR TOTAL VENDA': idxVendaTotal !== -1 ? row[idxVendaTotal] : '', //
                  'CRÉDITO': idxCredito !== -1 ? row[idxCredito] : '', //
                  'DÉBITO': idxDebito !== -1 ? row[idxDebito] : '', //
                  'PIX': idxPix !== -1 ? row[idxPix] : '', //
                  'CASHLESS': idxCashless !== -1 ? row[idxCashless] : '', //
                  'DEVOLUÇÃO ESTORNO': idxEstorno !== -1 ? row[idxEstorno] : '', //
                  'COMISSÃO TOTAL': idxComissao !== -1 ? row[idxComissao] : '', //
                  'ACERTO': idxAcerto !== -1 ? row[idxAcerto] : '', //
                  'OPERADOR': idxOperador !== -1 ? row[idxOperador] : '' //
              };
              // Garante que todas as chaves esperadas existam com valor vazio se não encontradas
              Object.keys(rowData).forEach(key => { if (rowData[key] === undefined) { rowData[key] = ''; } }); //
              return rowData; //
          });
      }
    } catch (e) { console.log(`Aba de Garçons para o evento "${eventName}" não encontrada ou erro ao ler. Continuando...`); } //

    // --- SEÇÃO DE CAIXAS ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Caixas - ${eventName}` }); //
      if (response.data.values && response.data.values.length > 1) { //
          const header = response.data.values[0].map(h => String(h).trim().toUpperCase()); // Padroniza header para maiúsculas
          consolidatedCashiers = response.data.values.slice(1).map(row => { //
              const rowData = { eventName }; //
              // Mapeia usando o header padronizado
              header.forEach((key, index) => { rowData[key] = row[index] || ''; }); //
              return rowData; //
          });
      }
    } catch (e) { console.log(`Aba de Caixas para o evento "${eventName}" não encontrada ou erro ao ler. Continuando...`); } //

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
    // Função para extrair os últimos 8 dígitos numéricos
    const getLast8Digits = (serial) => { //
        if (!serial) return ''; //
        const digitsOnly = String(serial).replace(/\D/g, ''); //
        return digitsOnly.slice(-8); //
    };

    // --- processSheet AGORA USA normalizeToCentavos ---
    const processSheet = (response, isWaiterSheet) => { //
        if (!response.data.values || response.data.values.length < 2) return; //
        const [header, ...rows] = response.data.values; //
        // Mapeamento robusto de colunas
        const cpfIndex = header.findIndex(h => h.toUpperCase() === 'CPF'); //
        const nameIndex = header.findIndex(h => isWaiterSheet ? h.toUpperCase() === 'NOME GARÇOM' : h.toUpperCase() === 'NOME DO CAIXA'); //
        const machineIndex = header.findIndex(h => h.toUpperCase() === 'Nº MAQUINA' || h.toUpperCase() === 'Nº MÁQUINA'); //
        const totalIndex = header.findIndex(h => h.toUpperCase() === 'VENDA TOTAL' || h.toUpperCase() === 'VALOR TOTAL VENDA'); //
        const creditIndex = header.findIndex(h => h.toUpperCase() === 'CRÉDITO'); //
        const debitIndex = header.findIndex(h => h.toUpperCase() === 'DÉBITO'); //
        const pixIndex = header.findIndex(h => h.toUpperCase() === 'PIX'); //
        const cashlessIndex = header.findIndex(h => h.toUpperCase() === 'CASHLESS'); //
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) { //
            console.warn(`[RECONCILE] Cabeçalhos essenciais (CPF, Nome, Máquina) não encontrados na aba ${isWaiterSheet ? 'Garçons' : 'Caixas'}.`); //
            return; //
        }
        rows.forEach(row => { //
            const cpf = row[cpfIndex]?.replace(/\D/g, ''); //
            if (cpf) { //
                if (!sisfoData.has(cpf)) { sisfoData.set(cpf, []); } //
                // Aplica normalizeToCentavos aos valores lidos da planilha SisFO
                // Todos os valores SisFO agora serão CENTAVOS
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
    // --- FIM DO processSheet ATUALIZADO ---

    // Lê dados do SisFO (Google Sheets)
    try {
        const [waiterRes, cashierRes] = await Promise.allSettled([ //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A:Z` }), //
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` }) //
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true); //
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false); //
    } catch (e) { console.log(`Abas SisFO para o evento "${eventName}" não encontradas ou erro ao ler.`); } //

    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`); //
    console.log(`${sisfoData.size} CPFs distintos carregados do SisFO.`); //
    let divergences = [], totemsFound = 0, recordsCompared = 0, unmatchedYuzerRecords = 0; //

    // Processa dados do Yuzer (recebidos no req.body)
    yuzerData.forEach((yuzerRow) => { //
      // Ignora totens/PDVs
      const operator = yuzerRow['Operador de Caixa']; //
      if (operator && String(operator).toLowerCase().includes('pdv')) { totemsFound++; return; } //
      // Extrai CPF e Serial
      const cpf = String(yuzerRow['CPF'] || '').replace(/\D/g, ''); //
      const serial = yuzerRow['Serial']; //
      if (!cpf || !serial) { //
          console.log(`[RECONCILE] Linha Yuzer ignorada: CPF ou Serial ausente. Operador: ${operator || 'N/A'}`); //
          return; //
      }
      // Extrai chave da máquina (últimos 8 dígitos)
      const machineKey = getLast8Digits(serial); //
      if (!machineKey) { //
          console.log(`[RECONCILE] Linha Yuzer ignorada: Não foi possível extrair 8 dígitos da máquina. Serial: ${serial}`); //
          return; //
      }
      // Verifica se CPF existe nos dados SisFO
      if (!sisfoData.has(cpf)) { //
          unmatchedYuzerRecords++; //
          console.log(`[RECONCILE] CPF ${cpf} (Máquina ${machineKey}) do Yuzer não encontrado no SisFO.`); //
          return; //
      }
      // Procura registro SisFO com a mesma chave de máquina
      const sisfoRecordsForCpf = sisfoData.get(cpf); //
      const recordIndex = sisfoRecordsForCpf.findIndex(rec => rec.machine === machineKey); //
      if (recordIndex === -1) { //
        unmatchedYuzerRecords++; //
        console.log(`[RECONCILE] CPF ${cpf} encontrado no SisFO, mas NENHUM registro com os 8 dígitos da máquina (${machineKey}). Máquinas SisFO: ${sisfoRecordsForCpf.map(r => r.machine).join(', ')}`); //
        return; //
      }
      recordsCompared++; //
      const sisfoRecord = sisfoRecordsForCpf[recordIndex]; // sisfoRecord.credit é CENTAVOS

      // --- CRIAÇÃO DO yuzerRecord (NORMALIZADO PARA CENTAVOS) ---
      // Aplica normalizeToCentavos aos valores do Yuzer
      // Todos os valores Yuzer agora serão CENTAVOS
      const yuzerRecord = { //
        total: normalizeToCentavos(yuzerRow['Total']), //
        credit: normalizeToCentavos(yuzerRow['Crédito']), //
        debit: normalizeToCentavos(yuzerRow['Débito']), //
        pix: normalizeToCentavos(yuzerRow['Pix']), //
        cashless: normalizeToCentavos(yuzerRow['Cashless']) //
      };
      // --- FIM DA CRIAÇÃO ---

      console.log(`--> COMPARANDO CPF: ${cpf}, CHAVE MÁQUINA: ${machineKey}`); //
      console.log("    DADOS YUZER (em CENTAVOS) ->", JSON.stringify(yuzerRecord)); // Log corrigido
      console.log("    DADOS SISFO (em CENTAVOS) ->", JSON.stringify(sisfoRecord)); // Log corrigido

      // Função para comparar valores em CENTAVOS e registrar divergências em REAIS
      const checkDiff = (field, yuzerVal_centavos, sisfoVal_centavos) => { //
        // A comparação agora é entre CENTAVOS (yuzerVal) e CENTAVOS (sisfoVal)
        if (Math.abs(yuzerVal_centavos - sisfoVal_centavos) > 0.01) { // Usa 0.01 para comparar centavos
          // Arredonda para o centavo mais próximo e divide por 100 para o log/relatório
          const yuzerLog = (Math.round(yuzerVal_centavos) / 100).toFixed(2); //
          const sisfoLog = (Math.round(sisfoVal_centavos) / 100).toFixed(2); //

          console.log(`    !!! DIVERGÊNCIA [${field}]: Yuzer=${yuzerLog}, SisFO=${sisfoLog}`); //
          // Reporta os valores em REAIS (dividindo por 100) para o usuário final
          divergences.push({ //
              name: sisfoRecord.name, //
              cpf, //
              machine: machineKey, //
              field, //
              yuzerValue: yuzerLog, // Converte de volta para Reais para o Log
              sisfoValue: sisfoLog  // Converte de volta para Reais para o Log
            });
        }
      };

      // Compara todos os campos relevantes
      checkDiff('Valor Total', yuzerRecord.total, sisfoRecord.total); //
      checkDiff('Crédito', yuzerRecord.credit, sisfoRecord.credit); //
      checkDiff('Débito', yuzerRecord.debit, sisfoRecord.debit); //
      checkDiff('PIX', yuzerRecord.pix, sisfoRecord.pix); //
      checkDiff('Cashless', yuzerRecord.cashless, sisfoRecord.cashless); //

      // Remove o registro SisFO para não comparar novamente se houver múltiplas máquinas para o mesmo CPF
      sisfoRecordsForCpf.splice(recordIndex, 1); //
    });

    console.log("\n--- CONCILIAÇÃO FINALIZADA ---"); //
    // Retorna o resultado da conciliação
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
  // Se rodando no Electron, apenas exporta o app para o main.js
  console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}