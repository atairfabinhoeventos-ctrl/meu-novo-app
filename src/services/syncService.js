// src/services/syncService.js (VERSÃO FINAL, COMPLETA E CORRIGIDA)
import axios from 'axios';
import { API_URL } from '../config';

/**
 * Tenta enviar um único registro de fechamento para a nuvem em segundo plano.
 * Esta função foi projetada para não bloquear a UI e ser "fire-and-forget".
 * @param {object} closingData O objeto completo do fechamento salvo localmente.
 */
export const attemptBackgroundSync = async (closingData) => {
  // Se não houver dados ou um nome de evento, interrompe a execução.
  if (!closingData || !closingData.eventName) {
    console.warn('[BackgroundSync] Dados de fechamento inválidos para sync.');
    return;
  }

  // Determina se o fechamento é de um garçom ou de um caixa.
  const isWaiter = closingData.type === 'waiter';

  // Monta o payload (corpo da requisição) no formato que a API espera.
  const payload = {
    eventName: closingData.eventName,
    waiterData: isWaiter ? [formatWaiterForApi(closingData)] : [],
    cashierData: !isWaiter ? formatCashierForApi(closingData) : [],
  };

  try {
    console.log('[BackgroundSync] Tentando enviar protocolo em segundo plano:', closingData.protocol);
    await axios.post(`${API_URL}/api/cloud-sync`, payload);
    console.log('[BackgroundSync] Sucesso! Protocolo', closingData.protocol, 'enviado para a nuvem.');

  } catch (error) {
    // A falha aqui é esperada se o aplicativo estiver offline. Apenas registramos no console.
    // O registro permanecerá salvo localmente e será enviado no próximo sync manual.
    console.warn('[BackgroundSync] Falha ao enviar protocolo:', closingData.protocol, '. Verifique a conexão. O registro está salvo localmente.');
  }
};

/**
 * Formata os dados de um fechamento de GARÇOM para o formato exato que a API espera.
 * @param {object} c O objeto de fechamento do garçom.
 * @returns {object} O objeto formatado para a API.
 */
const formatWaiterForApi = (c) => ({
  timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
  protocol: c.protocol,
  // --- PONTO CRÍTICO DA CORREÇÃO ---
  // Garante que o CPF seja incluído no payload.
  cpf: c.cpf,
  waiterName: c.waiterName,
  numeroMaquina: c.numeroMaquina,
  valorTotal: c.valorTotal,
  credito: c.credito,
  debito: c.debito,
  pix: c.pix,
  cashless: c.cashless,
  valorEstorno: c.temEstorno ? c.valorEstorno : 0,
  comissaoTotal: c.comissaoTotal,
  acerto: c.diferencaLabel === 'Pagar ao Garçom' ? -c.diferencaPagarReceber : c.diferencaPagarReceber,
  operatorName: c.operatorName,
});

/**
 * Formata os dados de um fechamento de CAIXA (móvel ou fixo) para o formato da API.
 * @param {object} closing O objeto de fechamento do caixa.
 * @returns {Array} Um array de objetos de caixa formatados.
 */
const formatCashierForApi = (closing) => {
    // Se for um fechamento de Caixa Fixo (grupo), ele terá um array 'caixas'.
    if (Array.isArray(closing.caixas)) {
        return closing.caixas.map((caixa, index) => {
            const acertoCaixa = (caixa.valorTotalVenda - (caixa.credito + caixa.debito + caixa.pix + caixa.cashless) - (caixa.temEstorno ? caixa.valorEstorno : 0));
            return { 
                protocol: `${closing.protocol}-${index}`, 
                timestamp: new Date(closing.timestamp).toLocaleString('pt-BR'), 
                type: 'Fixo', 
                cpf: caixa.cpf, 
                cashierName: caixa.cashierName, 
                numeroMaquina: caixa.numeroMaquina, 
                valorTotalVenda: caixa.valorTotalVenda, 
                credito: caixa.credito, 
                debito: caixa.debito, 
                pix: caixa.pix, 
                cashless: caixa.cashless, 
                valorTroco: closing.valorTroco, 
                valorEstorno: caixa.temEstorno ? caixa.valorEstorno : 0, 
                dinheiroFisico: caixa.dinheiroFisico, 
                valorAcerto: acertoCaixa, 
                diferenca: caixa.dinheiroFisico - acertoCaixa, 
                operatorName: closing.operatorName 
            };
        });
    } else {
        // Se for um Caixa Móvel, trata como um único item em um array.
        return [{ 
            protocol: closing.protocol, 
            timestamp: new Date(closing.timestamp).toLocaleString('pt-BR'), 
            type: 'Móvel', 
            cpf: closing.cpf, 
            cashierName: closing.cashierName, 
            numeroMaquina: closing.numeroMaquina, 
            valorTotalVenda: closing.valorTotalVenda, 
            credito: closing.credito, 
            debito: closing.debito, 
            pix: closing.pix, 
            cashless: closing.cashless, 
            valorTroco: closing.valorTroco, 
            valorEstorno: closing.temEstorno ? closing.valorEstorno : 0, 
            dinheiroFisico: closing.dinheiroFisico, 
            valorAcerto: closing.valorAcerto, 
            diferenca: closing.diferenca, 
            operatorName: closing.operatorName 
        }];
    }
};