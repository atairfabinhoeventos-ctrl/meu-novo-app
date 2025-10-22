// src/services/apiService.js (VERSÃO COMPLETA CORRIGIDA - UUID Import, synced flag, findIndex debug)
// --- INÍCIO DA MODIFICAÇÃO UUID ---
// Tenta importar 'uuid'. Se falhar no build/runtime, usa um fallback simples.
let uuidv4;
try {
  // Nota: A importação dinâmica com 'await import' só funciona em contextos async
  // Para um módulo síncrono como este, a importação estática é mais comum.
  // Se 'npm install uuid' foi feito corretamente e o servidor reiniciado, isso deve funcionar.
  const uuidModule = require('uuid'); // Usando require para compatibilidade comum
  uuidv4 = uuidModule.v4;
  if (typeof uuidv4 !== 'function') {
     console.warn("[apiService] uuid.v4 não é uma função após importação! Verifique a instalação. Usando fallback.");
     // Fallback: Gera um ID pseudo-aleatório simples (NÃO GARANTIDO ÚNICO)
     uuidv4 = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  }
} catch (err) {
  console.error("[apiService] FALHA CRÍTICA ao importar 'uuid'. Verifique se 'npm install uuid' foi executado. Usando fallback.", err);
  // Fallback: Gera um ID pseudo-aleatório simples (NÃO GARANTIDO ÚNICO)
  uuidv4 = () => Math.random().toString(36).substring(2, 7).toUpperCase();
}
// --- FIM DA MODIFICAÇÃO UUID ---


/**
 * Retorna o protocolo existente se for uma edição, ou gera um novo protocolo base.
 * @param {object} closingData - Os dados completos do fechamento.
 * @returns {string} - O protocolo base (existente ou novo).
 */
const getBaseProtocol = (closingData) => { //
    // --- LÓGICA DE EDIÇÃO SIMPLIFICADA ---
    if (closingData.protocol) { //
        // Se um protocolo já existe (modo edição), confia que é o protocolo BASE correto
        // fornecido pela página de edição (ex: FixedCashierClosingPage já carrega o base).
        console.log(`[apiService][getBaseProtocol] Modo Edição: Usando protocolo base fornecido: ${closingData.protocol}`); //
        return closingData.protocol; //
    }
    // --- FIM DA LÓGICA DE EDIÇÃO ---

    // Se não há protocolo, gera um novo
    console.log(`[apiService][getBaseProtocol] Modo Novo Registro: Gerando novo protocolo base...`); //
    // Chama a função uuidv4 (importada ou fallback)
    const uniquePart = uuidv4().substring(0, 5).toUpperCase(); // Usa a variável uuidv4 //
    let prefix = 'UNK-'; //

    if (closingData.type === 'waiter') { //
        prefix = closingData.subType === '10_percent' ? 'G10-' : 'G8-'; //
    } else if (closingData.type === 'cashier') { //
        prefix = 'CXM-'; //
    } else if (closingData.type === 'fixed_cashier') { //
        prefix = 'CXF-'; //
    }

    const result = `${prefix}${uniquePart}`; //
    console.log(`[apiService][getBaseProtocol] Gerado novo protocolo BASE: ${result}`); //
    if (!result || result.length < 8) { //
      console.error("[apiService][getBaseProtocol] ERRO: Protocolo base resultante é inválido!", result, closingData); //
      // Usa o fallback uuidv4 aqui também se necessário
      return `ERR-${uuidv4().substring(0,5).toUpperCase()}`; //
    }
    return result; //
};

/**
 * Função centralizada para salvar qualquer tipo de fechamento no localStorage.
 * Garante 'synced: false', adiciona índice para Caixa Fixo e depura findIndex.
 */
const saveToLocalStorage = (closingData) => { //
    try {
        // Determina se é uma edição (closingData.protocol já existe E não está vazio)
        const isEditing = !!closingData.protocol; //
        const baseProtocol = getBaseProtocol(closingData); // Obtém/Gera o protocolo base //

        if (!baseProtocol) { //
             console.error("[apiService][saveToLocalStorage] ERRO CRÍTICO: Falha ao obter/gerar protocolo base. Abortando salvamento."); //
             throw new Error("Falha ao determinar o protocolo do registro."); //
        }
        console.log(`[apiService][saveToLocalStorage] Protocolo base: ${baseProtocol}, Modo Edição: ${isEditing}`); //

        // Cria o objeto principal a ser salvo/atualizado
        // *** GARANTE synced: false *** para novos e editados
        const dataToSave = { //
            ...closingData, //
            protocol: baseProtocol, // Garante que o protocolo base está no objeto principal //
            timestamp: closingData.timestamp || new Date().toISOString(), //
            synced: false // <-- FLAG GARANTIDA AQUI //
        };

        // --- LÓGICA ESPECIAL PARA CAIXA FIXO ---
        if (dataToSave.type === 'fixed_cashier' && Array.isArray(dataToSave.caixas)) { //
            dataToSave.caixas = dataToSave.caixas.map((caixa, index) => { //
                // Adiciona ou preserva o protocolo indexado
                // Se caixa.protocol já existe (edição), usa ele, senão gera um novo
                const indexedProtocol = isEditing && caixa.protocol ? caixa.protocol : `${baseProtocol}-${index + 1}`; //
                console.log(`[apiService][saveToLocalStorage] CXF Index ${index + 1}: Protocolo indexado: "${indexedProtocol}"`); //
                return { //
                    ...caixa, //
                    protocol: indexedProtocol // Protocolo individual //
                };
            });
            // Não removemos mais os protocolos individuais, eles precisam ser salvos
        }
        // --- FIM DA LÓGICA ESPECIAL ---

        // Lê os dados atuais do localStorage
        const allClosings = JSON.parse(localStorage.getItem('localClosings')) || []; //

        // --- DEBUG findIndex ---
        console.log(`[apiService][saveToLocalStorage] Procurando por protocolo base "${baseProtocol}" em ${allClosings.length} registros...`); //
        // Log dos protocolos existentes para comparação manual (se necessário)
        // console.log("[apiService][saveToLocalStorage] Protocolos existentes:", allClosings.map(c => c.protocol)); //

        const existingIndex = allClosings.findIndex(c => c.protocol === baseProtocol); // Busca pelo protocolo base //

        console.log(`[apiService][saveToLocalStorage] Resultado findIndex: ${existingIndex}`); //
        // --- FIM DEBUG findIndex ---

        if (existingIndex > -1) { //
            // Encontrado - Atualiza o registro existente
            console.log(`[apiService][saveToLocalStorage] ATUALIZANDO registro existente na posição ${existingIndex} com protocolo base: ${baseProtocol}`); //
            allClosings[existingIndex] = dataToSave; // Substitui o objeto inteiro //
        } else {
            // Não encontrado - Adiciona como novo registro
             if (isEditing) { // Se era pra ser edição mas não achou... //
                 console.warn(`[apiService][saveToLocalStorage] AVISO: Tentativa de EDIÇÃO para protocolo base "${baseProtocol}", mas não foi encontrado! Adicionando como NOVO registro.`); //
             } else {
                console.log(`[apiService][saveToLocalStorage] ADICIONANDO novo registro com protocolo base: ${baseProtocol}`); //
             }
            allClosings.push(dataToSave); // Adiciona //
        }

        // Salva a lista atualizada de volta
        localStorage.setItem('localClosings', JSON.stringify(allClosings)); //
        console.log(`[apiService][saveToLocalStorage] localStorage atualizado. Total de registros agora: ${allClosings.length}`); //

        console.log('[apiService] Disparando evento localDataChanged...'); //
        window.dispatchEvent(new Event('localDataChanged')); // Notifica sobre a mudança //

        return Promise.resolve({ success: true, data: dataToSave }); // Retorna o dado salvo //

    } catch (error) {
        console.error("[apiService][saveToLocalStorage] Erro CRÍTICO durante o salvamento:", error); // Log mais enfático //
        // Não dispara 'localDataChanged' em caso de erro
        return Promise.reject(error); // Rejeita a promessa //
    }
};

// Funções de exportação (sem alterações)
export const saveWaiterClosing = (closingData) => { //
    return saveToLocalStorage(closingData); // //
};
export const saveMobileCashierClosing = (closingData) => { //
    return saveToLocalStorage(closingData); // //
};
export const saveFixedCashierClosing = (closingData) => { //
    return saveToLocalStorage(closingData); // //
};