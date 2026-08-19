// server.js (VERSÃO INTEGRADA COM MONGODB DO SISGEF E GOOGLE SHEETS)
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

// CORREÇÃO: Como o .env e credentials.json estão empacotados na raiz junto com o server.js,
// o diretório correto SEMPRE é o __dirname, tanto no dev quanto em produção.
const resourcesPath = __dirname; 

require('dotenv').config({ path: path.join(resourcesPath, '.env') });

// 🚀 NOVA INTEGRAÇÃO: MONGODB DO SISGEF
const dbManager = require(path.join(__dirname, 'dbManager')); 

// A string de conexão pega do .env (se o .env for lido corretamente, a variável existirá)
const MONGODB_URI = process.env.MONGODB_URI;
dbManager.connect(MONGODB_URI);

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ==========================================
// SISTEMA DE MONITORAMENTO EM TEMPO REAL
// ==========================================

// Array para armazenar logs em memória
const requestLogs = [];
const MAX_LOGS = 1000;

// Mapa para rastrear conexões ativas
const activeConnections = new Map();

// Middleware de log global
app.use((req, res, next) => {
    const start = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: clientIP,
        userAgent: req.get('user-agent'),
        body: null,
        statusCode: null,
        responseTime: null,
        responseSize: 0,
        type: 'request'
    };

    // Identificar tipo de operação
    if (req.url.includes('/api/sync/master-data')) {
        logEntry.type = 'DOWNLOAD_BASE';
        console.log(`\n📥 [DOWNLOAD] Computador ${clientIP} está baixando a base de dados...`);
    } else if (req.url.includes('/api/cloud-sync')) {
        logEntry.type = 'UPLOAD_DADOS';
        console.log(`\n📤 [UPLOAD] Computador ${clientIP} está enviando dados...`);
    } else if (req.url.includes('/api/activate-license')) {
        logEntry.type = 'ATIVACAO_LICENCA';
        console.log(`\n🔑 [LICENÇA] Computador ${clientIP} está ativando licença...`);
    } else if (req.url.includes('/api/check-version')) {
        logEntry.type = 'CHECK_VERSION';
        console.log(`\n🔄 [VERSÃO] Computador ${clientIP} está verificando versão...`);
    }

    // Capturar body para requisições POST/PUT
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyCopy = { ...req.body };
        if (bodyCopy.password) bodyCopy.password = '***';
        if (bodyCopy.senha) bodyCopy.senha = '***';
        logEntry.body = JSON.stringify(bodyCopy).substring(0, 1000);
        
        // Para uploads, mostrar detalhes
        if (logEntry.type === 'UPLOAD_DADOS') {
            if (bodyCopy.eventName) {
                console.log(`🎪 Evento: ${bodyCopy.eventName}`);
            }
            if (bodyCopy.waiterData) {
                console.log(`👥 Garçons: ${bodyCopy.waiterData.length} registros`);
            }
            if (bodyCopy.cashierData) {
                console.log(`💰 Caixas: ${bodyCopy.cashierData.length} registros`);
            }
        }
    }

    // Capturar resposta
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        logEntry.statusCode = res.statusCode;
        logEntry.responseTime = duration;
        
        if (data) {
            logEntry.responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;
        }
        
        // Adicionar ao array de logs
        requestLogs.unshift(logEntry);
        if (requestLogs.length > MAX_LOGS) {
            requestLogs.pop();
        }
        
        // Log resumido
        const sizeKB = (logEntry.responseSize / 1024).toFixed(2);
        console.log(`✅ [${logEntry.type}] Concluído!`);
        console.log(`📊 Status: ${logEntry.statusCode} | ⏱️ ${duration}ms | 📦 ${sizeKB}KB`);
        console.log(`👤 IP: ${clientIP}`);
        console.log(`🕐 ${logEntry.timestamp}\n`);
        
        originalSend.call(this, data);
    };
    
    next();
});

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

// --- ROTA 1: OBTER DADOS MESTRE (MONGODB + SHEETS) - OTIMIZADA ---
app.get('/api/sync/master-data', async (req, res) => {
    try {
        const startTime = Date.now();
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        console.log(`🔄 [DOWNLOAD] Buscando dados do MongoDB...`);
        console.log(`📡 Cliente: ${clientIP}`);
        console.log(`🕐 Início: ${new Date().toISOString()}`);

        // 🚀 OTIMIZAÇÃO 1: Buscar apenas usuários com dados essenciais
        const dbUsuarios = await dbManager.Usuario.find(
            { status_aprovacao: { $ne: 'BANIDO' } }, // Exclui banidos
            {
                'telefone': 1,
                'dados.nome': 1,
                'dados.cpf': 1,
                'dados.pix': 1,
                'dados.tipo_pix': 1,
                '_id': 0
            }
        ).lean();
        
        console.log(`✅ [DOWNLOAD] ${dbUsuarios.length} usuários em ${Date.now() - startTime}ms`);

        // 🚀 OTIMIZAÇÃO 2: Buscar apenas eventos ATIVOS
        const dbEventos = await dbManager.Evento.find(
            { status: 'ATIVO' }, // Apenas eventos ativos
            {
                'nome': 1,
                'cidade': 1,
                'data': 1,
                'status': 1,
                'credenciados': 1,
                '_id': 0
            }
        ).lean();
        
        console.log(`✅ [DOWNLOAD] ${dbEventos.length} eventos ativos em ${Date.now() - startTime}ms`);

        // Mapeia os Garçons do formato Mongo para o formato que o SisFO precisa
        const waiters = dbUsuarios
            .filter(u => u.dados && u.dados.nome)
            .map(u => ({
                name: u.dados.nome,
                cpf: u.dados.cpf || '',
                pix: u.dados.pix || '',
                tipo_pix: u.dados.tipo_pix || '',
                telefone: u.telefone || ''
            }));

        // Mapeia os Eventos e extrai Credenciados apenas dos eventos ativos
        let allCredentials = [];
        const events = dbEventos
            .filter(e => e.nome)
            .map(e => {
                if (e.credenciados && Array.isArray(e.credenciados)) {
                    const credsComEvento = e.credenciados.map(c => ({
                        ...c,
                        eventName: e.nome
                    }));
                    allCredentials = [...allCredentials, ...credsComEvento];
                }

                return {
                    name: e.nome,
                    cidade: e.cidade || '',
                    data: e.data || '',
                    active: e.status === 'ABERTO' || e.status === 'ATIVO'
                };
            });

        console.log(`\n--- [RESUMO DOWNLOAD] ---`);
        console.log(`👥 Garçons: ${waiters.length}`);
        console.log(`📅 Eventos ativos: ${events.length}`);
        console.log(`🎖️ Credenciados: ${allCredentials.length}`);
        console.log(`⏱️ Tempo total: ${Date.now() - startTime}ms`);
        console.log(`-----------------------\n`);

        // 2. BUSCA APENAS OS RECIBOS NO GOOGLE SHEETS
        const googleSheets = await getGoogleSheetsClient();
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId_sync,
            range: 'DadosRecibos!A2:B', 
        });
        
        const receiptRoles = (response.data.values || []).map(row => ({
            role: row[0],
            value: parseSisfoCurrency(row[1])
        })).filter(r => r.role);

        // 3. ENVIA TUDO PARA O FRONTEND
        const responseData = { 
            waiters, 
            events, 
            receiptRoles, 
            credentials: allCredentials
        };
        
        const responseSize = JSON.stringify(responseData).length;
        console.log(`📦 Tamanho da resposta: ${(responseSize / 1024).toFixed(2)} KB`);
        console.log(`⏱️ Tempo total: ${Date.now() - startTime}ms`);
        
        res.status(200).json(responseData);
        
    } catch (error) {
        console.error('❌ Erro master-data:', error);
        res.status(500).json({ message: 'Erro interno ao buscar dados mestre do MongoDB/Sheets.' });
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

        const rowIndex = rows.findIndex(row => row[0] && normalizeString(row[0]) === normalizeString(originalRole));
        if (rowIndex === -1) return res.status(404).json({ message: 'Função original não encontrada.' });

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

/* ==========================================================================
ROTAS OBSOLETAS (COMENTADAS)
O cadastro de eventos e funcionários agora é responsabilidade do SISGEF.
==========================================================================
app.post('/api/update-base', async (req, res) => { ... });
app.post('/api/edit-waiter', async (req, res) => { ... });
app.post('/api/delete-waiter', async (req, res) => { ... });
app.post('/api/add-event', async (req, res) => { ... });
app.post('/api/update-event-status', async (req, res) => { ... });
*/

// --- ROTA 7: SYNC PARA A NUVEM (AGORA SALVA NO MONGODB) ---
// --- ROTA 7: SYNC PARA A NUVEM (AGORA SALVA NO MONGODB COM LOGS DETALHADOS) ---
app.post('/api/cloud-sync', async (req, res) => {
    const { eventName, waiterData, cashierData } = req.body;
    if (!eventName) return res.status(400).json({ message: 'Nome do evento é obrigatório.' });

    if (syncingEvents.has(eventName)) {
        return res.status(429).json({ message: `Sincronização já em andamento.` });
    }
    syncingEvents.add(eventName);
    
    const startTime = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    console.log(`\n📤 [UPLOAD] Iniciando sync de dados...`);
    console.log(`📡 Cliente: ${clientIP}`);
    console.log(`🎪 Evento: ${eventName}`);
    console.log(`👥 Garçons: ${waiterData ? waiterData.length : 0} registros`);
    console.log(`💰 Caixas: ${cashierData ? cashierData.length : 0} registros`);
    console.log(`🕐 Início: ${new Date().toISOString()}`);

    // Log detalhado do payload (para debug)
    if (waiterData && waiterData.length > 0) {
        console.log("📦 Exemplo do primeiro garçom:", JSON.stringify(waiterData[0], null, 2));
    }
    if (cashierData && cashierData.length > 0) {
        console.log("📦 Exemplo do primeiro caixa:", JSON.stringify(cashierData[0], null, 2));
    }

    try {
        // Acessa o modelo Fechamento (já deve estar exportado no dbManager)
        const Fechamento = dbManager.Fechamento;
        if (!Fechamento) {
            throw new Error("Modelo Fechamento não encontrado no dbManager. Verifique a exportação.");
        }

        const dadosParaSalvar = [];

        // 1. Processa Garçons
        if (waiterData && waiterData.length > 0) {
            waiterData.forEach(w => {
                dadosParaSalvar.push({
                    eventName,
                    protocol: w.protocol,
                    tipo: w.type === 'waiter_zig' ? 'waiter_zig' : 'waiter',
                    timestamp: new Date(),
                    operatorName: w.operatorName || '',
                    
                    // Dados pessoais
                    waiterName: w.waiterName || '',
                    cpf: w.cpf || '',
                    numeroMaquina: w.numeroMaquina || '',
                    chavePix: w.chavePix || '',
                    tipoPix: w.tipoPix || '',
                    telefone: w.telefone || '',
                    
                    // Valores financeiros
                    valorTotal: Number(w.valorTotal) || 0,
                    credito: Number(w.credito) || 0,
                    debito: Number(w.debito) || 0,
                    pix: Number(w.pix) || 0,
                    cashless: Number(w.cashless) || 0,
                    valorEstorno: Number(w.valorEstorno) || 0,
                    comissao8: Number(w.comissao8) || 0,
                    comissao10: Number(w.comissao10) || 0,
                    comissao4: Number(w.comissao4) || 0,
                    comissaoTotal: Number(w.comissaoTotal) || 0,
                    diferencaPagarReceber: Number(w.diferencaPagarReceber) || 0,
                    diferencaLabel: String(w.diferencaLabel) || '',
                    valorTotalProdutos: Number(w.valorTotalProdutos) || 0
                });
            });
        }

        // 2. Processa Caixas
        if (cashierData && cashierData.length > 0) {
            cashierData.forEach(c => {
                if (c.groupProtocol) {
                    // Caixa Fixo - agrupa pelo protocolo do grupo
                    const existing = dadosParaSalvar.find(d => d.protocol === c.groupProtocol && d.tipo === 'fixed_cashier');
                    if (existing) {
                        if (!existing.caixas) existing.caixas = [];
                        existing.caixas.push(c);
                        existing.totalDinheiroFisicoGrupo = (existing.totalDinheiroFisicoGrupo || 0) + (c.dinheiroFisico || 0);
                        existing.diferencaCaixa = (existing.diferencaCaixa || 0) + (c.diferenca || 0);
                    } else {
                        dadosParaSalvar.push({
                            eventName,
                            protocol: c.groupProtocol,
                            tipo: 'fixed_cashier',
                            timestamp: new Date(),
                            operatorName: c.operatorName || '',
                            caixas: [c],
                            totalDinheiroFisicoGrupo: c.dinheiroFisico || 0,
                            diferencaCaixa: c.diferenca || 0
                        });
                    }
                } else {
                    // Caixa Móvel ou individual
                    dadosParaSalvar.push({
                        eventName,
                        protocol: c.protocol,
                        tipo: c.type || 'cashier',
                        timestamp: new Date(),
                        operatorName: c.operatorName || '',
                        
                        cashierName: c.cashierName || '',
                        cpf: c.cpf || '',
                        numeroMaquina: c.numeroMaquina || '',
                        valorTotalVenda: Number(c.valorTotalVenda) || 0,
                        credito: Number(c.credito) || 0,
                        debito: Number(c.debito) || 0,
                        pix: Number(c.pix) || 0,
                        cashless: Number(c.cashless) || 0,
                        valorTroco: Number(c.valorTroco) || 0,
                        valorEstorno: Number(c.valorEstorno) || 0,
                        dinheiroFisico: Number(c.dinheiroFisico) || 0,
                        valorAcerto: Number(c.valorAcerto) || 0,
                        diferenca: Number(c.diferenca) || 0,
                        temEstorno: Boolean(c.temEstorno) || false
                    });
                }
            });
        }

        // 3. Salva no MongoDB (com upsert para evitar duplicatas)
        let novosRegistros = 0;
        if (dadosParaSalvar.length > 0) {
            console.log(`💾 Salvando ${dadosParaSalvar.length} registros no MongoDB...`);
            for (const dado of dadosParaSalvar) {
                try {
                    const result = await Fechamento.findOneAndUpdate(
                        { protocol: dado.protocol },
                        { $set: { ...dado, synced: true, syncDate: new Date() } },
                        { upsert: true, new: true }
                    );
                    if (result) novosRegistros++;
                } catch (singleError) {
                    console.error(`❌ Erro ao salvar protocolo ${dado.protocol}:`, singleError.message);
                    // Continua com os próximos
                }
            }
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [UPLOAD] Sync completo em ${duration}ms`);
        console.log(`📊 Resumo:`);
        console.log(`   🆕 Novos registros: ${novosRegistros}`);
        console.log(`👤 Cliente: ${clientIP}\n`);
        
        res.status(200).json({ 
            newWaiters: waiterData ? waiterData.length : 0,
            updatedWaiters: 0,
            newZigWaiters: waiterData ? waiterData.filter(w => w.type === 'waiter_zig').length : 0,
            updatedZigWaiters: 0,
            newCashiers: cashierData ? cashierData.length : 0,
            updatedCashiers: 0
        });

    } catch (error) {
        console.error("❌ [UPLOAD] ERRO DETALHADO NO SERVIDOR:");
        console.error("🚨 Mensagem:", error.message);
        console.error("📄 Stack:", error.stack);
        
        // Se for erro do MongoDB/Mongoose
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            console.error("🔴 Código MongoDB:", error.code);
            console.error("🔴 Detalhe:", error.errmsg);
            if (error.code === 11000) {
                console.error("⚠️ ERRO DE DUPLICATA: Protocolo já existe!");
            }
        }
        
        // Se for erro de validação do modelo
        if (error.name === 'ValidationError') {
            console.error("⚠️ Erro de validação:", error.errors);
        }
        
        res.status(500).json({ 
            message: 'Erro ao salvar no MongoDB. Verifique os logs do servidor.',
            error: error.message 
        });
    } finally {
        syncingEvents.delete(eventName);
        console.log(`🔓 [UPLOAD] Lock liberado para ${eventName}`);
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
// 4.X SISTEMA DE LICENCIAMENTO (GOOGLE SHEETS)
// ==========================================
app.post('/api/activate-license', async (req, res) => {
    const { licenseKey, clientName, clientDoc, clientEmail, machineId } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!licenseKey) return res.status(400).json({ valid: false, message: 'Chave não informada.' });

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(resourcesPath, 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });
        
        // Pega o ID da variável ou usa hardcoded se preferir
        const spreadsheetId = process.env.SPREADSHEET_ID; 

        // 1. Ler a aba "Licencas"
        const getRows = await googleSheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Licencas!A:H', 
        });

        const rows = getRows.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Banco de licenças vazio.' });
        }

        let rowIndex = -1;
        let licenseData = null;

        // Procura a chave (Coluna A)
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0].trim().toUpperCase() === licenseKey.trim().toUpperCase()) {
                rowIndex = i + 1;
                licenseData = rows[i];
                break;
            }
        }

        if (!licenseData) {
            return res.status(404).json({ valid: false, message: 'Chave inválida.' });
        }

        const currentStatus = licenseData[1]; // Coluna B (Status)
        const expirationString = licenseData[2]; // Coluna C (Data Validade dd/mm/yyyy)
        const registeredMachineId = licenseData[6]; // Coluna G (MachineID)

        // --- VALIDAÇÃO DE STATUS ---
        if (currentStatus && currentStatus.toLowerCase() === 'inativo') {
            return res.status(403).json({ valid: false, message: 'Licença desativada pelo administrador.' });
        }

        // --- VALIDAÇÃO DE DATA (EXPIRAÇÃO) ---
        let isExpired = false;
        if (expirationString) {
            // Converte dd/mm/yyyy para objeto Date
            const [day, month, year] = expirationString.split('/');
            const expDate = new Date(`${year}-${month}-${day}`);
            const today = new Date();
            today.setHours(0,0,0,0); // Zera hora para comparar apenas dia

            if (today > expDate) {
                isExpired = true;
            }
        }

        if (isExpired) {
            // Se expirou, atualizamos o status na planilha para "Expirado" automaticamente
            await googleSheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Licencas!B${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [['Expirado']] }
            });
            return res.status(403).json({ valid: false, message: `Licença expirada em ${expirationString}. Entre em contato para renovar.` });
        }

        // --- VALIDAÇÃO DE MÁQUINA ---
        if (registeredMachineId && registeredMachineId.trim() !== '' && registeredMachineId !== machineId) {
            return res.status(403).json({ valid: false, message: 'Chave já em uso em outra máquina.' });
        }

        // --- SUCESSO: ATUALIZA DADOS DO CLIENTE ---
        const dataAtivacao = new Date().toLocaleString('pt-BR');
        
        // Atualiza colunas D, E, F, G, H, I (Nome, Doc, Email, MachineID, DataAtivacao, IP)
        // Mantém Status (B) como Ativo se não estiver bloqueado
        const newStatus = currentStatus === 'Bloqueado' ? 'Bloqueado' : 'Ativo';

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Licencas!B${rowIndex}:I${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    newStatus,      // B
                    expirationString, // C (Mantém a data original)
                    clientName || licenseData[3], // D (Usa o novo ou mantém o antigo)
                    clientDoc || licenseData[4],  // E
                    clientEmail || licenseData[5],// F
                    machineId,      // G
                    dataAtivacao,   // H
                    clientIp        // I
                ]]
            }
        });

        return res.json({ 
            valid: true, 
            message: 'Licença válida.',
            expiration: expirationString,
            status: newStatus,
            clientName: licenseData[3] || clientName,
            clientDoc: licenseData[4] || clientDoc,
            clientEmail: licenseData[5] || clientEmail
        });

    } catch (error) {
        console.error('Erro na licença:', error);
        res.status(500).json({ valid: false, message: 'Erro interno ao validar licença.' });
    }
});

// --- ROTA 12: VERIFICAR VERSÃO DO SISTEMA ---
app.get('/api/check-version', async (req, res) => {
    try {
        const googleSheets = await getGoogleSheetsClient();
        const spreadsheetId = process.env.SPREADSHEET_ID || spreadsheetId_sync; 

        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId, 
            range: 'Config!A1:B2', 
        });

        const rows = response.data.values || [];
        let remoteVersion = '0.0.0';
        let storeLink = '';

        rows.forEach(row => {
            if (row[0] && String(row[0]).trim() === 'VersaoAtual') remoteVersion = String(row[1]).trim();
            if (row[0] && String(row[0]).trim() === 'LinkLoja') storeLink = String(row[1]).trim();
        });
        
        console.log(`[CheckVersion] Planilha: ${remoteVersion} | App: ${req.query.current || 'N/A'}`);

        res.status(200).json({ remoteVersion, storeLink });

    } catch (error) {
        console.error('[CheckVersion] Erro ao ler aba Config:', error.message);
        res.status(200).json({ remoteVersion: '0.0.0', storeLink: '' }); 
    }
});

// ==========================================
// 4.5 ROTA DE MONITORAMENTO
// ==========================================

// Ver logs das últimas requisições
app.get('/api/monitor/logs', (req, res) => {
    const password = req.query.password || req.headers['x-admin-password'];
    
    if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ 
            error: 'Senha incorreta',
            hint: 'Use a mesma senha do histórico online'
        });
    }
    
    res.json({
        total: requestLogs.length,
        logs: requestLogs.slice(0, 200) // Últimas 200 requisições
    });
});

// Ver status do servidor
app.get('/api/monitor/status', (req, res) => {
    const status = {
        server: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        },
        mongoConnection: 'connected',
        activeRequests: requestLogs.filter(log => log.responseTime === null).length,
        totalLogsStored: requestLogs.length
    };
    
    res.json(status);
});

// Limpar logs
app.post('/api/monitor/clear', (req, res) => {
    const password = req.body.password;
    
    if (!password || password !== process.env.ONLINE_HISTORY_PASSWORD) {
        return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    requestLogs.length = 0;
    res.json({ message: 'Logs limpos com sucesso' });
});

// ==========================================
// 5. INICIALIZAÇÃO DO SERVIDOR
// ==========================================

module.exports = app;
if (!isRunningInElectron) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor backend (Render) rodando na porta ${PORT}`);
    });
} else {
    console.log('Servidor Express pronto para ser iniciado pelo Electron.');
}