// src/services/syncService.js (VERSÃO CORRIGIDA - ROTA /sync/master-data CORRIGIDA)
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Tenta sincronizar um novo funcionário (garçom/caixa) com a base de dados mestre na nuvem.
 * Esta função é "fire-and-forget".
 * @param {object} personnelObject O objeto do novo funcionário (ex: { cpf: '123...', name: 'Nome' })
 */
export const attemptBackgroundSyncNewPersonnel = async (personnelObject) => {
  if (!personnelObject || !personnelObject.cpf || !personnelObject.name) {
    console.warn('[BackgroundSync][NewPersonnel] Dados de funcionário inválidos para sync.');
    return;
  }
  // A API /api/update-base espera um objeto com a chave 'waiters'
  const payload = {
    waiters: [personnelObject], //
    events: []
  };
  try {
    console.log('[BackgroundSync][NewPersonnel] Tentando sincronizar novo funcionário na nuvem:', personnelObject.cpf);
    await axios.post(`${API_URL}/api/update-base`, payload); //
    console.log('[BackgroundSync][NewPersonnel] Sucesso! Novo funcionário', personnelObject.cpf, 'sincronizado com a nuvem.');
  } catch (error) {
    console.warn('[BackgroundSync][NewPersonnel] Falha ao sincronizar novo funcionário:', personnelObject.cpf, '. Verifique a conexão.');
  }
};

/**
 * Baixa e atualiza os dados mestre (funcionários e eventos) da nuvem.
 * ESTA FUNÇÃO AGORA LANÇA UM ERRO (throws) SE FALHAR,
 * para que o SyncContext possa capturá-lo.
 */
export const backgroundDownloadMasterData = async () => {
  // O try/catch foi removido daqui e movido para o SyncContext
  console.log('[BackgroundSync][Download] Iniciando busca de dados mestre...'); //
  
  // --- INÍCIO DA CORREÇÃO (ROTA) ---
  // A rota correta no seu server.js usa /api/sync/master-data (com barra)
  const response = await axios.get(`${API_URL}/api/sync/master-data`); //
  // --- FIM DA CORREÇÃO (ROTA) ---

  const { waiters: onlinePersonnel, events: onlineEvents } = response.data; //
  console.log(`[BackgroundSync][Download] Recebidos ${onlinePersonnel?.length || 0} funcionários e ${onlineEvents?.length || 0} eventos.`); //

  let personnelUpdated = false;
  let eventsUpdated = false;

  // --- Atualiza Funcionários ---
  if (onlinePersonnel && onlinePersonnel.length > 0) {
    const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || []; //
    const localCpfSet = new Set(localPersonnel.map(w => w.cpf.trim())); //
    let newPersonnelCount = 0;

    onlinePersonnel.forEach(onlinePerson => {
      //
      if (onlinePerson.cpf && !localCpfSet.has(onlinePerson.cpf.trim())) {
        localPersonnel.push(onlinePerson); //
        newPersonnelCount++;
      }
    });
    if (newPersonnelCount > 0) {
      localStorage.setItem('master_waiters', JSON.stringify(localPersonnel)); //
      console.log(`[BackgroundSync][Download] ${newPersonnelCount} novo(s) funcionário(s) salvo(s) localmente.`); //
      personnelUpdated = true;
    }
  }

  // --- Atualiza Eventos ---
  if (onlineEvents && onlineEvents.length > 0) {
    const localEvents = JSON.parse(localStorage.getItem('master_events')) || []; //
    const localEventsMap = new Map(localEvents.map(e => [e.name, e])); //
    let newEventsCount = 0;
    let updatedEventsCount = 0;

    onlineEvents.forEach(onlineEvent => {
      if (onlineEvent.name) {
        if (localEventsMap.has(onlineEvent.name)) {
          const existingEvent = localEventsMap.get(onlineEvent.name);
          if (existingEvent.active !== onlineEvent.active) { //
            existingEvent.active = onlineEvent.active;
            updatedEventsCount++;
          }
        } else {
          localEventsMap.set(onlineEvent.name, onlineEvent); //
          newEventsCount++;
        }
      }
    });
    if (newEventsCount > 0 || updatedEventsCount > 0) {
      const mergedEvents = Array.from(localEventsMap.values()); //
      localStorage.setItem('master_events', JSON.stringify(mergedEvents)); //
      console.log(`[BackgroundSync][Download] Eventos salvos localmente: ${newEventsCount} novo(s), ${updatedEventsCount} atualizado(s).`); //
      eventsUpdated = true;
    }
  }
  // Retorna true se algo foi atualizado (pode ser usado opcionalmente)
  return personnelUpdated || eventsUpdated;
};


/**
 * Tenta enviar dados locais pendentes (de um evento por vez) para a nuvem.
 * Esta função é chamada periodicamente pelo App.jsx.
 */
export const retryPendingUploads = async () => {
  console.log('[BackgroundUpload] Iniciando retryPendingUploads...'); // <-- LOG 1
  let allClosings;
  try {
      allClosings = JSON.parse(localStorage.getItem('localClosings')) || []; //
  } catch (e) {
      console.error('[BackgroundUpload] Erro ao ler localClosings:', e); // <-- LOG 2 (ERRO)
      // Dispara o evento mesmo em erro de leitura, para o status ser reavaliado
      window.dispatchEvent(new Event('localDataChanged')); //
      return;
  }

  // --- INÍCIO DA MODIFICAÇÃO (PASSO 1.2) ---
  // Filtra para pegar apenas os que não foram sincronizados
  const unsyncedClosings = allClosings.filter(c => c.synced !== true);

  console.log(`[BackgroundUpload] Itens locais encontrados: ${allClosings.length}. Itens NÃO SINCRONIZADOS: ${unsyncedClosings.length}`); // <-- LOG MODIFICADO

  if (unsyncedClosings.length === 0) { // <-- Verifique unsyncedClosings
      console.log('[BackgroundUpload] Nada para enviar. Disparando localDataChanged para garantir status verde.'); //
      window.dispatchEvent(new Event('localDataChanged')); //
      return;
  }

  // Agrupa todos os fechamentos pendentes por evento
  const closingsByEvent = unsyncedClosings.reduce((acc, closing) => { // <-- Use unsyncedClosings
      const eventName = closing.eventName; //
  // --- FIM DA MODIFICAÇÃO (PASSO 1.2) ---
      if (!eventName) { // Ignora registros sem nome de evento
        console.warn('[BackgroundUpload] Registro ignorado por falta de eventName:', closing.protocol); //
        return acc;
      }
      if (!acc[eventName]) {
          acc[eventName] = [];
      }
      acc[eventName].push(closing); //
      return acc;
  }, {});

  // Pega o primeiro evento da lista para tentar sincronizar
  const eventName = Object.keys(closingsByEvent)[0]; //
  if (!eventName) {
      console.warn('[BackgroundUpload] Nenhum evento válido encontrado nos dados pendentes.'); //
      // Dispara evento para reavaliar status caso haja dados inválidos no storage
      window.dispatchEvent(new Event('localDataChanged')); //
      return;
  }
  const eventClosings = closingsByEvent[eventName]; // Dados do evento atual

  console.log(`[BackgroundUpload] Preparando para enviar ${eventClosings.length} registros do evento: ${eventName}`); // <-- LOG 5

  // ---> MODIFICAÇÃO: Extrair todos os protocolos *antes* de enviar <---
  const protocolsBeingSent = new Set(); //
  eventClosings.forEach(closing => { //
      if (closing.type === 'fixed_cashier' && Array.isArray(closing.caixas)) { //
          closing.caixas.forEach(caixa => { //
              if (caixa.protocol) protocolsBeingSent.add(caixa.protocol); //
          });
      } else if (closing.protocol) { //
          protocolsBeingSent.add(closing.protocol); //
      }
  });
  console.log('[BackgroundUpload] Protocolos nesta tentativa de envio:', Array.from(protocolsBeingSent)); //
  // ---> FIM DA MODIFICAÇÃO <---


  // Formatação (waiterData, cashierData)
  const waiterData = eventClosings.filter(c => c.type === 'waiter').map(formatWaiterForApi); //
  const cashierData = eventClosings
      .filter(c => c.type === 'cashier' || c.type === 'fixed_cashier') //
      .flatMap(formatCashierForApi); // flatMap cuidará de ambos os casos

  const payload = {
      eventName, //
      waiterData, //
      cashierData, //
  };
  // console.log('[BackgroundUpload] Payload a ser enviado:', JSON.stringify(payload, null, 2)); // LOG 6 (Descomentar se necessário)

  try {
      console.log('[BackgroundUpload] Enviando POST para /api/cloud-sync...'); // <-- LOG 7
      const response = await axios.post(`${API_URL}/api/cloud-sync`, payload); //
      console.log('[BackgroundUpload] Resposta da API:', response.data); // Log Sucesso

      // --- INÍCIO DA MODIFICAÇÃO (PASSO 1.3) - LÓGICA DE MARCAÇÃO (SUBSTITUI A DE LIMPEZA) ---
      console.log('[BackgroundUpload] Processamento bem-sucedido. Marcando protocolos como synced no localStorage...'); //

      // Lê novamente o localStorage *ANTES* de modificar, caso algo tenha mudado
      let currentAllClosings;
      try {
        currentAllClosings = JSON.parse(localStorage.getItem('localClosings')) || []; //
      } catch (readError){
        console.error('[BackgroundUpload] Erro ao reler localStorage antes de marcar:', readError); //
        // Tenta continuar com a versão anterior, mas avisa
        currentAllClosings = allClosings; //
      }


      // LÓGICA DE MAPA (SUBSTITUI A LÓGICA DE FILTRO)
      const updatedClosings = currentAllClosings.map(closing => {
          // Se o item já estava synced, mantenha-o
          if (closing.synced === true) {
              return closing;
          }

          let itemWasSent = false;
          
          if (closing.type === 'fixed_cashier' && Array.isArray(closing.caixas)) {
              // Se *algum* (some) sub-protocolo foi enviado, o objeto principal deve ser marcado
              if (closing.caixas.some(caixa => protocolsBeingSent.has(caixa.protocol))) {
                  itemWasSent = true;
              }
          } else {
              // Para outros tipos, verifica o protocolo principal
              if (protocolsBeingSent.has(closing.protocol)) {
                  itemWasSent = true;
              }
          }

          // Se este objeto foi sincronizado nesta rodada, retorna ele com a flag 'synced: true'
          if (itemWasSent) {
              return { ...closing, synced: true };
          }
          
          // Senão, retorna o objeto como estava (provavelmente 'synced: false' ou undefined)
          return closing;
      });

      console.log(`[BackgroundUpload] Itens totais: ${updatedClosings.length}. Marcados como 'synced' nesta rodada.`); //

      // Salva os dados ATUALIZADOS de volta no localStorage
      localStorage.setItem('localClosings', JSON.stringify(updatedClosings)); //
      console.log('[BackgroundUpload] localStorage atualizado com sucesso.'); //
      // --- FIM DA MODIFICAÇÃO (PASSO 1.3) ---

      console.log('[BackgroundUpload] Disparando localDataChanged após sucesso...'); // <-- LOG 10
      window.dispatchEvent(new Event('localDataChanged')); // Dispara evento para atualizar indicador

  } catch (error) {
      // FALHA no envio - Não faz nada, mantém os dados para a próxima tentativa
      console.error('[BackgroundUpload] ERRO ao enviar dados:', error.response?.data || error.message); // <-- LOG 11 (ERRO)
  }
};


// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO (Com protocolo curto/indexado e fallbacks) ---

/**
 * Formata os dados de um fechamento de GARÇOM para o formato exato que a API espera.
 */
const formatWaiterForApi = (c) => ({
  // --- MODIFICAÇÃO (PASSO 3.1) ---
  timestamp: c.timestamp || new Date().toISOString(), // Envia ISO String
  // --------------------------------
  protocol: c.protocol || '', // - Adicionado fallback
  cpf: c.cpf || '', // - Adicionado fallback
  waiterName: c.waiterName || '', // - Adicionado fallback
  numeroMaquina: c.numeroMaquina || '', // - Adicionado fallback
  valorTotal: c.valorTotal || 0, // - Adicionado fallback
  credito: c.credito || 0, // - Adicionado fallback
  debito: c.debito || 0, // - Adicionado fallback
  pix: c.pix || 0, // - Adicionado fallback
  cashless: c.cashless || 0, // - Adicionado fallback
  valorEstorno: c.temEstorno ? (c.valorEstorno || 0) : 0, // - Adicionado fallback
  comissaoTotal: c.comissaoTotal || 0, // - Adicionado fallback
  // Calcula o acerto garantindo que os valores existam
  acerto: c.diferencaLabel === 'Pagar ao Garçom' ? -(c.diferencaPagarReceber || 0) : (c.diferencaPagarReceber || 0), //
  operatorName: c.operatorName || '', // - Adicionado fallback
});

/**
 * Formata os dados de um fechamento de CAIXA (móvel ou fixo) para o formato da API.
 * Modificado para usar o protocolo indexado já existente no Caixa Fixo.
 */
const formatCashierForApi = (closing) => {
    // --- MODIFICAÇÃO (PASSO 3.1) ---
    const baseTimestamp = closing.timestamp || new Date().toISOString(); // Envia ISO String
    // --------------------------------
    const baseOperatorName = closing.operatorName || ''; //

    // --- CAIXA FIXO (GRUPO) ---
    // Verifica o type no objeto principal 'closing'
    if (closing.type === 'fixed_cashier' && Array.isArray(closing.caixas)) { //
        // Itera sobre o array 'caixas'
        return closing.caixas.map((caixa, index) => { // 'caixa' já contém o protocolo indexado
            const valorTotalVenda = caixa.valorTotalVenda || 0; //
            const credito = caixa.credito || 0; //
            const debito = caixa.debito || 0; //
            const pix = caixa.pix || 0; //
            const cashless = caixa.cashless || 0; //
            const dinheiroFisico = caixa.dinheiroFisico || 0; //
            const valorEstorno = caixa.temEstorno ? (caixa.valorEstorno || 0) : 0; //

            const acertoCaixa = (valorTotalVenda - (credito + debito + pix + cashless) - valorEstorno); //
            const diferenca = dinheiroFisico - acertoCaixa; //

            // Usa o protocolo que JÁ ESTÁ no objeto 'caixa' (Ex: CXF-ABCDE-1)
            const caixaProtocol = caixa.protocol || `${closing.protocol || 'CXF-ERR'}-${index + 1}`; // Fallback
            console.log(`[syncService][formatCashierForApi] CXF Index ${index + 1}: Usando protocolo "${caixaProtocol}" para payload.`); //


            return {
                protocol: caixaProtocol, // <-- Usa o protocolo indexado
                timestamp: baseTimestamp, //
                type: 'Fixo', //
                cpf: caixa.cpf || '', //
                cashierName: caixa.cashierName || '', //
                numeroMaquina: caixa.numeroMaquina || '', //
                valorTotalVenda: valorTotalVenda, //
                credito: credito, //
                debito: debito, //
                pix: pix, //
                cashless: cashless, //
                // Troco vem do objeto principal 'closing' para o primeiro caixa
                valorTroco: index === 0 ? (closing.valorTroco || 0) : 0, //
                valorEstorno: valorEstorno, //
                dinheiroFisico: dinheiroFisico, //
                valorAcerto: acertoCaixa, //
                diferenca: diferenca, //
                operatorName: baseOperatorName //
            };
        });
    }
    // --- CAIXA MÓVEL ---
    // Verifica o type no objeto principal 'closing'
    else if (closing.type === 'cashier') { //
        // O protocolo já é [Prefix]-[5 Digits], ex: CXM-FGHIJ
         const valorTotalVenda = closing.valorTotalVenda || 0; //
         const credito = closing.credito || 0; //
         const debito = closing.debito || 0; //
         const pix = closing.pix || 0; //
         const cashless = closing.cashless || 0; //
         const dinheiroFisico = closing.dinheiroFisico || 0; //
         const valorEstorno = closing.temEstorno ? (closing.valorEstorno || 0) : 0; //
         const valorTroco = closing.valorTroco || 0; //
         // Usa o valorAcerto/diferenca salvos se existirem, senão recalcula
         const valorAcerto = closing.valorAcerto ?? (valorTotalVenda - (credito + debito + pix + cashless) - valorEstorno + valorTroco); //
         const diferenca = closing.diferenca ?? (dinheiroFisico - valorAcerto); //
         const caixaProtocol = closing.protocol || ''; // Fallback
         console.log(`[syncService][formatCashierForApi] CXM: Usando protocolo "${caixaProtocol}" para payload.`); //

        return [{
            protocol: caixaProtocol, //
            timestamp: baseTimestamp, //
            type: 'Móvel', //
            cpf: closing.cpf || '', //
            cashierName: closing.cashierName || '', //
            numeroMaquina: closing.numeroMaquina || '', //
            valorTotalVenda: valorTotalVenda, //
            credito: credito, //
            debito: debito, //
            pix: pix, //
            cashless: cashless, //
            valorTroco: valorTroco, //
            valorEstorno: valorEstorno, //
            dinheiroFisico: dinheiroFisico, //
            valorAcerto: valorAcerto, //
            diferenca: diferenca, //
            operatorName: baseOperatorName //
        }];
    }
    // Fallback para tipos desconhecidos ou dados corrompidos
    else {
        console.warn("[syncService][formatCashierForApi] Tipo de fechamento desconhecido ou inválido:", closing?.type, closing?.protocol); //
        return []; // Retorna array vazio para não enviar dados inválidos
    }
};