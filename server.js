// backend/server.js (VERSÃO FINAL COMPLETA E CORRIGIDA)
console.log("--- EXECUTANDO A VERSÃO MAIS RECENTE DO CÓDIGO (revisão com todas as rotas completas) ---");

require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors()); // Permite acesso de qualquer origem

// --- FUNÇÃO DE AUTENTICAÇÃO ---
async function getGoogleSheetsClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : undefined,
      keyFilename: process.env.GOOGLE_CREDENTIALS ? undefined : path.join(__dirname, 'credentials.json'),
      scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  } catch (error) {
    console.error('Erro na autenticação com a Google Sheets API:', error);
    throw new Error('Falha na autenticação da API do Google Sheets.');
  }
}

// --- IDs DAS PLANILHAS ---
const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE';
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ';

// --- ROTAS DE SINCRONIZAÇÃO DE CADASTROS ---
app.get('/api/sync/waiters', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId_sync,
            range: 'Garcons!A2:B'
        });
        const rows = response.data.values || [];
        const waiters = rows.map(row => ({ cpf: row[0], name: row[1] }));
        res.status(200).json(waiters);
    } catch (error) {
        console.error('Erro ao buscar dados de garçons para sincronia:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/sync/events', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId_sync,
            range: 'Eventos!A2:C'
        });
        const rows = response.data.values || [];
        const events = rows.map(row => ({
          name: row[0],
          active: row[2] ? row[2].toUpperCase() === 'ATIVO' : true,
        })).filter(e => e.name);
        res.status(200).json(events);
    } catch (error) {
        console.error('Erro ao buscar dados de eventos para sincronia:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
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
        // LÓGICA CORRETA: Prepara os dados para serem inseridos nas colunas A, B (vazio) e C.
        const values = newEvents.map(e => [e.name, '', e.active ? 'ATIVO' : 'INATIVO']);
        await googleSheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId_sync,
            range: 'Eventos_Final!A:C', // O intervalo define que a escrita começa na coluna A.
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        addedEventsCount = newEvents.length;
      }
    }
    res.status(200).json({ message: `Base de cadastro online atualizada com sucesso!\n- ${addedWaitersCount} novo(s) garçom(ns) adicionado(s).\n- ${addedEventsCount} novo(s) evento(s) adicionado(s).` });
  } catch (error) {
    console.error('Erro ao atualizar base de cadastro online:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar a base de cadastro.' });
  }
});

// --- ROTA DE SYNC PARA A NUVEM (ROBUSTA E COMPLETA) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let newW = 0, updatedW = 0, newC = 0, updatedC = 0;

    // Lógica para Garçons
    if (waiterData && waiterData.length > 0) {
      const sheetName = `Garçons - ${eventName}`;
      const header = [ "Data", "Protocolo", "Nome Garçom", "Nº Maquina", "Valor Total Venda", "Crédito", "Débito", "Pix", "Cashless", "Devolução/Estorno", "Comissão Total", "Acerto", "Operador"];
      const rows = waiterData.map(c => [ c.timestamp, c.protocol, c.waiterName, c.numeroMaquina, c.valorTotal, c.credito, c.debito, c.pix, c.cashless, c.valorEstorno, c.comissaoTotal, c.acerto, c.operatorName ]);
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
            if (protocol) protocolMap.set(protocol.trim(), { row: row.map(String), index: index + 2 });
        });

        const toAdd = [], toUpdate = [];
        rows.forEach(row => {
            const p = row[protocolColumnIndex] ? String(row[protocolColumnIndex]).trim() : null;
            if (p && protocolMap.has(p)) {
                const existing = protocolMap.get(p);
                if (JSON.stringify(existing.row) !== JSON.stringify(row.map(String))) {
                    toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [row] });
                }
            } else {
                toAdd.push(row);
            }
        });

        if (toAdd.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: toAdd } });
        if (toUpdate.length > 0) await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: toUpdate } });
        newW = toAdd.length; updatedW = toUpdate.length;
      }
    }

    // Lógica para Caixas
    if (cashierData && cashierData.length > 0) {
        const sheetName = `Caixas - ${eventName}`;
        const header = [ "Protocolo", "Data", "Tipo", "CPF", "Nome do Caixa", "Nº Máquina", "Venda Total", "Crédito", "Débito", "Pix", "Cashless", "Troco", "Devolução/Estorno", "Dinheiro Físico", "Valor Acerto", "Diferença", "Operador" ];
        const rows = cashierData.map(c => [ c.protocol, c.timestamp, c.type, c.cpf, c.cashierName, c.numeroMaquina, c.valorTotalVenda, c.credito, c.debito, c.pix, c.cashless, c.valorTroco, c.valorEstorno, c.dinheiroFisico, c.valorAcerto, c.diferenca, c.operatorName ]);
        const sheet = sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [header] } });
            if (rows.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rows } });
            newC = rows.length;
        } else {
            const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName });
            const existingRows = response.data.values || [];
            const protocolColumnIndex = 0;

            const protocolMap = new Map();
            existingRows.slice(1).forEach((row, index) => {
                const protocol = row[protocolColumnIndex];
                if (protocol) protocolMap.set(protocol.trim(), { row: row.map(String), index: index + 2 });
            });

            const toAdd = [], toUpdate = [];
            rows.forEach(row => {
                const p = row[protocolColumnIndex] ? String(row[protocolColumnIndex]).trim() : null;
                if (p && protocolMap.has(p)) {
                    const existing = protocolMap.get(p);
                    if (JSON.stringify(existing.row) !== JSON.stringify(row.map(String))) {
                        toUpdate.push({ range: `${sheetName}!A${existing.index}`, values: [row] });
                    }
                } else {
                    toAdd.push(row);
                }
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

// --- ROTA DE HISTÓRICO ONLINE (CONTEÚDO COMPLETO E CORRIGIDO) ---
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
        const parseCurrency = (val) => parseFloat(String(val || '0').replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;

        if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
            const [header, ...rows] = waiterResult.value.data.values;
            if (header && rows.length > 0) {
                const data = rows.map(row => {
                    const rowObj = Object.fromEntries(header.map((key, i) => [key.trim(), row[i]]));
                    const closingObject = {
                        type: 'waiter',
                        waiterName: rowObj['Nome Garçom'],
                        protocol: rowObj['Protocolo'],
                        valorTotal: parseCurrency(rowObj['Valor Total Venda']),
                        valorEstorno: parseCurrency(rowObj['Devolução/Estorno']),
                        comissaoTotal: parseCurrency(rowObj['Comissão Total']),
                        diferencaPagarReceber: parseCurrency(rowObj['Acerto']),
                        credito: parseCurrency(rowObj['Crédito']),
                        debito: parseCurrency(rowObj['Débito']),
                        pix: parseCurrency(rowObj['Pix']),
                        cashless: parseCurrency(rowObj['Cashless']),
                        numeroMaquina: rowObj['Nº Maquina'],
                        operatorName: rowObj['Operador'],
                        timestamp: rowObj['Data'],
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

                    const baseCashierObject = {
                        protocol, eventName,
                        operatorName: rowObj['Operador'], timestamp: rowObj['Data'], cpf: rowObj['CPF'],
                        cashierName: rowObj['Nome do Caixa'], numeroMaquina: rowObj['Nº Máquina'],
                        valorTotalVenda: parseCurrency(rowObj['Venda Total']),
                        credito: parseCurrency(rowObj['Crédito']),
                        debito: parseCurrency(rowObj['Débito']),
                        pix: parseCurrency(rowObj['Pix']),
                        cashless: parseCurrency(rowObj['Cashless']),
                        valorTroco: parseCurrency(rowObj['Troco']),
                        temEstorno: parseCurrency(rowObj['Devolução/Estorno']) > 0,
                        valorEstorno: parseCurrency(rowObj['Devolução/Estorno']),
                        dinheiroFisico: parseCurrency(rowObj['Dinheiro Físico']),
                        valorAcerto: parseCurrency(rowObj['Valor Acerto']),
                        diferenca: parseCurrency(rowObj['Diferença']),
                    };

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


// --- ROTA DE EXPORTAÇÃO ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;

  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }

  try {
    const googleSheets = await getGoogleSheetsClient();
    let consolidatedWaiters = [], consolidatedCashiers = [];

    try {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `Garçons - ${eventName}` });
      if (response.data.values && response.data.values.length > 1) {
          const header = response.data.values[0].map(h => String(h).trim());
          consolidatedWaiters = response.data.values.slice(1).map(row => {
              const rowData = { eventName };
              header.forEach((key, index) => {
                  rowData[String(key).trim().toUpperCase()] = row[index] || '';
              });
              return rowData;
          });
      }
    } catch (e) { console.log(`Aba de Garçons para o evento "${eventName}" não encontrada. Continuando...`); }

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

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend rodando na porta ${PORT}`);
});