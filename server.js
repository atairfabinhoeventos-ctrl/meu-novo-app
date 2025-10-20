// server.js (VERSÃO FINAL COM parseSisfoCurrency CORRIGIDO)
console.log("--- EXECUTANDO VERSÃO FINAL COM parseSisfoCurrency CORRIGIDO ---");

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

// --- parseSisfoCurrency CORRIGIDO (VERSÃO ROBUSTA) ---
/**
 * Converte valor de formatos comuns (R$, ',', '.', inteiro) para número decimal.
 * Trata formatos brasileiros ("1.234,56") e americanos ("1234.56").
 */
const parseSisfoCurrency = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return 0;

    let stringValue = String(val).trim();

    // Remove "R$" prefix if present
    if (stringValue.toUpperCase().startsWith('R$')) {
        stringValue = stringValue.substring(2).trim();
    }

    const lastPointIndex = stringValue.lastIndexOf('.');
    const lastCommaIndex = stringValue.lastIndexOf(',');

    // Se a vírgula vem DEPOIS do ponto (ex: "1.234,56")
    // ou se SÓ tem vírgula (ex: "1234,56")
    // -> É formato brasileiro.
    if (lastCommaIndex > lastPointIndex) {
        stringValue = stringValue.replace(/\./g, ''); // Remove pontos de milhar
        stringValue = stringValue.replace(/,/g, '.'); // Troca vírgula decimal
    }
    // Se o ponto vem DEPOIS da vírgula (ex: "1,234.56")
    // -> É formato americano com vírgula de milhar.
    else if (lastPointIndex > lastCommaIndex) {
         stringValue = stringValue.replace(/,/g, ''); // Remove vírgulas de milhar
    }
    // Se não tem vírgula (ex: "1234.56" ou "1234"), 
    // assume que o formato está correto (ponto é decimal ou não há decimal).

    // Remove quaisquer outros caracteres não numéricos (exceto o ponto decimal)
    stringValue = stringValue.replace(/[^0-9.]/g, '');

    // Tenta converter para float
    const numberValue = parseFloat(stringValue);

    // Retorna 0 se a conversão falhar (NaN)
    return isNaN(numberValue) ? 0 : numberValue;
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

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE'; // Ajuste se necessário
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ'; // Ajuste se necessário

// --- ROTA DE SYNC MASTER-DATA ---
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

// --- ROTA DE SYNC PARA A NUVEM ---
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
                const existing = protocolMap.get(p);
                let hasChanged = false;
                for (let i = 0; i < newRow.length; i++) {
                    if ([0, 1, 2, 3, 4, 13].includes(i)) {
                        if (String(existing.row[i] || '').trim() !== String(newRow[i] || '').trim()) { hasChanged = true; break; }
                    } else {
                         // Usa parseSisfoCurrency para comparar valores da planilha
                         if (Math.abs(parseSisfoCurrency(existing.row[i]) - newRow[i]) > 0.01) { hasChanged = true; break; }
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
           // ... (criação da aba) ...
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
            if (rows.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            newC = rows.length;
        } else {
             // ... (atualização de linhas existentes, usando parseSisfoCurrency para comparar) ...
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
                             // Usa parseSisfoCurrency para comparar valores da planilha
                            if (Math.abs(parseSisfoCurrency(existing.row[i]) - newRow[i]) > 0.01) { hasChanged = true; break; }
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

// --- ROTA DE HISTÓRICO ONLINE ---
app.post('/api/online-history', async (req, res) => {
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
                    // Usa parseSisfoCurrency
                    const closingObject = {
                        type: 'waiter', cpf: rowObj['CPF'], waiterName: rowObj['Nome Garçom'], protocol: rowObj['Protocolo'],
                        valorTotal: parseSisfoCurrency(rowObj['Venda Total']),
                        valorEstorno: parseSisfoCurrency(rowObj['Devolução/Estorno']),
                        comissaoTotal: parseSisfoCurrency(rowObj['Comissão Total']),
                        diferencaPagarReceber: parseSisfoCurrency(rowObj['Acerto']),
                        credito: parseSisfoCurrency(rowObj['Crédito']),
                        debito: parseSisfoCurrency(rowObj['Débito']),
                        pix: parseSisfoCurrency(rowObj['Pix']),
                        cashless: parseSisfoCurrency(rowObj['Cashless']),
                        numeroMaquina: rowObj['Nº Máquina'], operatorName: rowObj['Operador'], timestamp: rowObj['Data'],
                    };
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
                    // Usa parseSisfoCurrency
                    const baseCashierObject = {
                        protocol, eventName, operatorName: rowObj['Operador'], timestamp: rowObj['Data'], cpf: rowObj['CPF'],
                        cashierName: rowObj['Nome do Caixa'], numeroMaquina: rowObj['Nº Máquina'],
                        valorTotalVenda: parseSisfoCurrency(rowObj['Venda Total']),
                        credito: parseSisfoCurrency(rowObj['Crédito']),
                        debito: parseSisfoCurrency(rowObj['Débito']),
                        pix: parseSisfoCurrency(rowObj['Pix']),
                        cashless: parseSisfoCurrency(rowObj['Cashless']),
                        valorTroco: parseSisfoCurrency(rowObj['Troco']),
                        valorEstorno: parseSisfoCurrency(rowObj['Devolução/Estorno']),
                        dinheiroFisico: parseSisfoCurrency(rowObj['Dinheiro Físico']),
                        valorAcerto: parseSisfoCurrency(rowObj['Valor Acerto']),
                        diferenca: parseSisfoCurrency(rowObj['Diferença']),
                    };
                    baseCashierObject.temEstorno = baseCashierObject.valorEstorno > 0;

                    if (type === 'Fixo') {
                        return { ...baseCashierObject, type: 'individual_fixed_cashier', groupProtocol: protocol.substring(0, protocol.lastIndexOf('-')) };
                    } else {
                        return { ...baseCashierObject, type: 'cashier' };
                    }
                }).filter(Boolean);
                allClosings.push(...data);
            }
        }
        // ... (formatação de data) ...
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


// --- ROTA DE EXPORTAÇÃO ONLINE ---
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
          const header = response.data.values[0].map(h => String(h).trim().toUpperCase());
          const idxData = header.indexOf('DATA');
          const idxProtocolo = header.indexOf('PROTOCOLO');
          const idxCpf = header.indexOf('CPF');
          const idxNome = header.indexOf('NOME GARÇOM');
          const idxMaquina = header.indexOf('Nº MÁQUINA');
          const idxVendaTotal = header.indexOf('VENDA TOTAL');
          const idxCredito = header.indexOf('CRÉDITO');
          const idxDebito = header.indexOf('DÉBITO');
          const idxPix = header.indexOf('PIX');
          const idxCashless = header.indexOf('CASHLESS');
          const idxEstorno = header.indexOf('DEVOLUÇÃO/ESTORNO');
          const idxComissao = header.indexOf('COMISSÃO TOTAL');
          const idxAcerto = header.indexOf('ACERTO');
          const idxOperador = header.indexOf('OPERADOR');
          const rows = response.data.values.slice(1);

          consolidatedWaiters = rows.map(row => {
              const rowData = {
                  eventName: eventName,
                  'DATA': idxData !== -1 ? row[idxData] : '',
                  'PROTOCOLO': idxProtocolo !== -1 ? row[idxProtocolo] : '',
                  'CPF': idxCpf !== -1 ? row[idxCpf] : '',
                  'NOME GARÇOM': idxNome !== -1 ? row[idxNome] : '',
                  'Nº MAQUINA': idxMaquina !== -1 ? row[idxMaquina] : '',
                  'VALOR TOTAL VENDA': idxVendaTotal !== -1 ? row[idxVendaTotal] : '',
                  'CRÉDITO': idxCredito !== -1 ? row[idxCredito] : '',
                  'DÉBITO': idxDebito !== -1 ? row[idxDebito] : '',
                  'PIX': idxPix !== -1 ? row[idxPix] : '',
                  'CASHLESS': idxCashless !== -1 ? row[idxCashless] : '',
                  'DEVOLUÇÃO ESTORNO': idxEstorno !== -1 ? row[idxEstorno] : '',
                  'COMISSÃO TOTAL': idxComissao !== -1 ? row[idxComissao] : '',
                  'ACERTO': idxAcerto !== -1 ? row[idxAcerto] : '',
                  'OPERADOR': idxOperador !== -1 ? row[idxOperador] : ''
              };
              Object.keys(rowData).forEach(key => { if (rowData[key] === undefined) { rowData[key] = ''; } });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Garçons para o evento "${eventName}" não encontrada. Continuando...`); }

    // --- SEÇÃO DE CAIXAS (Sem mudanças) ---
    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Caixas - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0].map(h => String(h).trim());
          consolidatedCashiers = response.data.values.slice(1).map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => { rowData[String(key).trim().toUpperCase()] = row[index] || ''; });
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


// --- ROTA DE RECONCILIAÇÃO YUZER (CORREÇÃO FINAL) ---
app.post('/api/reconcile-yuzer', async (req, res) => {
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

    // --- processSheet AGORA USA parseSisfoCurrency (CORRIGIDO) ---
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
        if (cpfIndex === -1 || nameIndex === -1 || machineIndex === -1) {
            console.warn(`[RECONCILE] Cabeçalhos essenciais (CPF, Nome, Máquina) não encontrados na aba ${isWaiterSheet ? 'Garçons' : 'Caixas'}.`);
            return;
        }
        rows.forEach(row => {
            const cpf = row[cpfIndex]?.replace(/\D/g, '');
            if (cpf) {
                if (!sisfoData.has(cpf)) { sisfoData.set(cpf, []); }
                // Aplica parseSisfoCurrency (CORRIGIDO) aos valores lidos da planilha SisFO
                // Estes valores estão em CENTAVOS (ex: 1885.00)
                sisfoData.get(cpf).push({
                    name: row[nameIndex],
                    machine: getLast8Digits(row[machineIndex]),
                    total: totalIndex !== -1 ? parseSisfoCurrency(row[totalIndex]) : 0,
                    credit: creditIndex !== -1 ? parseSisfoCurrency(row[creditIndex]) : 0,
                    debit: debitIndex !== -1 ? parseSisfoCurrency(row[debitIndex]) : 0,
                    pix: pixIndex !== -1 ? parseSisfoCurrency(row[pixIndex]) : 0,
                    cashless: cashlessIndex !== -1 ? parseSisfoCurrency(row[cashlessIndex]) : 0
                });
            }
        });
    };
    // --- FIM DO processSheet ATUALIZADO ---

    try {
        const [waiterRes, cashierRes] = await Promise.allSettled([
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A:Z` }),
            googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:Z` })
        ]);
        if (waiterRes.status === 'fulfilled') processSheet(waiterRes.value, true);
        if (cashierRes.status === 'fulfilled') processSheet(cashierRes.value, false);
    } catch (e) { console.log(`Abas SisFO para o evento "${eventName}" não encontradas ou erro ao ler.`); }
    console.log(`\n--- INICIANDO CONCILIAÇÃO POR 8 DÍGITOS DA MÁQUINA PARA: ${eventName} ---`);
    console.log(`${sisfoData.size} CPFs distintos carregados do SisFO.`);
    let divergences = [], totemsFound = 0, recordsCompared = 0, unmatchedYuzerRecords = 0;

    yuzerData.forEach((yuzerRow) => {
      const operator = yuzerRow['Operador de Caixa'];
      if (operator && String(operator).toLowerCase().includes('pdv')) { totemsFound++; return; }
      const cpf = String(yuzerRow['CPF'] || '').replace(/\D/g, '');
      const serial = yuzerRow['Serial'];
      if (!cpf || !serial) {
          console.log(`[RECONCILE] Linha Yuzer ignorada: CPF ou Serial ausente. Operador: ${operator || 'N/A'}`);
          return;
      }
      const machineKey = getLast8Digits(serial);
      if (!machineKey) {
          console.log(`[RECONCILE] Linha Yuzer ignorada: Não foi possível extrair 8 dígitos da máquina. Serial: ${serial}`);
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
        console.log(`[RECONCILE] CPF ${cpf} encontrado no SisFO, mas NENHUM registro com os 8 dígitos da máquina (${machineKey}). Máquinas SisFO: ${sisfoRecordsForCpf.map(r => r.machine).join(', ')}`);
        return;
      }
      recordsCompared++;
      // sisfoRecord já foi parseado com parseSisfoCurrency (CORRIGIDO)
      // sisfoRecord.credit é CENTAVOS (ex: 1885.00)
      const sisfoRecord = sisfoRecordsForCpf[recordIndex];

      // --- CORREÇÃO: CRIAÇÃO DO yuzerRecord ---
      // 1. Aplica o parseSisfoCurrency (CORRIGIDO) para ler o valor em REAIS (ex: "18.85")
      // 2. Multiplica por 100 para converter para CENTAVOS, para bater com o SisFO (ex: 18.85 -> 1885.00)
      const yuzerRecord = {
        total: parseSisfoCurrency(yuzerRow['Total']) * 100,
        credit: parseSisfoCurrency(yuzerRow['Crédito']) * 100,
        debit: parseSisfoCurrency(yuzerRow['Débito']) * 100,
        pix: parseSisfoCurrency(yuzerRow['PIX']) * 100, // Multiplica PIX também (0.00 * 100 = 0)
        cashless: parseSisfoCurrency(yuzerRow['Cashless']) * 100
      };
      // --- FIM DA CORREÇÃO ---

      console.log(`--> COMPARANDO CPF: ${cpf}, CHAVE MÁQUINA: ${machineKey}`);
      console.log("    DADOS YUZER (em centavos) ->", JSON.stringify(yuzerRecord)); // Valores Yuzer CORRIGIDOS
      console.log("    DADOS SISFO (em centavos) ->", JSON.stringify(sisfoRecord)); // Valores SisFO CORRIGIDOS

      const checkDiff = (field, yuzerVal, sisfoVal) => {
        // A comparação agora é entre CENTAVOS (yuzerVal) e CENTAVOS (sisfoVal)
        if (Math.abs(yuzerVal - sisfoVal) > 0.01) {
          console.log(`    !!! DIVERGÊNCIA [${field}]: Yuzer=${yuzerVal.toFixed(2)}, SisFO=${sisfoVal.toFixed(2)}`);
          // Reporta os valores em REAIS (dividindo por 100) para o usuário final, que é mais legível
          divergences.push({ 
              name: sisfoRecord.name, 
              cpf, 
              machine: machineKey, 
              field, 
              yuzerValue: (yuzerVal / 100).toFixed(2), // Converte de volta para Reais para o Log
              sisfoValue: (sisfoVal / 100).toFixed(2)  // Converte de volta para Reais para o Log
            });
        }
      };
      
      // *** MODIFICAÇÃO BÔNUS: Reportar valores em REAIS ***
      // Eu modifiquei o `checkDiff` acima para que, ao encontrar uma divergência,
      // ele salve os valores divididos por 100.
      // A COMPARAÇÃO é feita em centavos (correto), mas o RELATÓRIO é em Reais (legível).
      // Se você preferir o relatório em centavos, reverta a alteração no `divergences.push`
      // para:
      // yuzerValue: yuzerVal.toFixed(2),
      // sisfoValue: sisfoVal.toFixed(2)
      // ****************************************************

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