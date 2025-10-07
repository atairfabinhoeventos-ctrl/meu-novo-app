// backend/server.js (VERSÃO FINAL COM ATUALIZAÇÃO DE DADOS NA NUVEM)
console.log("--- EXECUTANDO A VERSÃO MAIS RECENTE DO CÓDIGO (revisão com sync e update) ---");

require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors({ origin: '*' }));

// --- FUNÇÃO DE AUTENTICAÇÃO ATUALIZADA ---
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
      const response = await googleSheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId_sync,
        range: 'Garcons!A2:A',
      });
      const existingCpfs = new Set((response.data.values || []).map(row => row[0].trim()));
      const newWaiters = waiters.filter(waiter => waiter.cpf && !existingCpfs.has(waiter.cpf.trim()));
      
      if (newWaiters.length > 0) {
        const values = newWaiters.map(w => [w.cpf, w.name]);
        await googleSheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId_sync,
          range: 'Garcons!A:B',
          valueInputOption: 'USER_ENTERED',
          resource: { values },
        });
        addedWaitersCount = newWaiters.length;
      }
    }

    if (events && events.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId_sync,
        range: 'Eventos!A2:A',
      });
      const existingEventNames = new Set((response.data.values || []).map(row => row[0].trim()));
      const newEvents = events.filter(event => event.name && !existingEventNames.has(event.name.trim()));

      if (newEvents.length > 0) {
        const values = newEvents.map(e => [e.name, '', e.active ? 'ATIVO' : 'INATIVO']);
        await googleSheets.spreadsheets.values.append({
          spreadsheetId: spreadsheetId_sync,
          range: 'Eventos!A:C',
          valueInputOption: 'USER_ENTERED',
          resource: { values },
        });
        addedEventsCount = newEvents.length;
      }
    }
    
    res.status(200).json({ 
      message: `Base de cadastro online atualizada com sucesso!\n- ${addedWaitersCount} novo(s) garçom(ns) adicionado(s).\n- ${addedEventsCount} novo(s) evento(s) adicionado(s).`
    });

  } catch (error) {
    console.error('Erro ao atualizar base de cadastro online:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao atualizar a base de cadastro.' });
  }
});


// --- ROTA ATUALIZADA: ENVIAR DADOS PARA A NUVEM (COM LÓGICA DE UPDATE) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  
  if (!eventName) {
    return res.status(400).json({ message: 'Nome do evento é obrigatório.' });
  }

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;

    let newWaitersCount = 0;
    let updatedWaitersCount = 0;
    let newCashiersCount = 0;
    let updatedCashiersCount = 0;

    // --- LÓGICA PARA GARÇONS ---
    if (waiterData && waiterData.data && waiterData.data.length > 0) {
      const waiterSheetName = `Garçons - ${eventName}`;
      const sheet = sheets.find(s => s.properties.title === waiterSheetName);
      
      if (!sheet) {
        // Se a aba não existe, cria e adiciona todos como novos
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: waiterSheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [waiterData.header] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName, valueInputOption: 'USER_ENTERED', resource: { values: waiterData.data } });
        newWaitersCount = waiterData.data.length;
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${waiterSheetName}!B:B` });
        const existingProtocols = response.data.values || [];
        
        const protocolMap = new Map();
        existingProtocols.forEach((row, index) => {
            if (row[0]) protocolMap.set(row[0], index + 2); // +2 porque o range começa em A2
        });

        const rowsToAppend = [];
        const updatesToPerform = [];
        waiterData.data.forEach(row => {
            const protocol = row[1]; // Protocolo do garçom está na coluna B (índice 1)
            if (protocolMap.has(protocol)) {
                updatesToPerform.push({
                    range: `${waiterSheetName}!A${protocolMap.get(protocol)}`,
                    values: [row]
                });
            } else {
                rowsToAppend.push(row);
            }
        });

        if (rowsToAppend.length > 0) {
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName, valueInputOption: 'USER_ENTERED', resource: { values: rowsToAppend } });
        }
        
        if (updatesToPerform.length > 0) {
            await googleSheets.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId_cloud_sync,
                resource: { valueInputOption: 'USER_ENTERED', data: updatesToPerform }
            });
        }

        newWaitersCount = rowsToAppend.length;
        updatedWaitersCount = updatesToPerform.length;
      }
    }

    // --- LÓGICA PARA CAIXAS (MESMO PADRÃO) ---
    if (cashierData && cashierData.data && cashierData.data.length > 0) {
      const cashierSheetName = `Caixas - ${eventName}`;
      const sheet = sheets.find(s => s.properties.title === cashierSheetName);

      if (!sheet) {
        await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: cashierSheetName } } }] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [cashierData.header] } });
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName, valueInputOption: 'USER_ENTERED', resource: { values: cashierData.data } });
        newCashiersCount = cashierData.data.length;
      } else {
        const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${cashierSheetName}!A:A` });
        const existingProtocols = response.data.values || [];
        const protocolMap = new Map();
        existingProtocols.forEach((row, index) => {
            if (row[0]) protocolMap.set(row[0], index + 2);
        });

        const rowsToAppend = [];
        const updatesToPerform = [];
        cashierData.data.forEach(row => {
            const protocol = row[0]; // Protocolo do caixa está na coluna A (índice 0)
            if (protocolMap.has(protocol)) {
                updatesToPerform.push({ range: `${cashierSheetName}!A${protocolMap.get(protocol)}`, values: [row] });
            } else {
                rowsToAppend.push(row);
            }
        });

        if (rowsToAppend.length > 0) {
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName, valueInputOption: 'USER_ENTERED', resource: { values: rowsToAppend } });
        }
        if (updatesToPerform.length > 0) {
            await googleSheets.spreadsheets.values.batchUpdate({
                spreadsheetId: spreadsheetId_cloud_sync,
                resource: { valueInputOption: 'USER_ENTERED', data: updatesToPerform }
            });
        }
        newCashiersCount = rowsToAppend.length;
        updatedCashiersCount = updatesToPerform.length;
      }
    }

    res.status(200).json({
      newWaiters: newWaitersCount,
      updatedWaiters: updatedWaitersCount,
      newCashiers: newCashiersCount,
      updatedCashiers: updatedCashiersCount
    });

  } catch (error) {
    console.error('Erro ao salvar dados na nuvem:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao salvar na nuvem.' });
  }
});


// --- ROTA PARA CONSULTAR HISTÓRICO ONLINE ---
app.post('/api/online-history', async (req, res) => {
  // ... (Esta rota permanece a mesma da versão anterior, já estava correta)
  const { eventName, password } = req.body;

  if (!eventName || !password) {
    return res.status(400).json({ message: 'Nome do evento e senha são obrigatórios.' });
  }
  if (password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Senha incorreta.' });
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
            const data = rows.slice(1).map(row => {
                const closingObject = { type: 'cashier' };
                header.forEach((key, index) => {
                    const value = row[index];
                    switch(key) {
                        case 'NOME DO CAIXA': closingObject.cashierName = value; break;
                        case 'PROTOCOLO': closingObject.protocol = value; break;
                        case 'VALOR VENDA TOTAL': closingObject.valorTotalVenda = parseFloat(value || 0); break;
                        case 'CRÉDITO': closingObject.credito = parseFloat(value || 0); break;
                        case 'DÉBITO': closingObject.debito = parseFloat(value || 0); break;
                        case 'PIX': closingObject.pix = parseFloat(value || 0); break;
                        case 'CASHLESS': closingObject.cashless = parseFloat(value || 0); break;
                        case 'DEVOLUÇÃO ESTORNO': closingObject.valorEstorno = parseFloat(value || 0); closingObject.temEstorno = !!(parseFloat(value || 0) > 0); break;
                        case 'DIFERENÇA': closingObject.diferenca = parseFloat(value || 0); break;
                        case 'OPERADOR': closingObject.operatorName = value; break;
                        case 'Nº MÁQUINA': closingObject.numeroMaquina = value; break;
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
                return closingObject;
            });
            allClosings.push(...data);
        }
    }

    if (allClosings.length === 0) {
      return res.status(404).json({ message: `Nenhum fechamento (garçom ou caixa) foi encontrado para o evento "${eventName}" na nuvem.` });
    }

    res.status(200).json(allClosings);

  } catch (error) {
    console.error('Erro ao buscar histórico online (versão unificada):', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
  }
});

// --- ROTA PARA EXPORTAR DADOS DA NUVEM POR EVENTO ---
app.post('/api/export-online-data', async (req, res) => {
  // ... (Esta rota permanece a mesma da versão anterior, já estava correta)
  const { password, eventName } = req.body;

  if (!eventName) {
    return res.status(400).json({ message: 'O nome do evento é obrigatório.' });
  }
  if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Senha incorreta.' });
  }

  try {
    const googleSheets = await getGoogleSheetsClient();
    
    const waiterSheetName = `Garçons - ${eventName}`;
    const cashierSheetName = `Caixas - ${eventName}`;
    
    const [waiterResult, cashierResult] = await Promise.allSettled([
      googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: waiterSheetName }),
      googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: cashierSheetName })
    ]);

    let consolidatedWaiters = [];
    let consolidatedCashiers = [];

    if (waiterResult.status === 'fulfilled' && waiterResult.value.data.values) {
        const rows = waiterResult.value.data.values;
        if (rows.length > 1) {
            const header = rows[0].map(h => String(h).trim());
            const data = rows.slice(1);
            data.forEach(row => {
                const rowData = { eventName };
                header.forEach((key, index) => rowData[key] = row[index]);
                consolidatedWaiters.push(rowData);
            });
        }
    }

    if (cashierResult.status === 'fulfilled' && cashierResult.value.data.values) {
        const rows = cashierResult.value.data.values;
        if (rows.length > 1) {
            const header = rows[0].map(h => String(h).trim());
            const data = rows.slice(1);
            data.forEach(row => {
                const rowData = { eventName };
                header.forEach((key, index) => rowData[key] = row[index]);
                consolidatedCashiers.push(rowData);
            });
        }
    }

    if (consolidatedWaiters.length === 0 && consolidatedCashiers.length === 0) {
        return res.status(404).json({ message: 'Nenhum dado de garçom ou caixa foi encontrado para este evento na nuvem.' });
    }

    res.status(200).json({ waiters: consolidatedWaiters, cashiers: consolidatedCashiers });

  } catch (error) {
    console.error('Erro ao exportar dados da nuvem por evento:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao processar os dados da planilha.' });
  }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend rodando na porta ${PORT}`);
});