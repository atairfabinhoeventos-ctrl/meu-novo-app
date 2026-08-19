const mongoose = require('mongoose');

// ==============================================================================
// 1. DEFINIÇÃO DOS MODELOS
// ==============================================================================

const UsuarioSchema = new mongoose.Schema({
    telefone: { type: String, required: true, unique: true },
    etapa: String,
    status_aprovacao: { type: String, default: 'EM_CADASTRO' }, // EM_CADASTRO, PENDENTE, APROVADO, BLOQUEADO, BANIDO
    termos_aceitos: Boolean,
    
    // CAMPOS PARA LOGIN E SEGURANÇA
    senha: { type: String, default: null },
    primeiro_acesso: { type: Boolean, default: true },
    
    dados: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {
            nome: '', cpf: '', rg: '', data_nascimento: '',
            whatsapp: '', cep: '', endereco: '', 
            equipe: '', coordenador: '', 
            pix: '', tipo_pix: '', perfil: 'FREELANCER',
            nacionalidade: 'BRASILEIRA'
        } 
    },
    
    // Documentos vitais
    docs: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {
            selfie: {},
            doc_identidade: {},
            aso: {},
            epi: {},
            nr06: {},
            emp: {},
            permissao_trabalho: {}
        } 
    },
    temp: { type: mongoose.Schema.Types.Mixed, default: {} },
    permissoes: { type: mongoose.Schema.Types.Mixed, default: { equipes: [], funcoes: [] } },

    // SISTEMA DE PENALIDADES (STRIKES)
    quantidade_strikes: { type: Number, default: 0 },
    data_fim_suspensao: { type: Date, default: null },
    historico_strikes: [{
        data: { type: Date, default: Date.now },
        nivel: Number, // 1, 2, 3 ou 4 (Banimento)
        motivo: String,
        autor: String,
        foi_revertido: { type: Boolean, default: false },
        motivo_reversao: String,
        data_reversao: Date
    }] 
}, { timestamps: true, strict: false }); 

const EventoSchema = new mongoose.Schema({
    nome: String,
    data: Date,
    data_fim: Date,
    local: String,
    horario: String,
    horario_evento: String,
    horario_chegada: String,
    cidade: String,
    link_maps: String,
    obs: String,
    trava_bpc: { type: Boolean, default: false },
    admins_responsaveis: [{ type: String }],
    status: { type: String, default: 'ABERTO' }, // ABERTO, ATIVO, ENCERRADO
    docs_obrigatorios: { type: mongoose.Schema.Types.Mixed, default: { contrato: true, aso: false, epi: false, nr06: false } },
    credenciados: { type: Array, default: [] } 
}, { timestamps: true, strict: false });

const EquipeSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true },
    lideres: [{
        nome: String,
        cpf: String,
        telefone: String,
        funcoes: [String]
    }]
}, { timestamps: true });

const LogSchema = new mongoose.Schema({
    admin: String,
    acao: String,
    alvo: String,
    detalhes: String
}, { timestamps: true });

const ConfigSchema = new mongoose.Schema({
    chave: { type: String, unique: true }, 
    valor: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const BloqueioSchema = new mongoose.Schema({
    cpf: { type: String, required: true, unique: true },
    nome: String,
    motivo: String,
    autor_bloqueio: String,
    ultima_equipe: String,
    ultimo_coordenador: String,
    data_bloqueio: { type: Date, default: Date.now }
}, { timestamps: true });

// ==============================================================================
// 2. CRIAÇÃO DOS MODELOS
// ==============================================================================

const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Evento = mongoose.model('Evento', EventoSchema);
const Equipe = mongoose.model('Equipe', EquipeSchema);
const Log = mongoose.model('Log', LogSchema);
const Config = mongoose.model('Config', ConfigSchema);
const Bloqueio = mongoose.model('Bloqueio', BloqueioSchema);

// ==============================================================================
// 3. EXPORTAÇÃO E MÉTODOS AUXILIARES
// ==============================================================================

const dbManager = {
    connect: async (uri) => {
        try {
            await mongoose.connect(uri);
            console.log('✅ [MongoDB] Conectado com sucesso!');
        } catch (error) {
            console.error('❌ [MongoDB] Erro de conexão:', error);
            throw error;
        }
    },

    disconnect: async () => {
        try {
            await mongoose.disconnect();
            console.log('🔌 [MongoDB] Desconectado com sucesso!');
        } catch (error) {
            console.error('❌ [MongoDB] Erro ao desconectar:', error);
        }
    },

    // Modelos
    Usuario, 
    Evento, 
    Equipe, 
    Log, 
    Config, 
    Bloqueio,
    
    // ==============================================================================
    // FUNÇÕES DE USUÁRIO
    // ==============================================================================
    
    // Buscar usuário completo por telefone
    getUsuario: async (telefone) => {
        return await Usuario.findOne({ telefone }).lean();
    },

    // Buscar usuário completo por CPF
    getUsuarioPorCPF: async (cpf) => {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return await Usuario.findOne({ "dados.cpf": cpfLimpo }).lean();
    },

    // Salvar/atualizar usuário
    salvarUsuario: async (telefone, dadosAtualizados) => {
        if (dadosAtualizados.dados) dadosAtualizados.markModified?.('dados');
        if (dadosAtualizados.temp) dadosAtualizados.markModified?.('temp');
        if (dadosAtualizados.docs) dadosAtualizados.markModified?.('docs');
        
        return await Usuario.findOneAndUpdate({ telefone }, dadosAtualizados, { 
            new: true, 
            upsert: true,
            setDefaultsOnInsert: true 
        }).lean();
    },

    // 🚀 OTIMIZADO: Carregar apenas dados essenciais dos usuários
    carregarUsuarios: async () => {
        const users = await Usuario.find(
            { status_aprovacao: { $ne: 'BANIDO' } }, // Exclui usuários banidos
            {
                'telefone': 1,
                'dados.nome': 1,
                'dados.cpf': 1,
                'dados.pix': 1,
                'dados.tipo_pix': 1,
                'status_aprovacao': 1,
                '_id': 0
            }
        ).lean();
        
        const mapa = {};
        users.forEach(u => {
            mapa[u.telefone] = u;
        });
        
        console.log(`📦 [DB] Carregados ${users.length} usuários (dados essenciais)`);
        return mapa;
    },

    // 🚀 NOVO: Buscar usuário completo quando necessário
    getUsuarioCompleto: async (telefone) => {
        return await Usuario.findOne({ telefone }).lean();
    },

    // ==============================================================================
    // FUNÇÕES DE EVENTOS
    // ==============================================================================
    
    // 🚀 OTIMIZADO: Carregar apenas eventos ativos
    carregarEventosAtivos: async () => {
        const eventos = await Evento.find(
            { status: 'ATIVO' }, // Apenas eventos com status ATIVO
            {
                'nome': 1,
                'data': 1,
                'data_fim': 1,
                'local': 1,
                'horario': 1,
                'horario_evento': 1,
                'horario_chegada': 1,
                'cidade': 1,
                'link_maps': 1,
                'obs': 1,
                'trava_bpc': 1,
                'admins_responsaveis': 1,
                'status': 1,
                'docs_obrigatorios': 1,
                '_id': 0
            }
        ).lean();
        
        console.log(`📦 [DB] Carregados ${eventos.length} eventos ativos`);
        return eventos;
    },

    // Buscar evento completo por ID
    getEventoCompleto: async (eventoId) => {
        return await Evento.findById(eventoId).lean();
    },

    // Buscar evento por nome
    getEventoPorNome: async (nome) => {
        return await Evento.findOne({ nome }).lean();
    },

    // Salvar/atualizar evento
    salvarEvento: async (eventoId, dadosAtualizados) => {
        if (dadosAtualizados.docs_obrigatorios) dadosAtualizados.markModified?.('docs_obrigatorios');
        
        return await Evento.findByIdAndUpdate(
            eventoId, 
            dadosAtualizados, 
            { new: true, upsert: true }
        ).lean();
    },

    // ==============================================================================
    // FUNÇÕES DE EQUIPE
    // ==============================================================================
    
    // Carregar todas as equipes
    carregarEquipes: async () => {
        const equipes = await Equipe.find({}, { '_id': 0, '__v': 0 }).lean();
        console.log(`📦 [DB] Carregadas ${equipes.length} equipes`);
        return equipes;
    },

    // Buscar equipe por nome
    getEquipePorNome: async (nome) => {
        return await Equipe.findOne({ nome }).lean();
    },

    // Salvar/atualizar equipe
    salvarEquipe: async (nome, dadosAtualizados) => {
        return await Equipe.findOneAndUpdate(
            { nome }, 
            dadosAtualizados, 
            { new: true, upsert: true }
        ).lean();
    },

    // ==============================================================================
    // FUNÇÕES DE LOG
    // ==============================================================================
    
    // Registrar log
    registrarLog: async (admin, acao, alvo, detalhes) => {
        const log = new Log({
            admin,
            acao,
            alvo,
            detalhes
        });
        return await log.save();
    },

    // Buscar logs recentes
    getLogsRecentes: async (limite = 100) => {
        return await Log.find()
            .sort({ createdAt: -1 })
            .limit(limite)
            .lean();
    },

    // ==============================================================================
    // FUNÇÕES DE CONFIGURAÇÃO
    // ==============================================================================
    
    // Buscar configuração
    getConfig: async (chave) => {
        const config = await Config.findOne({ chave }).lean();
        return config ? config.valor : null;
    },

    // Salvar configuração
    salvarConfig: async (chave, valor) => {
        return await Config.findOneAndUpdate(
            { chave }, 
            { valor }, 
            { new: true, upsert: true }
        ).lean();
    },

    // ==============================================================================
    // FUNÇÕES DE BLOQUEIO
    // ==============================================================================
    
    // Buscar bloqueio por CPF
    getBloqueioPorCPF: async (cpf) => {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return await Bloqueio.findOne({ cpf: cpfLimpo }).lean();
    },

    // Salvar bloqueio
    salvarBloqueio: async (cpf, dadosBloqueio) => {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return await Bloqueio.findOneAndUpdate(
            { cpf: cpfLimpo }, 
            dadosBloqueio, 
            { new: true, upsert: true }
        ).lean();
    },

    // Remover bloqueio
    removerBloqueio: async (cpf) => {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return await Bloqueio.findOneAndDelete({ cpf: cpfLimpo });
    },

    // ==============================================================================
    // FUNÇÕES DE ESTATÍSTICAS (OPCIONAL)
    // ==============================================================================
    
    // Obter estatísticas gerais
    getEstatisticas: async () => {
        try {
            const totalUsuarios = await Usuario.countDocuments();
            const usuariosAprovados = await Usuario.countDocuments({ status_aprovacao: 'APROVADO' });
            const usuariosPendentes = await Usuario.countDocuments({ status_aprovacao: 'PENDENTE' });
            const eventosAtivos = await Evento.countDocuments({ status: 'ATIVO' });
            const totalEquipes = await Equipe.countDocuments();
            
            return {
                totalUsuarios,
                usuariosAprovados,
                usuariosPendentes,
                eventosAtivos,
                totalEquipes
            };
        } catch (error) {
            console.error('❌ [DB] Erro ao obter estatísticas:', error);
            return null;
        }
    }
};

// ==============================================================================
// 4. NOVO MODELO: FECHAMENTOS (Sincronização Cloud)
// ==============================================================================

const FechamentoSchema = new mongoose.Schema({
    // Identificação
    eventName: { type: String, required: true },
    protocol: { type: String, required: true, unique: true },
    tipo: { type: String, required: true }, // waiter, waiter_zig, cashier, fixed_cashier
    timestamp: { type: Date, default: Date.now },
    operatorName: String,
    
    // ---- DADOS DO GARÇOM ----
    waiterName: String,
    cpf: String,
    numeroCamiseta: String,
    numeroMaquina: String,
    chavePix: String,
    tipoPix: String,
    telefone: String,
    
    // Valores do Garçom
    valorTotal: Number,       // Venda bruta
    credito: Number,
    debito: Number,
    pix: Number,
    cashless: Number,
    valorEstorno: Number,
    comissao8: Number,
    comissao10: Number,
    comissao4: Number,
    comissaoTotal: Number,
    diferencaPagarReceber: Number,
    diferencaLabel: String,
    valorTotalProdutos: Number, // Para ZIG
    
    // ---- DADOS DO CAIXA MÓVEL ----
    cashierName: String,
    valorTotalVenda: Number,
    valorTroco: Number,
    dinheiroFisico: Number,
    valorAcerto: Number,
    diferenca: Number,
    temEstorno: { type: Boolean, default: false },
    
    // ---- DADOS DO CAIXA FIXO (GRUPO) ----
    caixas: { type: Array, default: [] }, // Array de objetos com os dados de cada caixa
    totalDinheiroFisicoGrupo: { type: Number, default: 0 },
    diferencaCaixa: { type: Number, default: 0 },
    
    // ---- CONTROLE DE SINCRONIZAÇÃO ----
    synced: { type: Boolean, default: false },
    syncDate: { type: Date, default: null }
}, { timestamps: true });

// ==============================================================================
// 5. CRIAÇÃO DO MODELO
// ==============================================================================

const Fechamento = mongoose.model('Fechamento', FechamentoSchema);

// ==============================================================================
// 6. ATUALIZAÇÃO DO dbManager PARA INCLUIR O NOVO MODELO
// ==============================================================================

// IMPORTANTE: NO SEU OBJETO dbManager, ADICIONE 'Fechamento' NA LISTA DE MODELOS
// Procure a linha: "// Modelos" dentro do objeto dbManager e adicione:
// Fechamento,

module.exports = dbManager;