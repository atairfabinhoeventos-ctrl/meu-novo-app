// src/services/apiService.js (com salvamento local e protocolos curtos)
import { API_URL } from '../config';

/**
 * Gera um protocolo único e curto.
 * Combina o tempo atual (em segundos, convertido para Base36) com 3 caracteres aleatórios.
 * Exemplo de resultado: "QJ5S2G-XYZ"
 */
function generateShortProtocol() {
  // 1. Pega o tempo atual em segundos (um número menor que milissegundos)
  const timestampInSeconds = Math.floor(Date.now() / 1000);

  // 2. Converte o timestamp para Base36 (letras a-z e números 0-9) para encurtá-lo
  const shortTimestamp = timestampInSeconds.toString(36);

  // 3. Gera 3 caracteres aleatórios para evitar colisões no mesmo segundo
  const randomPart = Math.random().toString(36).substring(2, 5);

  // 4. Combina tudo e converte para maiúsculas para padronização
  return `${shortTimestamp}-${randomPart}`.toUpperCase();
}


// Função genérica para salvar ou atualizar um registro local
const saveOrUpdateLocalClosing = (closingData, protocolPrefix) => {
  console.log(`Modo LOCAL: Salvando dados (${protocolPrefix}) no computador...`);
  
  let localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
  
  // Se já tem um protocolo, está editando
  if (closingData.protocol && closingData.protocol.startsWith('LOCAL-')) {
    const index = localClosings.findIndex(c => c.protocol === closingData.protocol);
    if (index !== -1) {
      localClosings[index] = closingData; // Atualiza o registro
      console.log(`Registro ${closingData.protocol} atualizado.`);
    }
  } else {
    // Se não tem protocolo, é um novo registro
    const timestamp = new Date().toISOString();
    
    // --- ALTERAÇÃO APLICADA AQUI ---
    // Em vez de usar Date.now(), chamamos a nova função para gerar um protocolo curto.
    const shortProtocol = generateShortProtocol();
    const protocol = `${protocolPrefix}-${shortProtocol}`;
    
    const dataToStore = { ...closingData, protocol, timestamp };
    localClosings.push(dataToStore);
    closingData = dataToStore; // Atualiza o objeto original para retornar com os novos dados
    console.log(`Novo registro ${protocol} adicionado.`);
  }
  
  localStorage.setItem('localClosings', JSON.stringify(localClosings));
  return Promise.resolve({ data: closingData }); // Simula uma resposta de API
};


// --- FUNÇÕES EXPORTADAS ---

// Salvamento local para Garçom 8% e 10%
export const saveWaiterClosing = async (closingData) => {
  const protocolPrefix = closingData.comissaoTotal > 0 && closingData.valorAcerto ? 'LOCAL-G10' : 'LOCAL-G';
  return saveOrUpdateLocalClosing(closingData, protocolPrefix);
};

// Salvamento local para Caixa Móvel
export const saveMobileCashierClosing = async (closingData) => {
  return saveOrUpdateLocalClosing(closingData, 'LOCAL-CXM');
};

// Salvamento local para Caixa Fixo (Grupo)
export const saveFixedCashierClosing = async (closingData) => {
  return saveOrUpdateLocalClosing(closingData, 'LOCAL-CXF');
};