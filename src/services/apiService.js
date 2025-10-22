// src/services/apiService.js

// SUBSTITUA A FUNÇÃO getBaseProtocol INTEIRA POR ESTA:
/**
 * Retorna o protocolo existente se for uma edição, ou gera um novo protocolo base.
 * @param {object} closingData - Os dados completos do fechamento.
 * @returns {string} - O protocolo base (existente ou novo).
 */
const getBaseProtocol = (closingData) => {
    // --- LÓGICA DE EDIÇÃO SIMPLIFICADA ---
    if (closingData.protocol) {
        // Se um protocolo já existe (modo edição), confia que é o protocolo BASE correto
        // fornecido pela página de edição (ex: FixedCashierClosingPage já carrega o base).
        console.log(`[apiService][getBaseProtocol] Modo Edição: Usando protocolo base fornecido: ${closingData.protocol}`);
        return closingData.protocol;
    }
    // --- FIM DA LÓGICA DE EDIÇÃO ---

    // Se não há protocolo, gera um novo
    console.log(`[apiService][getBaseProtocol] Modo Novo Registro: Gerando novo protocolo base...`);
    const uniquePart = uuidv4().substring(0, 5).toUpperCase();
    let prefix = 'UNK-'; // Prefixo padrão

    if (closingData.type === 'waiter') {
        prefix = closingData.subType === '10_percent' ? 'G10-' : 'G8-';
    } else if (closingData.type === 'cashier') {
        prefix = 'CXM-'; // Caixa Móvel
    } else if (closingData.type === 'fixed_cashier') {
        prefix = 'CXF-'; // Caixa Fixo (BASE)
    }

    const result = `${prefix}${uniquePart}`;
    console.log(`[apiService][getBaseProtocol] Gerado novo protocolo BASE: ${result}`);
    if (!result || result.length < 8) { // Verifica prefixo + 5 chars
      console.error("[apiService][getBaseProtocol] ERRO: Protocolo base resultante é inválido!", result, closingData);
      return `ERR-${uuidv4().substring(0,5).toUpperCase()}`; // Fallback
    }
    return result;
};

// A função saveToLocalStorage e as exportações permanecem as mesmas da versão anterior
// (com a adição de 'synced: false')
const saveToLocalStorage = (closingData) => {
    try {
        const baseProtocol = getBaseProtocol(closingData); // Agora usa a função simplificada acima
        console.log(`[apiService][saveToLocalStorage] Protocolo base determinado: ${baseProtocol}`); //

        const dataToSave = {
            ...closingData,
            protocol: baseProtocol, // O objeto principal usa o protocolo base
            timestamp: closingData.timestamp || new Date().toISOString(),
            synced: false // Mantém a flag 'synced'
        };

        // --- LÓGICA ESPECIAL PARA CAIXA FIXO ---
        if (dataToSave.type === 'fixed_cashier' && Array.isArray(dataToSave.caixas)) { //
            dataToSave.caixas = dataToSave.caixas.map((caixa, index) => {
                // Adiciona ou preserva o protocolo indexado a cada caixa individual
                // Se caixa.protocol já existe (edição), usa ele, senão gera um novo
                const indexedProtocol = caixa.protocol || `${baseProtocol}-${index + 1}`;
                console.log(`[apiService][saveToLocalStorage] CXF Index ${index + 1}: Atribuindo/Preservando protocolo "${indexedProtocol}" ao objeto caixa.`);
                return {
                    ...caixa,
                    protocol: indexedProtocol // <-- PROTOCOLO INDIVIDUAL AQUI
                };
            });
            console.log('[apiService][saveToLocalStorage] Objeto CXF final antes de salvar (protocolos):', JSON.stringify(dataToSave.caixas.map(c => c.protocol)));
        }
        // --- FIM DA LÓGICA ESPECIAL ---

        const allClosings = JSON.parse(localStorage.getItem('localClosings')) || []; //

        // Encontra o índice usando o PROTOCOLO BASE para todos os tipos
        const existingIndex = baseProtocol
            ? allClosings.findIndex(c => c.protocol === baseProtocol) //
            : -1;

        if (existingIndex > -1) {
            console.log(`[apiService][saveToLocalStorage] Atualizando registro existente com protocolo base: ${baseProtocol}`); //
            allClosings[existingIndex] = dataToSave; // Substitui o objeto inteiro
        } else {
            // Se findIndex falhou (-1), adiciona como novo (com log de aviso se era pra ser edição)
            if (closingData.protocol) { // Verifica se veio um protocolo de edição
                 console.warn(`[apiService][saveToLocalStorage] AVISO: Tentativa de edição para protocolo base ${baseProtocol}, mas não encontrado! Adicionando como novo registro.`);
            } else {
                console.log(`[apiService][saveToLocalStorage] Adicionando novo registro com protocolo base: ${baseProtocol}`); //
            }
            allClosings.push(dataToSave); // Adiciona
        }

        localStorage.setItem('localClosings', JSON.stringify(allClosings)); //

        console.log('[apiService] Disparando evento localDataChanged...'); //
        window.dispatchEvent(new Event('localDataChanged')); //

        return Promise.resolve({ success: true, data: dataToSave }); //

    } catch (error) {
        console.error("[apiService][saveToLocalStorage] Erro ao salvar:", error); //
        return Promise.reject(error);
    }
};

// Funções de exportação (sem alterações)
export const saveWaiterClosing = (closingData) => {
    return saveToLocalStorage(closingData); //
};
export const saveMobileCashierClosing = (closingData) => {
    return saveToLocalStorage(closingData); //
};
export const saveFixedCashierClosing = (closingData) => {
    return saveToLocalStorage(closingData); //
};