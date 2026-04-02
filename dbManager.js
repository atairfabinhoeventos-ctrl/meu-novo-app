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
    
    // 🚀 CORREÇÃO AQUI: Tornamos os documentos vitais "nativos" na estrutura!
    docs: { 
        type: mongoose.Schema.Types.Mixed, 
        default: {
            selfie: {},
            doc_identidade: {},
            aso: {},
            epi: {},                // Agora é nativo
            nr06: {},               // Agora é nativo
            emp: {},                // Agora é nativo
            permissao_trabalho: {}  // Agora é nativo
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
        autor: String, // Quem aplicou o bloqueio (Admin ou Sistema)
        foi_revertido: { type: Boolean, default: false },
        motivo_reversao: String,
        data_reversao: Date
    }] 
// 🚀 CORREÇÃO AQUI: A flag strict: false liberta o Mongoose para aceitar documentos "EXTRAS" imprevisíveis
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
    trava_bpc: { type: Boolean, default: false }, // 🚀 Adicionado para gravar a configuração de BPC
    admins_responsaveis: [{ type: String }], // 🚀 Adicionado para gravar quem recebe notificação no WhatsApp
    status: { type: String, default: 'ABERTO' }, // ABERTO, ATIVO, ENCERRADO
    docs_obrigatorios: { type: mongoose.Schema.Types.Mixed, default: { contrato: true, aso: false, epi: false, nr06: false } },
    credenciados: { type: Array, default: [] } 
}, { timestamps: true, strict: false }); // 🚀 strict: false adicionado para garantir que não ignora campos extras futuros

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
        }
    },

    // Modelos
    Usuario, 
    Evento, 
    Equipe, 
    Log, 
    Config, 
    Bloqueio,
    
    // Funções de Usuário
    getUsuario: async (telefone) => {
        return await Usuario.findOne({ telefone });
    },

    getUsuarioPorCPF: async (cpf) => {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return await Usuario.findOne({ "dados.cpf": cpfLimpo });
    },

    salvarUsuario: async (telefone, dadosAtualizados) => {
        // Usa markModified para garantir que campos Mixed (dados, temp, docs) sejam salvos
        if (dadosAtualizados.dados) dadosAtualizados.markModified?.('dados');
        if (dadosAtualizados.temp) dadosAtualizados.markModified?.('temp');
        if (dadosAtualizados.docs) dadosAtualizados.markModified?.('docs');
        
        return await Usuario.findOneAndUpdate({ telefone }, dadosAtualizados, { 
            new: true, 
            upsert: true,
            setDefaultsOnInsert: true 
        });
    },

    carregarUsuarios: async () => {
        const users = await Usuario.find();
        const mapa = {};
        users.forEach(u => mapa[u.telefone] = u);
        return mapa;
    }
};

module.exports = dbManager;