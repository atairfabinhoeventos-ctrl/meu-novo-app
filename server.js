// server.js (VERSÃO FINAL COM EXPORTAÇÃO CORRIGIDA POR ÍNDICE)
console.log("--- EXECUTANDO A VERSÃO FINAL COM EXPORTAÇÃO CORRIGIDA POR ÍNDICE ---");

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();

// --- LÓGICA DE CAMINHO UNIVERSAL ---
const isRunningInElectron = !!process.versions['electron'];
const isProduction = process.env.NODE_ENV === 'production';
const isProdElectron = isRunningInElectron && isProduction;
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname;
require('dotenv').config({ path: path.join(resourcesPath, '.env') });
// --- FIM DA LÓGICA DE CAMINHO ---

app.use(express.json({ limit: '50mb' }));
app.use(cors());

const parseCurrency = (val) => parseFloat(String(val || '0').replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;

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

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOqrufSL_cQKuOQag6AuE';
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ';

// --- ROTA DE SYNC MASTER-DATA ---
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.batchGet({
            spreadsheetId: spreadsheetId_sync,
            ranges: ['Garcons!A2:B', 'Eventos!A2:B'], // Corrigido Eventos!A2:B
        });
        const valueRanges = response.data.valueRanges || [];
        const waiterRows = valueRanges[0]?.values || [];
        const waiters = waiterRows.map(row => ({ cpf: row[0], name: row[1] }));
        const eventRows = valueRanges[1]?.values || [];
        const events = eventRows.map(row => ({
          name: row[0],
          active: row[1] ? row[1].toUpperCase() === 'ATIVO' : true, // Coluna B (index 1)
        })).filter(e => e.name);
        console.log(`[BACKEND] Encontrados ${waiters.length} funcionários e ${events.length} eventos.`);
        res.status(200).json({ waiters, events });
    } catch (error) {
        console.error('Erro ao buscar master-data:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar dados mestre.' });
    }
});

// --- ROTA: ATUALIZAR BASE DE CADASTRO ONLINE ---
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
            range: 'Eventos!A:B', // Salva em A:B
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

// --- ROTA: ATUALIZAR STATUS DE UM ÚNICO EVENTO ---
app.post('/api/update-event-status', async (req, res) => {
  const { name, active } = req.body;
  if (!name) { return res.status(400).json({ message: 'O nome do evento é obrigatório.' }); }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const range = 'Eventos!A2:B'; // Lê A:B
    const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: range });
    const rows = response.data.values || [];
    const eventIndex = rows.findIndex(row => row[0] && row[0].trim() === name.trim());
    if (eventIndex === -1) { return res.status(404).json({ message: `Evento "${name}" não encontrado na planilha online.` }); }
    const targetRow = eventIndex + 2;
    const targetRange = `Eventos!B${targetRow}`; // Atualiza a Coluna B (Status)
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

// --- ROTA DE SYNC PARA A NUVEM (sem alteração) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });
  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let newW = 0, updatedW = 0, newC = 0, updatedC = 0;
    if (waiterData && waiterData.length > 0) {
      const sheetName = `Garçons - ${eventName}`;
      const header = [ "Data", "Protocolo", "CPF", "Nome Garçom", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
      const rows = waiterData.map(c => [ c.timestamp, c.protocol, c.cpf, c.waiterName, c.numeroMaquina, c.valorTotal, c.credito, c.debito, c.pix, c.cashless, c.valorEstorno, c.comissaoTotal, c.acerto, c.operatorName ]);
      const sheet = sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
        if (rows.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
        newW = rows.length;
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
        const existingRows = response.data.values || [];
        const protocolColumnIndex = 1; 
        const protocolMap = new Map();
        existingRows.slice(1).forEach((row, index) => {
            const protocol = row[protocolColumnIndex];
            if (protocol) protocolMap.set(protocol.trim(), { row: row, index: index + 2 });
        });
        const toAdd = [], toUpdate = [];
        rows.forEach(newRow => {
            const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
            if (p && protocolMap.has(p)) {
                // (Lógica de atualização de linha existente...)
                const existing = protocolMap.get(p);
                let hasChanged = false;
                for (let i = 0; i < newRow.length; i++) {
                    if ([0, 1, 2, 3, 4, 13].includes(i)) {
                        if (String(existing.row[i] || '').trim() !== String(newRow[i] || '').trim()) { hasChanged = true; break; }
                    } else {
                        if (Math.abs(parseCurrency(existing.row[i]) - parseCurrency(newRow[i])) > 0.01) { hasChanged = true; break; }
                    }
                }
                if (hasChanged) { toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [newRow] }); }
            } else { toAdd.push(newRow); }
        });
        if (toAdd.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
        if (toUpdate.length > 0) await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
        newW = toAdd.length; updatedW = toUpdate.length;
      }
    }
    if (cashierData && cashierData.length > 0) {
        const sheetName = `Caixas - ${eventName}`;
        const header = [ "Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Troco", "Devolução/Estorno", "Dinheiro Físico", "Valor Acerto", "Diferença", "Operador" ];
        const rows = cashierData.map(c => [ c.protocol, c.timestamp, c.type, (c.cpf || c.CPF), c.cashierName, c.numeroMaquina, c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco, c.valorEstorno, c.dinheiroFísico, c.valorAcerto, c.diferenca, c.operatorName ]);
        const sheet = sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
            if (rows.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            newC = rows.length;
        } else {
             // (Lógica de atualização de linha existente...)
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            const existingRows = response.data.values || [];
            const protocolColumnIndex = 0;
            const protocolMap = new Map();
            existingRows.slice(1).forEach((row, index) => {
                const protocol = row[protocolColumnIndex];
                if (protocol) protocolMap.set(protocol.trim(), { row: row, index: index + 2 });
            });
            const toAdd = [], toUpdate = [];
            rows.forEach(newRow => {
                const p = newRow[protocolColumnIndex] ? String(newRow[protocolColumnIndex]).trim() : null;
                if (p && protocolMap.has(p)) {
                    const existing = protocolMap.get(p);
                     let hasChanged = false;
                    for (let i = 0; i < newRow.length; i++) {
                        if ([0, 1, 2, 3, 4, 5, 16].includes(i)) {
                            if (String(existing.row[i] || '').trim() !== String(newRow[i] || '').trim()) { hasChanged = true; break; }
                        } else {
                            if (Math.abs(parseCurrency(existing.row[i]) - parseCurrency(newRow[i])) > 0.01) { hasChanged = true; break; }
                        }
                    }
                    if (hasChanged) { toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [newRow] }); }
                } else { toAdd.push(newRow); }
            });
            if (toAdd.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
            if (toUpdate.length > 0) await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
            newC = toAdd.length; updatedC = toUpdate.length;
        }
    }
    res.status(200).json({ newWaiters: newW, updatedWaiters: updatedW, newCashiers: newC, updatedCashiers: updatedC });
  } catch (error) {
    console.error('Erro ao salvar dados na nuvem:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao salvar na nuvem.' });
  }
});

// --- ROTA DE HISTÓRICO ONLINE (sem alteração) ---
app.post('/api/online-history', async (req, res) => {
    // ... (código existente) ...
    const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) return res.status(401).json({ message: 'Acesso não autorizado.' });
    try {
        const googleSheets = await getGoogleSheetsClient();
        const waiterSheetName = `Garçons - ${eventName}`;
        const cashierSheetName = `Caixas - ${eventName}`;
        const [waiterResult, cashierResult] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName })
        ]);
        let allClosings = [];
        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
            const [header, ...rows] = waiterResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [key.trim(), row[i]]));
                    const closingObject = { type: 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['Nome Garçom'], protocol: rowObj['Protocolo'], valorTotal: parseCurrency(rowObj['Venda Total']), valorEstorno: parseCurrency(rowObj['Devolução/Estorno']), comissaoTotal: parseCurrency(rowObj['Comissão Total']), diferencaPagarReceber: parseCurrency(rowObj['Acerto']), credito: parseCurrency(rowObj['Crédito']), debito: parseCurrency(rowObj['Débito']), pix: parseCurrency(rowObj['Pix']), cashless: parseCurrency(rowObj['Cashless']), numeroMaquina: rowObj['Nº Máquina'], operatorName: rowObj['Operador'], timestamp: rowObj['Data'], };
                    closingObject.diferencaLabel = closingObject.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom';
                    closingObject.diferencaPagarReceber = Math.abs(closingObject.diferencaPagarReceber);
                    return closingObject;
                });
                allClosings.push(...data);
            }
        }
        if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) {
            const [header, ...rows] = cashierResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [key.trim(), row[i]]));
                    const type = rowObj['Tipo'] || '';
                    const protocol = rowObj['Protocolo'] || '';
                    const baseCashierObject = { protocol, eventName, operatorName: rowObj['Operador'], timestamp: rowObj['Data'], cpf: rowObj['CPF'], cashierName: rowObj['Nome do Caixa'], numeroMaquina: rowObj['Nº Máquina'], valorTotalVenda: parseCurrency(rowObj['Venda Total']), credito: parseCurrency(rowObj['Crédito']), debito: parseCurrency(rowObj['Débito']), pix: parseCurrency(rowObj['Pix']), cashless: parseCurrency(rowObj['Cashless']), valorTroco: parseCurrency(rowObj['Troco']), temEstorno: parseCurrency(rowObj['Devolução/Estorno']) > 0, valorEstorno: parseCurrency(rowObj['Devolução/Estorno']), dinheiroFisico: parseCurrency(rowObj['Dinheiro Físico']), valorAcerto: parseCurrency(rowObj['Valor Acerto']), diferenca: parseCurrency(rowObj['Diferença']), };
                    if (type === 'Fixo') {
                        return { ...baseCashierObject, type: 'individual_fixed_cashier', groupProtocol: protocol.substring(0, protocol.lastIndexOf('-')) };
                    } else {
                        return { ...baseCashierObject, type: 'cashier' };
                    }
                }).filter(Boolean);
                allClosings.push(...data);
            }
        }
        allClosings.forEach(closing => {
            const dateString = closing.timestamp;
            let finalDate = new Date(0);
            if (dateString && typeof dateString === 'string') {
                const [datePart, timePart] = dateString.split(' ');
                if (datePart && timePart) {
                    const [day, month, year] = datePart.split('/');
                    if (day && month && year) {
                        const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
                        const parsedDate = new Date(isoDateString);
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


// --- ROTA DE EXPORTAÇÃO (NOVA LÓGICA À PROVA DE FALHAS) ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    let consolidatedWaiters = [], consolidatedCashiers = [];

    // --- SEÇÃO DE GARÇONS (FUNCIONÁRIOS) ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Garçons - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          
          // 1. Lê os cabeçalhos da planilha (Ex: "Nº MÁQUINA") e normaliza
          const header = response.data.values[0].map(h => String(h).trim().toUpperCase());
          
          // 2. Encontra o ÍNDICE (posição) de cada cabeçalho
          // (Não importa se é 'Nº MÁQUINA' ou 'Nº MAQUINA', o toUpperCase() normaliza,
          // mas vamos buscar o que está na planilha de destino)
          const idxData = header.indexOf('DATA');
          const idxProtocolo = header.indexOf('PROTOCOLO');
          const idxCpf = header.indexOf('CPF');
          const idxNome = header.indexOf('NOME GARÇOM');
          const idxMaquina = header.findIndex(h => h === 'Nº Máquina' || h === 'Nº MAQUINA');
          const idxVendaTotal = header.findIndex(h => h === 'Venda Total' || h === 'VALOR TOTAL VENDA');
          const idxCredito = header.indexOf('CRÉDITO');
          const idxDebito = header.indexOf('DÉBITO');
          const idxPix = header.indexOf('PIX');
          const idxCashless = header.indexOf('CASHLESS');
          const idxEstorno = header.indexOf('DEVOLUÇÃO/ESTORNO'); // Lê com barra
          const idxComissao = header.indexOf('COMISSÃO TOTAL');
          const idxAcerto = header.indexOf('ACERTO');
          const idxOperador = header.indexOf('OPERADOR');

          // 3. Lê as linhas de dados
          const rows = response.data.values.slice(1);
          
          // 4. Monta o JSON manualmente, usando as chaves exatas que o ExportDataPage.jsx espera
          consolidatedWaiters = rows.map(row => {
              const rowData = {
                  eventName: eventName,
                  // As chaves aqui (ex: 'Nº MAQUINA') batem 100% com o ExportDataPage.jsx
                  'DATA': idxData !== -1 ? row[idxData] : '',
                  'PROTOCOLO': idxProtocolo !== -1 ? row[idxProtocolo] : '',
                  'CPF': idxCpf !== -1 ? row[idxCpf] : '',
                  'NOME GARÇOM': idxNome !== -1 ? row[idxNome] : '',
                  'Nº MAQUINA': idxMaquina !== -1 ? row[idxMaquina] : '', // Chave SEM acento
                  'VALOR TOTAL VENDA': idxVendaTotal !== -1 ? row[idxVendaTotal] : '', // Chave com NOME LONGO
                  'CRÉDITO': idxCredito !== -1 ? row[idxCredito] : '',
                  'DÉBITO': idxDebito !== -1 ? row[idxDebito] : '',
                  'PIX': idxPix !== -1 ? row[idxPix] : '',
                  'CASHLESS': idxCashless !== -1 ? row[idxCashless] : '',
                  'DEVOLUÇÃO ESTORNO': idxEstorno !== -1 ? row[idxEstorno] : '', // Chave SEM barra
                  'COMISSÃO TOTAL': idxComissao !== -1 ? row[idxComissao] : '',
                  'ACERTO': idxAcerto !== -1 ? row[idxAcerto] : '',
                  'OPERADOR': idxOperador !== -1 ? row[idxOperador] : ''
              };
              // Limpa valores indefinidos caso o índice não seja encontrado
              Object.keys(rowData).forEach(key => {
                  if (rowData[key] === undefined) { rowData[key] = ''; }
              });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Garçons para o evento "${eventName}" não encontrada. Continuando...`); }
    
    // --- SEÇÃO DE CAIXAS (JÁ ESTAVA FUNCIONANDO, SEM MUDANÇAS) ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Caixas - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0].map(h => String(h).trim());
          consolidatedCashiers = response.data.values.slice(1).map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => {
                  rowData[String(key).trim().toUpperCase()] = row[index] || '';
              });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Caixas para o evento "${eventName}" não encontrada. Continuando...`); }
    
    if (consolidatedWaiters.length === 0 && consolidatedCashiers.length === 0) {
        return res.status(404).json({ message: 'Nenhum dado encontrado para este evento na nuvem.' });
    }
    res.status(200).json({ waiters: consolidatedWaiters, cashiers: consolidatedCashiers });
  } catch (error) {
    console.error('Erro ao exportar dados da nuvem por evento:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar os dados.' });
  }
});
// --- FIM DA ROTA DE EXPORTAÇÃO ---


// --- ROTA DE RECONCILIAÇÃO YUZER (sem alteração) ---
app.post('/api/reconcile-yuzer', async (req, res) => {
  // ... (código existente) ...
  const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) {
    return res.status(400).json({ message: 'Nome do evento e dados da planilha são obrigatórios.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const waiterSheetName = `Garçons - ${eventName}`;
    const cashierSheetName = `Caixas - ${eventName}`;
    let sisfoData = new Map();
    const getLast8Digits = (serial) => {
        if (!serial) return '';
        const digitsOnly = String(serial).replace(/\D/g, '');
        return digitsOnly.slice(-8);
    };
    const processSheet = (response, isWaiterSheet) => {
        if (!response.data.values || response.data.values.length < 2) return;
        const [header, ...rows] = response.data.values;
        const cpfIndex = header.findIndex(h => h.toUpperCase() === 'CPF');
        const nameIndex = header.findIndex(h => isWaiterSheet ? h.toUpperCase() === 'NOME GARÇOM' : h.toUpperCase() === 'NOME DO CAIXA');
        const machineIndex = header.findIndex(h => h.toUpperCase() === 'Nº MAQUINA' || h.toUpperCase() === 'Nº MÁQUINA');
        const totalIndex = header.findIndex(h => h.toUpperCase() === 'VENDA TOTAL' || h.toUpperCase() === 'VALOR TOTAL VENDA');
        const creditIndex = header.findIndex(h => h.toUpperCase() === 'CRÉDITO');
        const debitIndex = header.findIndex(h => h.toUpperCase() === 'DÉBITO');
        const pixIndex = header.findIndex(h => h.toUpperCase() === 'PIX');
        const cashlessIndex = header.findIndex(h => h.toUpperCase() === 'CASHLESS');
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) return;
        rows.forEach(row => {
            const cpf = row[cpfIndex]?.replace(/\D/g, '');
            if (cpf) {
                if (!sisfoData.has(cpf)) { sisfoData.set(cpf, []); }
                sisfoData.get(cpf).push({ name: row[nameIndex], machine: getLast8Digits(row[machineIndex]), total: parseCurrency(row[totalIndex]), credit: parseCurrency(row[creditIndex]), debit: parseCurrency(row[debitIndex]), pix: parseCurrency(row[pixIndex]), cashless: parseCurrency(row[cashlessIndex]) });
            }
        });
    };
    try {
        const [waiterRes, cashierRes] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A:Z` }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` })
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true);
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false);
    } catch (e) { console.log(`Abas para o evento "${eventName}" não encontradas.`); }
    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`);
    console.log(`${sisfoData.size} CPFs distintos carregados do SisFO.`);
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
      if (recordIndex === -1) {
        unmatchedYuzerRecords++;
        console.log(`--> CPF ${cpf} encontrado, mas NENHUM registro com os 8 dígitos da máquina (${machineKey}) no SisFO.`);
        return;
      }
      recordsCompared++;
      const sisfoRecord = sisfoRecordsForCpf[recordIndex];
      const yuzerRecord = { total: parseCurrency(yuzerRow['Total']), credit: parseCurrency(row[creditIndex]), debit: parseCurrency(row[debitIndex]), pix: parseCurrency(row[pixIndex]), cashless: parseCurrency(row[cashlessIndex]), };
      console.log(`--> COMPARANDO CPF: ${cpf}, CHAVE MÁQUINA: ${machineKey}`);
      console.log("DADOS YUZER  ->", JSON.stringify(yuzerRecord));
      console.log("DADOS SISFO  ->", JSON.stringify(sisfoRecord));
      const checkDiff = (field, yuzerVal, sisfoVal) => {
        if (Math.abs(yuzerVal - sisfoVal) > 0.01) {
          divergences.push({ name: sisfoRecord.name, cpf, machine: machineKey, field, yuzerValue: yuzerVal.toFixed(2), sisfoValue: sisfoVal.toFixed(2) });
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
      recordsCompared,
      totemsFound,
      unmatchedYuzerRecords,
      divergencesFound: divergences.length,
      divergences
    });
  } catch (error) {
    console.error('Erro na conciliação Yuzer:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar a conciliação.' });
  }
});


// --- INICIALIZAÇÃO CONDICIONAL ---
module.exports = app;

if (!isRunningInElectron) {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => { 
    console.log(`Servidor backend (Render) rodando na porta ${PORT}`);
  });
}