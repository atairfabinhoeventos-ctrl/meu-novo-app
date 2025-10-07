// backend/server.js (VERSÃO FINAL E COMPLETA)
console.log("--- EXECUTANDO A VERSÃO MAIS RECENTE DO CÓDIGO (revisão com export e sync) ---");

require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));

// --- CONFIGURAÇÃO DE CORS MAIS ROBUSTA ---
const allowedOrigins = [
  'http://localhost:5173',
  'https://seu-frontend.onrender.com' // SUBSTITUA PELO SEU ENDEREÇO QUANDO TIVER
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

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
        const values = newEvents.map(e => [e.name, '', e.active ? 'ATIVO' : 'INATIVO']);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Eventos!A:C', valueInputOption: 'USER_ENTERED', resource: { values } });
        addedEventsCount = newEvents.length;
      }
    }
    res.status(200).json({ message: `Base de cadastro online atualizada com sucesso!\n- ${addedWaitersCount} novo(s) garçom(ns) adicionado(s).\n- ${addedEventsCount} novo(s) evento(s) adicionado(s).` });
  } catch (error) {
    console.error('Erro ao atualizar base de cadastro online:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar a base de cadastro.' });
  }
});

// --- ROTA DE SYNC PARA A NUVEM (CORRIGIDA) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  
  if (!eventName) {
    return res.status(400).json({ message: 'Nome do evento é obrigatório.' });
  }

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;

    let newWaitersCount = 0, updatedWaitersCount = 0, newCashiersCount = 0, updatedCashiersCount = 0;

    if (waiterData?.data?.length > 0) {
      const sheetName = `Garçons - ${eventName}`;
      const sheet = sheets.find(s => s.properties.title === sheetName);
      
      if (!sheet) {
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [waiterData.header] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: waiterData.data } });
        newWaitersCount = waiterData.data.length;
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!B:B` });
        const protocolMap = new Map((response.data.values || []).map((row, index) => row[0] ? [row[0].trim(), index + 2] : null).filter(Boolean));
        
        const rowsToAppend = [], updatesToPerform = [];
        waiterData.data.forEach(row => {
            const protocol = row[1] ? row[1].trim() : null;
            if (protocol && protocolMap.has(protocol)) {
                updatesToPerform.push({ range: `${sheetName}!A${protocolMap.get(protocol)}`, values: [row] });
            } else {
                rowsToAppend.push(row);
            }
        });

        if (rowsToAppend.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rowsToAppend } });
        if (updatesToPerform.length > 0) await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: updatesToPerform } });
        
        newWaitersCount = rowsToAppend.length;
        updatedWaitersCount = updatesToPerform.length;
      }
    }

    if (cashierData?.data?.length > 0) {
      const sheetName = `Caixas - ${eventName}`;
      const sheet = sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [cashierData.header] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: cashierData.data } });
        newCashiersCount = cashierData.data.length;
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A:A` });
        const protocolMap = new Map((response.data.values || []).map((row, index) => row[0] ? [row[0].trim(), index + 2] : null).filter(Boolean));
        
        const rowsToAppend = [], updatesToPerform = [];
        cashierData.data.forEach(row => {
            const protocol = row[0] ? row[0].trim() : null;
            if (protocol && protocolMap.has(protocol)) {
                updatesToPerform.push({ range: `${sheetName}!A${protocolMap.get(protocol)}`, values: [row] });
            } else {
                rowsToAppend.push(row);
            }
        });

        if (rowsToAppend.length > 0) await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: sheetName, valueInputOption: 'USER_ENTERED', resource: { values: rowsToAppend } });
        if (updatesToPerform.length > 0) await googleSheets.spreadsheets.values.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { valueInputOption: 'USER_ENTERED', data: updatesToPerform } });
        
        newCashiersCount = rowsToAppend.length;
        updatedCashiersCount = updatesToPerform.length;
      }
    }

    res.status(200).json({ newWaiters: newWaitersCount, updatedWaiters: updatedWaitersCount, newCashiers: newCashiersCount, updatedCashiers: updatedCashiersCount });
  } catch (error) {
    console.error('Erro ao salvar dados na nuvem:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao salvar na nuvem.' });
  }
});

// --- ROTA DE HISTÓRICO ONLINE (CONTEÚDO RESTAURADO E CORRETO) ---
app.post('/api/online-history', async (req, res) => {
  const { eventName, password } = req.body;

  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }

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
      const rows = waiterResult.value.data.values;
      if (rows.length > 1) {
        const header = rows[0].map(h => String(h).trim());
        const data = rows.slice(1).map(row => {
          const closingObject = { type: 'waiter' };
          header.forEach((key, index) => {
            const value = row[index];
            switch (key) {
              case 'NOME GARÇOM': closingObject.waiterName = value; break;
              case 'PROTOCOLO': closingObject.protocol = value; break;
              case 'VALOR VENDA TOTAL': closingObject.valorTotal = parseFloat(value || 0); break;
              case 'DEVOLUÇÃO ESTORNO': closingObject.valorEstorno = parseFloat(value || 0); break;
              case 'COMISSÃO TOTAL': closingObject.comissaoTotal = parseFloat(value || 0); break;
              case 'ACERTO': closingObject.diferencaPagarReceber = parseFloat(value || 0); break;
              case 'CRÉDITO': closingObject.credito = parseFloat(value || 0); break;
              case 'DÉBITO': closingObject.debito = parseFloat(value || 0); break;
              case 'PIX': closingObject.pix = parseFloat(value || 0); break;
              case 'CASHLESS': closingObject.cashless = parseFloat(value || 0); break;
              case 'Nº MÁQUINA': closingObject.numeroMaquina = value; break;
              case 'OPERADOR': closingObject.operatorName = value; break;
              case 'DATA':
                  let finalDate = new Date(0);
                  if (value && typeof value === 'string') {
                      const [datePart, timePart] = value.split(' ');
                      if (datePart && timePart) {
                          const [day, month, year] = datePart.split('/');
                          if (day && month && year) {
                            const isoDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
                            const parsedDate = new Date(isoDateString);
                            if (!isNaN(parsedDate)) finalDate = parsedDate;
                          }
                      }
                  }
                  closingObject.timestamp = finalDate.toISOString();
                  break;
            }
          });
          closingObject.diferencaLabel = closingObject.diferencaPagarReceber >= 0 ? 'Receber do Garçom' : 'Pagar ao Garçom';
          closingObject.diferencaPagarReceber = Math.abs(closingObject.diferencaPagarReceber);
          return closingObject;
        });
        allClosings.push(...data);
      }
    }

    if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) {
        const rows = cashierResult.value.data.values;
        if (rows.length > 1) {
            const header = rows[0].map(h => String(h).trim());
            const groupMap = new Map();

            rows.slice(1).forEach(row => {
                const closingObject = {};
                header.forEach((key, index) => {
                    closingObject[key] = row[index];
                });

                const protocol = closingObject['PROTOCOLO'] || '';
                const type = closingObject['TIPO'] || '';

                if (type === 'Fixo') {
                    const groupProtocol = protocol.substring(0, protocol.lastIndexOf('-'));
                    if (!groupMap.has(groupProtocol)) {
                        groupMap.set(groupProtocol, {
                            protocol: groupProtocol,
                            type: 'fixed_cashier',
                            eventName: eventName,
                            operatorName: closingObject['OPERADOR'],
                            timestamp: closingObject['DATA'],
                            valorTroco: parseFloat(closingObject['TROCO'] || 0),
                            caixas: []
                        });
                    }
                    
                    const group = groupMap.get(groupProtocol);
                    const acerto = parseFloat(closingObject['VALOR ACERTO'] || 0);
                    const diferenca = parseFloat(closingObject['DIFERENÇA'] || 0);

                    group.caixas.push({
                        cpf: closingObject['CPF'],
                        cashierName: closingObject['NOME DO CAIXA'],
                        numeroMaquina: closingObject['Nº MÁQUINA'],
                        valorTotalVenda: parseFloat(closingObject['VENDA TOTAL'] || 0),
                        credito: parseFloat(closingObject['CRÉDITO'] || 0),
                        debito: parseFloat(closingObject['DÉBITO'] || 0),
                        pix: parseFloat(closingObject['PIX'] || 0),
                        cashless: parseFloat(closingObject['CASHLESS'] || 0),
                        temEstorno: parseFloat(closingObject['DEVOLUÇÃO ESTORNO'] || 0) > 0,
                        valorEstorno: parseFloat(closingObject['DEVOLUÇÃO ESTORNO'] || 0),
                        dinheiroFisico: parseFloat(closingObject['DINHEIRO FÍSICO'] || 0),
                        valorAcerto: acerto,
                        diferenca: diferenca
                    });
                } else {
                    allClosings.push({
                        type: 'cashier',
                        protocol: protocol,
                        eventName: eventName,
                        operatorName: closingObject['OPERADOR'],
                        timestamp: closingObject['DATA'],
                        cpf: closingObject['CPF'],
                        cashierName: closingObject['NOME DO CAIXA'],
                        numeroMaquina: closingObject['Nº MÁQUINA'],
                        valorTotalVenda: parseFloat(closingObject['VENDA TOTAL'] || 0),
                        credito: parseFloat(closingObject['CRÉDITO'] || 0),
                        debito: parseFloat(closingObject['DÉBITO'] || 0),
                        pix: parseFloat(closingObject['PIX'] || 0),
                        cashless: parseFloat(closingObject['CASHLESS'] || 0),
                        temEstorno: parseFloat(closingObject['DEVOLUÇÃO ESTORNO'] || 0) > 0,
                        valorEstorno: parseFloat(closingObject['DEVOLUÇÃO ESTORNO'] || 0),
                        valorTroco: parseFloat(closingObject['TROCO'] || 0),
                        dinheiroFisico: parseFloat(closingObject['DINHEIRO FÍSICO'] || 0),
                        valorAcerto: parseFloat(closingObject['VALOR ACERTO'] || 0),
                        diferenca: parseFloat(closingObject['DIFERENÇA'] || 0),
                    });
                }
            });

            groupMap.forEach(group => {
                const totalDiferencaGrupo = group.caixas.reduce((sum, c) => sum + (c.diferenca || 0), 0);
                group.diferencaCaixa = totalDiferencaGrupo;
                allClosings.push(group);
            });
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


// --- ROTA DE EXPORTAÇÃO (CORRIGIDA) ---
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
              header.forEach((key, index) => rowData[key] = row[index] || '');
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
              header.forEach((key, index) => rowData[key] = row[index] || '');
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