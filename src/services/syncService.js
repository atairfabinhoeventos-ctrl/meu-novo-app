// src/services/syncService.js (VERSÃO DEFINITIVA: MATEMÁTICA DE GRUPO 100% EXATA NO 1º CAIXA)
import axios from 'axios';
import { API_URL, APP_VERSION } from '../config'; 

// Intervalo de checagem automática (a cada 30 segundos)
const SYNC_INTERVAL = 30000;

export const backgroundDownloadMasterData = async () => {
    try {
        console.log('[BackgroundSync] Buscando atualizações do servidor...');
        const response = await axios.get(`${API_URL}/api/sync/master-data`);
        
        // ADICIONAMOS O "credentials" AQUI EMBAIXO
        const { waiters, events, receiptRoles, credentials } = response.data;

        if (waiters && Array.isArray(waiters)) {
            const garconsFormatados = waiters.map(w => ({
                nome: w.name || w.nome || '',
                name: w.name || w.nome || '',
                cpf: w.cpf || '',
                pix: w.pix || '',
                tipo_pix: w.tipo_pix || '',
                telefone: w.telefone || ''
            })).filter(w => w.name !== '');
            localStorage.setItem('master_waiters', JSON.stringify(garconsFormatados));
        }

        if (events && Array.isArray(events)) {
            localStorage.setItem('master_events', JSON.stringify(events));
        }

        if (receiptRoles && Array.isArray(receiptRoles)) {
            localStorage.setItem('master_receipt_roles', JSON.stringify(receiptRoles));
        }

        // --- NOVO: SALVANDO A LISTA DE CREDENCIADOS DO MONGODB ---
        if (credentials && Array.isArray(credentials)) {
            localStorage.setItem('master_credentials', JSON.stringify(credentials));
        }

        console.log('[BackgroundSync] Sincronização de dados mestre concluída.');
    } catch (error) {
        console.warn('[BackgroundSync] Erro ao sincronizar dados mestre.', error.message);
    }
};

export const attemptBackgroundSyncNewPersonnel = async (newPersonnel) => {
    try {
        const payload = newPersonnel.cpf ? { waiters: [newPersonnel] } : { events: [newPersonnel] };
        await axios.post(`${API_URL}/api/update-base`, payload);
        console.log('[BackgroundSync] Novo cadastro avulso enviado para a nuvem.');
    } catch (error) {
        console.error('[BackgroundSync] Falha ao enviar novo cadastro:', error.message);
    }
};

export const retryPendingUploads = async () => {
    try {
        // 1. Checa se o navegador relata que tem internet antes de tentar
        if (!navigator.onLine) {
            console.log('[BackgroundUpload] Sem conexão. Aguardando internet...');
            return;
        }

        const localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
        const activeEvent = localStorage.getItem('activeEvent');

        if (!activeEvent || localClosings.length === 0) return;

        // 2. Filtra os itens que AINDA NÃO FORAM ENVIADOS para a nuvem
        const pendingItems = localClosings.filter(c => 
            c.eventName === activeEvent && c.synced !== true
        );

        if (pendingItems.length === 0) {
            return; // Tudo já foi enviado
        }

        console.log(`[BackgroundUpload] Iniciando envio automático de ${pendingItems.length} itens...`);

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
                
                let displayType = 'Garçom 8%'; 
                if (c.type === 'waiter_zig') { displayType = 'Garçom ZIG'; } 
                else if (c.subType === '10_percent') { displayType = 'Garçom 10%'; } 
                else { displayType = 'Garçom 8%'; }
                
                if (valComissao8 === 0 && valComissao10 === 0 && valComissao4 === 0) {
                    const vendaLiquida = (vTotal - vEstorno) - vCashless;
                    valComissao4 = vCashless * 0.04;
                    if (c.subType === '10_percent') { valComissao10 = vendaLiquida * 0.10; } 
                    else { valComissao8 = vendaLiquida * 0.08; }
                }

                return {
                    type: displayType,
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
                    operatorName: c.operatorName,
                    
                    appVersion: APP_VERSION || '1.0' 
                };
            });

        // MAPEAMENTO DE CAIXAS (FIXO E MÓVEL)
        const cashierData = pendingItems
            .filter(c => c.type === 'cashier' || c.type === 'fixed_cashier' || Array.isArray(c.caixas))
            .flatMap(c => {
                if (Array.isArray(c.caixas)) {
                    // ==========================================
                    // CAIXA FIXO (CÁLCULO ESTRATÉGICO NO CAIXA 1)
                    // ==========================================
                    const valorTrocoGrupo = Number(c.valorTroco || 0);
                    const diferencaTotalDoGrupo = Number(c.diferencaCaixa || 0);

                    return c.caixas.map((caixa, index) => {
                        // Acerto puro da máquina (sem troco)
                        const acertoBaseDaMaquina = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                        
                        let acertoParaNuvem = acertoBaseDaMaquina;
                        let diferencaParaNuvem = 0;
                        let dinheiroFisicoParaNuvem = acertoBaseDaMaquina; // Por padrão, os demais não têm diferença. O Físico iguala o Acerto.

                        if (index === 0) {
                            // CAIXA 1: Absorve o troco de fundo e a diferença inteira do grupo
                            acertoParaNuvem = acertoBaseDaMaquina + valorTrocoGrupo;
                            diferencaParaNuvem = diferencaTotalDoGrupo;
                            dinheiroFisicoParaNuvem = acertoParaNuvem + diferencaTotalDoGrupo;
                        }

                        return {
                            protocol: caixa.protocol || `${c.protocol}-${index + 1}`,
                            groupProtocol: c.protocol, // Vincula o id do grupo para histórico
                            timestamp: new Date(c.timestamp || Date.now()).toLocaleString('pt-BR'),
                            type: 'Fixo',
                            cpf: caixa.cpf, 
                            cashierName: caixa.cashierName || caixa.name, 
                            numeroMaquina: caixa.numeroMaquina,
                            
                            valorTotalVenda: Number(caixa.valorTotalVenda || 0), 
                            credito: Number(caixa.credito || 0), 
                            debito: Number(caixa.debito || 0), 
                            pix: Number(caixa.pix || 0), 
                            cashless: Number(caixa.cashless || 0),
                            valorEstorno: (caixa.temEstorno ? Number(caixa.valorEstorno) : 0), 
                            
                            // Valores Financeiros Calculados:
                            valorTroco: index === 0 ? valorTrocoGrupo : 0, 
                            dinheiroFisico: Number(dinheiroFisicoParaNuvem.toFixed(2)),
                            valorAcerto: Number(acertoParaNuvem.toFixed(2)), 
                            diferenca: Number(diferencaParaNuvem.toFixed(2)), 
                            
                            operatorName: c.operatorName,
                            appVersion: APP_VERSION || '1.0'
                        };
                    });
                } else {
                    // ==========================================
                    // CAIXA MÓVEL
                    // ==========================================
                    return [{
                        protocol: c.protocol, timestamp: new Date(c.timestamp).toLocaleString('pt-BR'), type: 'Móvel',
                        cpf: c.cpf, cashierName: c.cashierName, numeroMaquina: c.numeroMaquina,
                        valorTotalVenda: Number(c.valorTotalVenda || 0), credito: Number(c.credito || 0), debito: Number(c.debito || 0), pix: Number(c.pix || 0), cashless: Number(c.cashless || 0),
                        valorTroco: Number(c.valorTroco || 0), valorEstorno: (c.temEstorno ? Number(c.valorEstorno) : 0), dinheiroFisico: Number(c.dinheiroFisico || 0),
                        valorAcerto: Number(c.valorAcerto || 0), diferenca: Number(c.diferenca || 0), operatorName: c.operatorName,
                        appVersion: APP_VERSION || '1.0' 
                    }];
                }
            });

        // ENVIO AUTOMÁTICO PARA A NUVEM
        const response = await axios.post(`${API_URL}/api/cloud-sync`, {
            eventName: activeEvent,
            waiterData,
            cashierData
        });

        if (response.status === 200) {
            console.log('[BackgroundUpload] Upload automático concluído com sucesso!');
            
            // Marca os itens como enviados no LocalStorage
            const protocolsSynced = new Set([...waiterData.map(w => w.protocol), ...cashierData.map(c => c.protocol), ...cashierData.map(c => c.groupProtocol)]);
            
            const updatedLocalClosings = localClosings.map(closing => {
                if (closing.eventName === activeEvent) {
                    if (protocolsSynced.has(closing.protocol)) {
                        closing.synced = true;
                    }
                }
                return closing;
            });
            
            localStorage.setItem('localClosings', JSON.stringify(updatedLocalClosings));
            // Avisa o sistema (como a página de Histórico) que os dados mudaram para ela atualizar a tela sozinha
            window.dispatchEvent(new Event('localDataChanged'));
        }

    } catch (error) {
        console.error('[BackgroundUpload] ERRO no auto-sync:', error.message);
    }
};

// MOTOR DE SINCRONIZAÇÃO INVISÍVEL
export const startBackgroundSync = () => {
    // Roda a primeira vez assim que inicia
    backgroundDownloadMasterData();
    retryPendingUploads();
    
    // Configura o ouvinte para a internet voltando (Online Event)
    window.addEventListener('online', () => {
        console.log("🌐 Conexão restaurada! Disparando envio para nuvem...");
        retryPendingUploads();
    });

    // Mantém rodando em background (Polling)
    return setInterval(() => {
        retryPendingUploads();
        backgroundDownloadMasterData();
    }, SYNC_INTERVAL);
};