// server.js (VERSÃO COMPLETA E ROBUSTA: MAPEAMENTO DINÂMICO DE COLUNAS)
console.log("--- EXECUTANDO VERSÃO: FULL ROBUST + DYNAMIC MAPPING ---"); 

const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const app = express();
const syncingEvents = new Set();

// --- AMBIENTE E CONFIGURAÇÃO ---
const isRunningInElectron = !!process.versions['electron'];
const isProduction = process.env.NODE_ENV === 'production';
const isProdElectron = isRunningInElectron && isProduction;
const resourcesPath = isProdElectron ? path.join(__dirname, '..') : __dirname;
require('dotenv').config({ path: path.join(resourcesPath, '.env') });

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ==========================================
// FUNÇÕES AUXILIARES E PARSERS (CORRIGIDOS)
// ==========================================

// 1. Parser de Moeda Blindado (Lê números e textos com sinal negativo)
const parseSisfoCurrency = (val) => {
    // Se já vier como número (graças ao UNFORMATTED_VALUE), retorna direto
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    
    let originalString = String(val).trim();
    if (originalString === '') return 0;

    // Limpeza prévia para detecção de sinal
    let cleanCheck = originalString.replace(/R\$|\s/gi, '');
    
    // Detecção de negativo (Traço no início, meio, fim ou Parênteses)
    const isNegative = cleanCheck.includes('-') || (cleanCheck.startsWith('(') && cleanCheck.endsWith(')'));

    let cleanString = originalString;
    // Remove parênteses contábeis
    if (cleanCheck.startsWith('(') && cleanCheck.endsWith(')')) {
        cleanString = cleanString.replace(/[()]/g, '');
    }
    
    // Remove tudo que não é dígito, ponto ou vírgula
    cleanString = cleanString.replace(/[^0-9.,]/g, '');

    // Resolve confusão Ponto vs Vírgula (BR vs US)
    const lastPoint = cleanString.lastIndexOf('.');
    const lastComma = cleanString.lastIndexOf(',');

    if (lastComma > lastPoint) {
        // Formato BR: 1.000,00 -> 1000.00
        cleanString = cleanString.replace(/\./g, '').replace(/,/g, '.');
    } else if (lastPoint > lastComma) {
         // Formato US: 1,000.00 -> 1000.00
         cleanString = cleanString.replace(/,/g, '');
    }

    let numberValue = parseFloat(cleanString);
    if (isNaN(numberValue)) return 0;

    return isNegative ? -Math.abs(numberValue) : Math.abs(numberValue);
};

// 2. Parser de Data do Excel (Serial Number)
const excelDateToJSDate = (serial) => {
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;
   return new Date(utc_value * 1000);
};

const normalizeToCentavos = (val) => {
    const numberValue = parseSisfoCurrency(val);
    return Math.round(numberValue * 100);
};

// 3. HELPER: BUSCA VALOR NUMÉRICO PELA COLUNA (MAPEAMENTO DINÂMICO)
// Procura o nome da coluna no mapa e retorna o valor tratado
const getValFromRow = (row, headerMap, possibleKeys) => {
    for (const key of possibleKeys) {
        const normalizedKey = key.toUpperCase().trim();
        const index = headerMap[normalizedKey];
        if (index !== undefined && row[index] !== undefined && row[index] !== '') {
            return parseSisfoCurrency(row[index]);
        }
    }
    return 0; // Padrão se não encontrar
};

// 4. HELPER: BUSCA TEXTO PELA COLUNA (MAPEAMENTO DINÂMICO)
const getTextFromRow = (row, headerMap, possibleKeys) => {
    for (const key of possibleKeys) {
        const normalizedKey = key.toUpperCase().trim();
        const index = headerMap[normalizedKey];
        if (index !== undefined && row[index] !== undefined) {
            return String(row[index]).trim();
        }
    }
    return ''; // Padrão se não encontrar
};

// ==========================================
// CLIENTE GOOGLE SHEETS
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

const spreadsheetId_sync = '1JL5lGqD1ryaIVwtXxY7BiUpOqrufSL_cQKuOQag6AuE';
const spreadsheetId_cloud_sync = '1tP4zTpGf3haa5pkV0612Y7Ifs6_f2EgKJ9MrURuIUnQ';

// ==========================================
// ROTAS DA APLICAÇÃO
// ==========================================

// --- ROTA 1: BUSCAR DADOS MESTRE (GARÇONS E EVENTOS) ---
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

// --- ROTA 2: ATUALIZAR BASE (UPLOAD DE PLANILHA) ---
app.post('/api/update-base', async (req, res) => {
  const { waiters, events } = req.body;
  try {
    const googleSheets = await getGoogleSheetsClient();
    
    // Atualiza Garçons
    if (waiters && waiters.length > 0) {
      const response = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A2:A' });
      const existingCpfs = new Set((response.data.values || []).map(row => row[0].trim()));
      const newWaiters = waiters.filter(waiter => waiter.cpf && !existingCpfs.has(waiter.cpf.trim()));
      
      if (newWaiters.length > 0) {
        const values = newWaiters.map(w => [w.cpf, w.name]);
        await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_sync, range: 'Garcons!A:B', valueInputOption: 'USER_ENTERED', resource: { values } });
      }
    }
    
    // Atualiza Eventos
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

// --- ROTA 3: ATUALIZAR STATUS DO EVENTO (ATIVO/INATIVO) ---
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
    res.status(200).json({ message: 'Status do evento atualizado.' });
  } catch (error) {
    console.error('Erro update-event-status:', error);
    res.status(500).json({ message: 'Erro ao atualizar status do evento.' });
  }
});

// --- ROTA 4: SYNC PARA A NUVEM (ENVIO DE DADOS LOCAIS) ---
app.post('/api/cloud-sync', async (req, res) => {
  const { eventName, waiterData, cashierData } = req.body;
  if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

  if (syncingEvents.has(eventName)) {
    return res.status(429).json({ message: `Sincronização já em andamento para ${eventName}.` });
  }
  syncingEvents.add(eventName);
  console.log(`[BACKEND][cloud-sync][${eventName}] Iniciando sincronização...`);

  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetInfo = await googleSheets.spreadsheets.get({ spreadsheetId: spreadsheetId_cloud_sync });
    const sheets = sheetInfo.data.sheets;
    let counts = { newW: 0, updW: 0, newZ: 0, updZ: 0, newC: 0, updC: 0 };

    const normalWaiters = waiterData ? waiterData.filter(c => c.type !== 'waiter_zig') : [];
    const zigWaiters = waiterData ? waiterData.filter(c => c.type === 'waiter_zig') : [];

    // Função interna para processar cada aba
    const processSheet = async (data, sheetName, headerRef) => {
        if (!data || data.length === 0) return;

        let sheet = sheets.find(s => s.properties.title === sheetName);
        
        // Se a aba não existe, cria
        if (!sheet) {
            console.log(`[BACKEND] Criando aba ${sheetName}...`);
            await googleSheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId_cloud_sync, resource: { requests: [{ addSheet: { properties: { title: sheetName } } }] } });
            await googleSheets.spreadsheets.values.append({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', resource: { values: [headerRef] } });
        } else {
            // Verifica cabeçalho
            const headerCheck = await googleSheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId_cloud_sync, range: `${sheetName}!A1:Z1` });
            const currentHeader = headerCheck.data.values ? headerCheck.data.values[0] : [];
            const isOutdated = headerRef.length > currentHeader.length || headerRef.some((h, i) => currentHeader[i] !== h);
            
            if (isOutdated) {
                console.log(`[BACKEND] Atualizando cabeçalho da aba: ${sheetName}`);
                await googleSheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId_cloud_sync,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [headerRef] }
                });
            }
        }

        // Prepara linhas para envio
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

        // Verifica duplicatas pelo Protocolo
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


// --- ROTA 5: EXPORTAÇÃO PARA EXCEL ---
app.post('/api/export-online-data', async (req, res) => {
  const { password, eventName } = req.body;
  if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
    return res.status(401).json({ message: 'Acesso não autorizado.' });
  }
  try {
    const googleSheets = await getGoogleSheetsClient();
    const fetchWithExtras = async (sheetName) => {
        try {
            // Usa UNFORMATTED_VALUE para garantir dados numéricos
            const response = await googleSheets.spreadsheets.values.get({ 
                spreadsheetId: spreadsheetId_cloud_sync, 
                range: sheetName,
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


// --- ROTA 6: HISTÓRICO ONLINE (AQUI ESTÁ A CORREÇÃO PRINCIPAL) ---
app.post('/api/online-history', async (req, res) => {
    const { eventName, password } = req.body;
    if (!eventName || !password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    }
    
    try {
        const googleSheets = await getGoogleSheetsClient();
        const sheetNames = [`Garçons - ${eventName}`, `GarçomZIG - ${eventName}`, `Caixas - ${eventName}`];
        
        // 1. Busca todas as abas com UNFORMATTED_VALUE (para pegar -70 ao invés de "R$ -70,00")
        const results = await Promise.allSettled(sheetNames.map(sn => 
            googleSheets.spreadsheets.values.get({ 
                spreadsheetId: spreadsheetId_cloud_sync, 
                range: sn, 
                valueRenderOption: 'UNFORMATTED_VALUE' 
            })
        ));

        let allClosings = [];

        // ... (dentro de server.js)

// Função Genérica para processar qualquer aba com Mapeamento Dinâmico
const processGenericSheet = (result, typeCategory) => {
    if (result.status === 'fulfilled' && result.value.data.values?.length > 1) {
        const [header, ...rows] = result.value.data.values;
        
        // 2. CRIA O MAPA DE COLUNAS (Nome -> Índice)
        const headerMap = {};
        header.forEach((col, idx) => {
            if (col) headerMap[String(col).trim().toUpperCase()] = idx;
        });

        return rows.map(row => {
            // 3. BUSCA INTELIGENTE DE VALORES
            const vTotal = getValFromRow(row, headerMap, ['VENDA TOTAL', 'TOTAL', 'RECARGA CASHLESS', 'RECARGA']);
            const vCred  = getValFromRow(row, headerMap, ['CRÉDITO', 'CREDITO', 'CREDIT']);
            const vDeb   = getValFromRow(row, headerMap, ['DÉBITO', 'DEBITO', 'DEBIT']);
            const vPix   = getValFromRow(row, headerMap, ['PIX']);
            const vCash  = getValFromRow(row, headerMap, ['CASHLESS']);
            const vProd  = getValFromRow(row, headerMap, ['VALOR TOTAL PRODUTOS', 'PRODUTOS', 'TOTAL PRODUTOS']);
            const vEst   = getValFromRow(row, headerMap, ['DEVOLUÇÃO/ESTORNO', 'ESTORNO', 'DEVOLUCAO']);
            const vCom   = getValFromRow(row, headerMap, ['COMISSÃO TOTAL', 'COMISSAO', 'COMISSAO TOTAL']);
            const vTroco = getValFromRow(row, headerMap, ['TROCO', 'VALOR TROCO']);
            const vFisico = getValFromRow(row, headerMap, ['DINHEIRO FÍSICO', 'DINHEIRO FISICO']);
            const vDif   = getValFromRow(row, headerMap, ['DIFERENÇA', 'DIFERENCA']);
            const vAcerto = getValFromRow(row, headerMap, ['VALOR ACERTO', 'ACERTO']);

            // Busca textos
            const cpf = getTextFromRow(row, headerMap, ['CPF']);
            const nome = getTextFromRow(row, headerMap, ['NOME GARÇOM', 'NOME DO CAIXA', 'GARÇOM', 'CAIXA']);
            
            // --- CORREÇÃO AQUI: Mudado de 'protocolo' para 'protocol' ---
            const protocol = getTextFromRow(row, headerMap, ['PROTOCOLO']); 
            // -----------------------------------------------------------

            const maquina = getTextFromRow(row, headerMap, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']);
            const operador = getTextFromRow(row, headerMap, ['OPERADOR']);
            
            // Tratamento de Data
            let data = row[headerMap['DATA']] || row[headerMap['DATE']]; 

            if (typeCategory === 'waiter' || typeCategory === 'waiter_zig') {
                // ... (lógica de cálculo permanece igual) ...
                
                // Venda Líquida = Venda Bruta - Estornos
                const vendaLiquida = vTotal - vEst;
                let pgtosDigitais = vCred + vDeb + vPix;
                if (typeCategory === 'waiter') { pgtosDigitais += vCash; }
                const dinheiroNaMao = vendaLiquida - pgtosDigitais;
                const diffCalculada = dinheiroNaMao - vCom;
                const isPagar = diffCalculada < -0.05; 

                return {
                    type: typeCategory, 
                    cpf, 
                    waiterName: nome, 
                    protocol, // Agora esta variável existe!
                    valorTotal: vTotal, 
                    valorEstorno: vEst, 
                    comissaoTotal: vCom,
                    diferencaPagarReceber: Math.abs(diffCalculada),
                    diferencaLabel: isPagar ? 'Pagar ao Garçom' : 'Receber do Garçom',
                    credito: vCred, debito: vDeb, pix: vPix, cashless: vCash,
                    valorTotalProdutos: vProd, 
                    numeroMaquina: maquina, 
                    operatorName: operador, 
                    timestamp: data
                };
            } else {
                // Lógica para Caixas
                const tipoCaixa = getTextFromRow(row, headerMap, ['TIPO']);
                const base = {
                    protocol, // Agora esta variável existe!
                    eventName, operatorName: operador, timestamp: data, cpf,
                    cashierName: nome, numeroMaquina: maquina,
                    valorTotalVenda: vTotal, credito: vCred, debito: vDeb, pix: vPix, 
                    cashless: vCash, valorTroco: vTroco, valorEstorno: vEst, 
                    dinheiroFisico: vFisico, valorAcerto: vAcerto,
                    diferenca: vDif, temEstorno: vEst > 0
                };
                return { 
                    ...base, 
                    type: (tipoCaixa.toUpperCase()==='FIXO') ? 'individual_fixed_cashier' : 'cashier', 
                    groupProtocol: base.protocol 
                };
            }
        });
    }
    return [];
};

        // Processa as 3 planilhas
        allClosings.push(...processGenericSheet(results[0], 'waiter'));
        allClosings.push(...processGenericSheet(results[1], 'waiter_zig'));
        allClosings.push(...processGenericSheet(results[2], 'cashier'));

        // 5. Ajuste Final de Data (Serial -> ISO String)
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


// --- ROTA 7: CONCILIAÇÃO YUZER (CORRIGIDA) ---
app.post('/api/reconcile-yuzer', async (req, res) => {
  const { eventName, yuzerData } = req.body;
  if (!eventName || !yuzerData) return res.status(400).json({ message: 'Dados incompletos.' });
  try {
    const googleSheets = await getGoogleSheetsClient();
    const sheetNames = [`Garçons - ${eventName}`, `GarçomZIG - ${eventName}`, `Caixas - ${eventName}`];
    
    // Busca dados
    const results = await Promise.allSettled(sheetNames.map(sn => 
        googleSheets.spreadsheets.values.get({ 
            spreadsheetId: spreadsheetId_cloud_sync, 
            range: sn, 
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
            if(Math.abs(yV-sV) > 1) { // Tolerância de 1 centavo
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

// --- ROTA 8: DELETAR REGISTRO ---
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

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
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