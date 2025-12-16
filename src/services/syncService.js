// src/services/syncService.js (VERSÃO FINAL: TIPOS EXPLICITOS + RECÁLCULO)
import axios from 'axios';
import { API_URL } from '../config';

const SYNC_INTERVAL = 60000;

export const backgroundDownloadMasterData = async () => {
    try {
        console.log('[BackgroundSync] Buscando atualizações de Garçons e Eventos...');
        const response = await axios.get(`${API_URL}/api/sync/master-data`);
        const { waiters, events } = response.data;

        if (waiters && Array.isArray(waiters)) {
            localStorage.setItem('master_waiters', JSON.stringify(waiters));
        }

        if (events && Array.isArray(events)) {
            localStorage.setItem('master_events', JSON.stringify(events));
        }

    } catch (error) {
        console.warn('[BackgroundSync] Não foi possível baixar dados mestre.');
    }
};

export const attemptBackgroundSyncNewPersonnel = async (newPersonnel) => {
    try {
        const payload = newPersonnel.cpf ? { waiters: [newPersonnel] } : { events: [newPersonnel] };
        await axios.post(`${API_URL}/api/update-base`, payload);
        console.log('[BackgroundSync] Novo cadastro enviado.');
    } catch (error) {
        console.error('[BackgroundSync] Falha ao enviar novo cadastro:', error);
    }
};

export const retryPendingUploads = async () => {
    try {
        const localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
        const activeEvent = localStorage.getItem('activeEvent');

        if (!activeEvent || localClosings.length === 0) return;

        const pendingItems = localClosings.filter(c => 
            c.eventName === activeEvent && c.synced !== true
        );

        if (pendingItems.length === 0) {
            window.dispatchEvent(new Event('localDataChanged'));
            return;
        }

        console.log(`[BackgroundUpload] Enviando ${pendingItems.length} itens...`);

        // MAPEAMENTO DE GARÇONS
        const waiterData = pendingItems
            .filter(c => c.type && c.type.startsWith('waiter'))
            .map(c => {
                const vTotal = Number(c.valorTotal || 0);
                const vEstorno = c.temEstorno ? Number(c.valorEstorno || 0) : 0;
                const vCashless = Number(c.cashless || 0);
                
                let valComissao8 = Number(c.comissao8 || 0);
                let valComissao10 = Number(c.comissao10 || 0);
                let valComissao4 = Number(c.comissao4 || 0);
                
                // --- DEFINIÇÃO DO TIPO (STRING) ---
                let displayType = 'Garçom 8%'; 
                if (c.type === 'waiter_zig') {
                    displayType = 'Garçom ZIG';
                } else if (c.subType === '10_percent') {
                    displayType = 'Garçom 10%';
                } else {
                    displayType = 'Garçom 8%';
                }
                // ----------------------------------
                
                // Recálculo
                if (valComissao8 === 0 && valComissao10 === 0 && valComissao4 === 0) {
                    const vendaLiquida = (vTotal - vEstorno) - vCashless;
                    valComissao4 = vCashless * 0.04;
                    
                    if (c.subType === '10_percent') {
                        valComissao10 = vendaLiquida * 0.10;
                    } else {
                        valComissao8 = vendaLiquida * 0.08;
                    }
                }

                return {
                    type: displayType, // Envia o texto correto
                    timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
                    protocol: c.protocol,
                    cpf: c.cpf,
                    waiterName: c.waiterName,
                    numeroMaquina: c.numeroMaquina,
                    
                    valorTotal: vTotal,
                    credito: Number(c.credito || 0),
                    debito: Number(c.debito || 0),
                    pix: Number(c.pix || 0),
                    cashless: vCashless,
                    valorTotalProdutos: Number(c.valorTotalProdutos || 0),
                    valorEstorno: vEstorno,
                    
                    comissao8: valComissao8,
                    comissao10: valComissao10,
                    comissao4: valComissao4,
                    comissaoTotal: Number(c.comissaoTotal || (valComissao8 + valComissao10 + valComissao4)),
                    
                    diferencaLabel: c.diferencaLabel,
                    diferencaPagarReceber: Number(c.diferencaPagarReceber || 0),
                    operatorName: c.operatorName
                };
            });

        // MAPEAMENTO DE CAIXAS (Sem alterações)
        const cashierData = pendingItems
            .filter(c => c.type === 'cashier' || Array.isArray(c.caixas))
            .flatMap(c => {
                if (Array.isArray(c.caixas)) {
                    return c.caixas.map((caixa, index) => {
                        const acertoCaixa = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                        const diferencaCaixa = (caixa.dinheiroFisico || 0) - acertoCaixa;
                        return {
                            protocol: caixa.protocol || `${c.protocol}-${index + 1}`,
                            timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
                            type: 'Fixo',
                            cpf: caixa.cpf, cashierName: caixa.cashierName, numeroMaquina: caixa.numeroMaquina,
                            valorTotalVenda: Number(caixa.valorTotalVenda || 0), credito: Number(caixa.credito || 0), debito: Number(caixa.debito || 0), pix: Number(caixa.pix || 0), cashless: Number(caixa.cashless || 0),
                            valorTroco: index === 0 ? Number(c.valorTroco || 0) : 0, valorEstorno: (caixa.temEstorno ? Number(caixa.valorEstorno) : 0), dinheiroFisico: Number(caixa.dinheiroFisico || 0),
                            valorAcerto: Number(acertoCaixa), diferenca: Number(diferencaCaixa), operatorName: c.operatorName
                        };
                    });
                } else {
                    return [{
                        protocol: c.protocol, timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), type: 'Móvel',
                        cpf: c.cpf, cashierName: c.cashierName, numeroMaquina: c.numeroMaquina,
                        valorTotalVenda: Number(c.valorTotalVenda || 0), credito: Number(c.credito || 0), debito: Number(c.debito || 0), pix: Number(c.pix || 0), cashless: Number(c.cashless || 0),
                        valorTroco: Number(c.valorTroco || 0), valorEstorno: (c.temEstorno ? Number(c.valorEstorno) : 0), dinheiroFisico: Number(c.dinheiroFisico || 0),
                        valorAcerto: Number(c.valorAcerto || 0), diferenca: Number(c.diferenca || 0), operatorName: c.operatorName
                    }];
                }
            });

        // ENVIO
        const response = await axios.post(`${API_URL}/api/cloud-sync`, {
            eventName: activeEvent,
            waiterData,
            cashierData
        });

        if (response.status === 200) {
            console.log('[BackgroundUpload] Sucesso:', response.data);
            const protocolsSynced = new Set([...waiterData.map(w => w.protocol), ...cashierData.map(c => c.protocol)]);
            
            const updatedLocalClosings = localClosings.map(closing => {
                if (closing.eventName === activeEvent) {
                    if (closing.type.startsWith('waiter') || closing.type === 'cashier') {
                        if (protocolsSynced.has(closing.protocol)) closing.synced = true;
                    } else if (closing.type === 'fixed_cashier') {
                        const subProtocols = closing.caixas.map((caixa, index) => caixa.protocol || `${closing.protocol}-${index + 1}`);
                        if (subProtocols.some(p => protocolsSynced.has(p))) closing.synced = true;
                    }
                }
                return closing;
            });
            localStorage.setItem('localClosings', JSON.stringify(updatedLocalClosings));
            window.dispatchEvent(new Event('localDataChanged'));
        }

    } catch (error) {
        console.error('[BackgroundUpload] ERRO ao enviar dados:', error.response?.data || error.message);
    }
};

export const startBackgroundSync = () => {
    backgroundDownloadMasterData();
    retryPendingUploads();
    return setInterval(() => {
        backgroundDownloadMasterData();
        retryPendingUploads();
    }, SYNC_INTERVAL);
};