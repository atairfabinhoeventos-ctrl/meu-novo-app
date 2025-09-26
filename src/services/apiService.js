// src/services/apiService.js (com salvamento local para Garçons e Caixas)
import { API_URL } from '../config';

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
    const protocol = `${protocolPrefix}-${Date.now()}`;
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
  // O protocolo diferencia os tipos de fechamento de garçom
  const protocolPrefix = closingData.comissaoTotal > 0 && closingData.valorAcerto ? 'LOCAL-GW10' : 'LOCAL-GW';
  return saveOrUpdateLocalClosing(closingData, protocolPrefix);
};

// NOVO: Salvamento local para Caixa Móvel
export const saveMobileCashierClosing = async (closingData) => {
  return saveOrUpdateLocalClosing(closingData, 'LOCAL-CXM');
};

// NOVO: Salvamento local para Caixa Fixo (Grupo)
export const saveFixedCashierClosing = async (closingData) => {
  return saveOrUpdateLocalClosing(closingData, 'LOCAL-CXF');
};