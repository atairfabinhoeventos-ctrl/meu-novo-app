// src/services/apiService.js (VERSÃO COM PROTOCOLO CURTO E INDEXADO)
import { v4 as uuidv4 } from 'uuid'; // Verifica se a importação está correta

/**
 * Gera a PARTE BASE de um novo protocolo (Prefixo-5Digitos) ou retorna o protocolo existente.
 * Não adiciona o índice para Caixa Fixo aqui.
 * @param {object} closingData - Os dados completos do fechamento.
 * @returns {string} - Um protocolo base ou o protocolo existente.
 */
const getBaseProtocol = (closingData) => {
    // Se já existe um protocolo (edição), retorna ele sem alterar
    if (closingData.protocol) {
        // Para edição de caixa fixo, retorna apenas a parte base (antes do último '-')
        if (closingData.type === 'fixed_cashier' && closingData.protocol.includes('-')) {
             const baseProto = closingData.protocol.substring(0, closingData.protocol.lastIndexOf('-'));
             console.log(`[apiService][getBaseProtocol] Usando protocolo base existente (edição CXF): ${baseProto}`);
             return baseProto;
        }
        console.log(`[apiService][getBaseProtocol] Usando protocolo existente (edição): ${closingData.protocol}`);
        return closingData.protocol;
    }

    // Gera 5 caracteres únicos em maiúsculas
    const uniquePart = uuidv4().substring(0, 5).toUpperCase();
    let prefix = 'UNK-'; // Prefixo padrão

    if (closingData.type === 'waiter') {
        //
        prefix = closingData.subType === '10_percent' ? 'G10-' : 'G8-';
    } else if (closingData.type === 'cashier') {
        //
        prefix = 'CXM-'; // Caixa Móvel
    } else if (closingData.type === 'fixed_cashier') {
        //
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

/**
 * Função centralizada para salvar qualquer tipo de fechamento no localStorage.
 * Adiciona índice ao protocolo para Caixa Fixo.
 */
const saveToLocalStorage = (closingData) => {
    try {
        const baseProtocol = getBaseProtocol(closingData); //
        console.log(`[apiService][saveToLocalStorage] Protocolo base determinado: ${baseProtocol}`); //

        // Cria o objeto principal a ser salvo/atualizado
        const dataToSave = {
            ...closingData,
            protocol: baseProtocol, // O objeto principal usa o protocolo base
            timestamp: closingData.timestamp || new Date().toISOString()
        };

        // --- LÓGICA ESPECIAL PARA CAIXA FIXO ---
        if (dataToSave.type === 'fixed_cashier' && Array.isArray(dataToSave.caixas)) { //
            dataToSave.caixas = dataToSave.caixas.map((caixa, index) => {
                // Adiciona o protocolo indexado a cada caixa individual
                const indexedProtocol = `${baseProtocol}-${index + 1}`; //
                // ---> LOG DETALHADO <---
                console.log(`[apiService][saveToLocalStorage] CXF Index ${index + 1}: Atribuindo protocolo "${indexedProtocol}" ao objeto caixa.`); //
                return {
                    ...caixa,
                    protocol: indexedProtocol // <-- PROTOCOLO INDIVIDUAL AQUI
                };
            });
             // ---> LOG APÓS O MAP <---
            console.log('[apiService][saveToLocalStorage] Objeto CXF final antes de salvar (protocolos):', JSON.stringify(dataToSave.caixas.map(c => c.protocol))); //
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
            console.log(`[apiService][saveToLocalStorage] Adicionando novo registro com protocolo base: ${baseProtocol}`); //
            allClosings.push(dataToSave); //
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

// Funções de exportação
export const saveWaiterClosing = (closingData) => {
    // Importante: Garanta que o 'type' (e 'subType' se necessário) esteja no closingData
    return saveToLocalStorage(closingData); //
};
export const saveMobileCashierClosing = (closingData) => {
    // Importante: Garanta que o 'type' ('cashier') esteja no closingData
    return saveToLocalStorage(closingData); //
};
export const saveFixedCashierClosing = (closingData) => {
     // Importante: Garanta que o 'type' ('fixed_cashier') esteja no closingData
    return saveToLocalStorage(closingData); //
};