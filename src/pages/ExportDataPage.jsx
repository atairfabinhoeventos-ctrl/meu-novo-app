// src/pages/ExportDataPage.jsx (VERSÃO ATUALIZADA PARA 3 ABAS)
import React, { useState, useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import axios from 'axios';
import { API_URL } from '../config';
import './ExportDataPage.css';

function ExportDataPage() {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const passwordInputRef = useRef(null);

  const activeEvent = localStorage.getItem('activeEvent') || 'Nenhum Evento Ativo';

  useEffect(() => {
    if (isPasswordModalOpen) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isPasswordModalOpen]);


  const startOnlineExport = () => {
    setError('');
    setPassword('');
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
    setIsLoading(true);
    setLoadingMessage('Buscando dados da nuvem para o evento atual...');
    setError('');
    setIsPasswordModalOpen(false);

    try {
      const response = await axios.post(`${API_URL}/api/export-online-data`, { 
        password,
        eventName: activeEvent 
      });
      
      // --- MUDANÇA AQUI ---
      // Agora espera 3 arrays do backend
      const { waiters, zigWaiters, cashiers } = response.data;
      await generateExcel(waiters, zigWaiters, cashiers, "Nuvem"); // Passa 3 arrays
      // --- FIM DA MUDANÇA ---

    } catch (err) {
      const message = err.response?.data?.message || "Erro de comunicação com o servidor.";
      alert(`Falha na exportação: ${message}`);
    } finally {
      setIsLoading(false);
      setPassword('');
    }
  };
  
  // --- FUNÇÃO DE GERAR EXCEL (UNIFICADA) ---
  // Esta função agora gera o Excel para AMBAS as fontes (Local e Online)
  const generateExcel = async (waitersData, zigWaitersData, cashiersData, sourcePrefix) => {
     setLoadingMessage('Gerando planilha Excel...');
     const workbook = new ExcelJS.Workbook();
     const moneyFormat = '"R$"#,##0.00;[Red]-"R$"#,##0.00';

    // Helper para converter strings (ex: "R$ 1.234,56" ou números)
    const parseCurrency = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string' || value.trim() === '') return 0;
        let stringValue = String(value).trim();
        if (stringValue.toUpperCase().startsWith('R$')) {
            stringValue = stringValue.substring(2).trim();
        }
        const lastPointIndex = stringValue.lastIndexOf('.');
        const lastCommaIndex = stringValue.lastIndexOf(',');
        if (lastCommaIndex > lastPointIndex) {
            stringValue = stringValue.replace(/\./g, '');
            stringValue = stringValue.replace(/,/g, '.');
        } else if (lastPointIndex > lastCommaIndex) {
             stringValue = stringValue.replace(/,/g, '');
        }
        stringValue = stringValue.replace(/[^0-9.]/g, '');
        const numberValue = parseFloat(stringValue);
        return isNaN(numberValue) ? 0 : numberValue;
    };
    
    // --- Aba de Garçons (8% e 10%) ---
    const waiterSheet = workbook.addWorksheet('Garçons');
    if (waitersData && waitersData.length > 0) {
        // Define as colunas (baseado no server.js)
        const waiterColumns = [
          { header: 'Data', key: 'DATA', width: 20 },
          { header: 'Protocolo', key: 'PROTOCOLO', width: 30 },
          { header: 'Tipo', key: 'TIPO', width: 15 },
          { header: 'CPF', key: 'CPF', width: 20 },
          { header: 'Nome Garçom', key: 'NOME GARÇOM', width: 30 },
          { header: 'Nº Maquina', key: 'Nº MAQUINA', width: 15 }, 
          { header: 'Venda Total', key: 'VENDA TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Crédito', key: 'CRÉDITO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Débito', key: 'DÉBITO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Pix', key: 'PIX', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Cashless', key: 'CASHLESS', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Devolução/Estorno', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Comissão Total', key: 'COMISSÃO TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Acerto', key: 'ACERTO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Operador', key: 'OPERADOR', width: 25 },
        ];
        waiterSheet.columns = waiterColumns;
        
        // Adiciona as linhas, convertendo valores de moeda
        waiterSheet.addRows(waitersData.map(row => {
          const newRow = {};
          waiterColumns.forEach(col => {
              const key = col.key;
              if (col.style?.numFmt) {
                  newRow[key] = parseCurrency(row[key]);
              } else {
                  newRow[key] = row[key];
              }
          });
          return newRow;
        }));
    }
    
    // --- (NOVA) Aba de Garçom ZIG ---
    const zigSheet = workbook.addWorksheet('GarçomZIG');
    if (zigWaitersData && zigWaitersData.length > 0) {
        // Define as colunas (baseado no server.js)
        const zigColumns = [
          { header: 'Data', key: 'DATA', width: 20 },
          { header: 'Protocolo', key: 'PROTOCOLO', width: 30 },
          { header: 'Tipo', key: 'TIPO', width: 15 },
          { header: 'CPF', key: 'CPF', width: 20 },
          { header: 'Nome Garçom', key: 'NOME GARÇOM', width: 30 },
          { header: 'Nº Maquina', key: 'Nº MAQUINA', width: 15 }, 
          { header: 'Recarga Cashless', key: 'RECARGA CASHLESS', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Crédito', key: 'CRÉDITO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Débito', key: 'DÉBITO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Pix', key: 'PIX', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Valor Total Produtos', key: 'VALOR TOTAL PRODUTOS', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Devolução/Estorno', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Comissão Total', key: 'COMISSÃO TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Acerto', key: 'ACERTO', width: 15, style: { numFmt: moneyFormat } },
          { header: 'Operador', key: 'OPERADOR', width: 25 },
        ];
        zigSheet.columns = zigColumns;
        
        // Adiciona as linhas, convertendo valores de moeda
        zigSheet.addRows(zigWaitersData.map(row => {
          const newRow = {};
          zigColumns.forEach(col => {
              const key = col.key;
              if (col.style?.numFmt) {
                  newRow[key] = parseCurrency(row[key]);
              } else {
                  newRow[key] = row[key];
              }
          });
          return newRow;
        }));
    }

    // --- Aba de Caixas (Sem alteração) ---
    const cashierSheet = workbook.addWorksheet('Caixas');
    if (cashiersData && cashiersData.length > 0) {
        const cashierColumns = [
            { header: 'PROTOCOLO', key: 'PROTOCOLO', width: 30 },
            { header: 'DATA', key: 'DATA', width: 20 },
            { header: 'TIPO', key: 'TIPO', width: 10 },
            { header: 'CPF', key: 'CPF', width: 20 },
            { header: 'NOME DO CAIXA', key: 'NOME DO CAIXA', width: 30 },
            { header: 'Nº MÁQUINA', key: 'Nº MÁQUINA', width: 15 },
            { header: 'VENDA TOTAL', key: 'VENDA TOTAL', width: 20, style: { numFmt: moneyFormat } },
            { header: 'CRÉDITO', key: 'CRÉDITO', width: 15, style: { numFmt: moneyFormat } },
            { header: 'DÉBITO', key: 'DÉBITO', width: 15, style: { numFmt: moneyFormat } },
            { header: 'PIX', key: 'PIX', width: 15, style: { numFmt: moneyFormat } },
            { header: 'CASHLESS', key: 'CASHLESS', width: 15, style: { numFmt: moneyFormat } },
            { header: 'TROCO', key: 'TROCO', width: 15, style: { numFmt: moneyFormat } },
            { header: 'DEVOLUÇÃO ESTORNO', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'DINHEIRO FÍSICO', key: 'DINHEIRO FÍSICO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'VALOR ACERTO', key: 'VALOR ACERTO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'DIFERENÇA', key: 'DIFERENÇA', width: 15, style: { numFmt: moneyFormat } },
            { header: 'OPERADOR', key: 'OPERADOR', width: 25 },
        ];
        cashierSheet.columns = cashierColumns;
        cashierSheet.addRows(cashiersData.map(row => {
          const newRow = {};
          cashierColumns.forEach(col => {
              const key = col.key;
              if (col.style?.numFmt) {
                  newRow[key] = parseCurrency(row[key]);
              } else {
                  newRow[key] = row[key];
              }
          });
          return newRow;
        }));
    }

    // Estiliza o cabeçalho
    [waiterSheet, zigSheet, cashierSheet].forEach(sheet => { // Adicionado zigSheet
        if (sheet.rowCount > 0) {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'FF1E63B8'} };
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    saveAs(blob, `Relatorio_${sourcePrefix}_${activeEvent.replace(/ /g, '_')}_${dateStr}.xlsx`);
  };
  // --- FIM DA FUNÇÃO UNIFICADA ---


  // --- MUDANÇA AQUI (Exportação Local) ---
  const generateLocalExcel = async () => {
    setIsLoading(true);
    setLoadingMessage('Gerando planilha com dados locais...');
    try {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allClosings.filter(c => c.eventName === activeEvent);
      
      if (eventClosings.length === 0) {
        alert(`Nenhum fechamento local encontrado para o evento "${activeEvent}".`);
        setIsLoading(false);
        return;
      }
      
      // --- Filtra em 3 grupos ---
      const waitersRaw = eventClosings.filter(c => c.type === 'waiter' || c.type === 'waiter_10');
      const zigRaw = eventClosings.filter(c => c.type === 'waiter_zig');
      const cashiersRaw = eventClosings.filter(c => c.type === 'cashier' || c.type === 'fixed_cashier');
      
      // Mapeia Garçons (8/10)
      const waitersData = waitersRaw.map(c => ({
        'DATA': new Date(c.timestamp).toLocaleString('pt-BR'),
        'PROTOCOLO': c.protocol,
        'TIPO': c.type,
        'CPF': c.cpf,
        'NOME GARÇOM': c.waiterName,
        'Nº MAQUINA': c.numeroMaquina,
        'VENDA TOTAL': c.valorTotal,
        'CRÉDITO': c.credito || 0,
        'DÉBITO': c.debito || 0,
        'PIX': c.pix || 0,
        'CASHLESS': c.cashless || 0,
        'DEVOLUÇÃO ESTORNO': c.valorEstorno || 0,
        'COMISSÃO TOTAL': c.comissaoTotal,
        'ACERTO': c.diferencaLabel === 'Pagar ao Garçom' ? -Math.abs(c.diferencaPagarReceber) : Math.abs(c.diferencaPagarReceber),
        'OPERADOR': c.operatorName
      }));
      
      // Mapeia Garçons ZIG
      const zigData = zigRaw.map(c => ({
        'DATA': new Date(c.timestamp).toLocaleString('pt-BR'),
        'PROTOCOLO': c.protocol,
        'TIPO': c.type,
        'CPF': c.cpf,
        'NOME GARÇOM': c.waiterName,
        'Nº MAQUINA': c.numeroMaquina,
        'RECARGA CASHLESS': c.valorTotal, // valorTotal é a Recarga
        'CRÉDITO': c.credito || 0,
        'DÉBITO': c.debito || 0,
        'PIX': c.pix || 0,
        'VALOR TOTAL PRODUTOS': c.valorTotalProdutos || 0, // Novo campo
        'DEVOLUÇÃO ESTORNO': c.valorEstorno || 0,
        'COMISSÃO TOTAL': c.comissaoTotal,
        'ACERTO': c.diferencaLabel === 'Pagar ao Garçom' ? -Math.abs(c.diferencaPagarReceber) : Math.abs(c.diferencaPagarReceber),
        'OPERADOR': c.operatorName
      }));

      // Mapeia Caixas (Desmembrando grupos)
      const cashiersData = cashiersRaw.flatMap(c => {
            if (c.type === 'fixed_cashier' && Array.isArray(c.caixas)) {
                return c.caixas.map((caixa, index) => {
                    const acertoCaixa = (caixa.valorTotalVenda || 0) - ((caixa.credito || 0) + (caixa.debito || 0) + (caixa.pix || 0) + (caixa.cashless || 0)) - (caixa.temEstorno ? (caixa.valorEstorno || 0) : 0);
                    const diferencaCaixa = (caixa.dinheiroFisico || 0) - acertoCaixa;
                    return {
                        'PROTOCOLO': caixa.protocol || `${c.protocol}-${index + 1}`,
                        'DATA': new Date(c.timestamp).toLocaleString('pt-BR'),
                        'TIPO': 'Fixo', 'CPF': caixa.cpf, 'NOME DO CAIXA': caixa.cashierName,
                        'Nº MÁQUINA': caixa.numeroMaquina, 'VENDA TOTAL': caixa.valorTotalVenda || 0,
                        'CRÉDITO': caixa.credito || 0, 'DÉBITO': caixa.debito || 0,
                        'PIX': caixa.pix || 0, 'CASHLESS': caixa.cashless || 0,
                        'TROCO': index === 0 ? (c.valorTroco || 0) : 0,
                        'DEVOLUÇÃO ESTORNO': (caixa.temEstorno ? caixa.valorEstorno : 0) || 0,
                        'DINHEIRO FÍSICO': caixa.dinheiroFisico || 0,
                        'VALOR ACERTO': acertoCaixa, 'DIFERENÇA': diferencaCaixa,
                        'OPERADOR': c.operatorName
                    };
                });
            } else if (c.type === 'cashier') {
                return [{
                    'PROTOCOLO': c.protocol, 'DATA': new Date(c.timestamp).toLocaleString('pt-BR'),
                    'TIPO': 'Móvel', 'CPF': c.cpf, 'NOME DO CAIXA': c.cashierName,
                    'Nº MÁQUINA': c.numeroMaquina, 'VENDA TOTAL': c.valorTotalVenda || 0,
                    'CRÉDITO': c.credito || 0, 'DÉBITO': c.debito || 0,
                    'PIX': c.pix || 0, 'CASHLESS': c.cashless || 0,
                    'TROCO': c.valorTroco || 0,
                    'DEVOLUÇÃO ESTORNO': (c.temEstorno ? c.valorEstorno : 0) || 0,
                    'DINHEIRO FÍSICO': c.dinheiroFisico || 0,
                    'VALOR ACERTO': c.valorAcerto || 0, 'DIFERENÇA': c.diferenca || 0,
                    'OPERADOR': c.operatorName
                }];
            }
            return [];
        });

      // Chama a função unificada de geração de Excel
      await generateExcel(waitersData, zigData, cashiersData, "Local");

    } catch (err) {
      console.error("Erro ao gerar a planilha local:", err);
      alert("Ocorreu um erro ao gerar a planilha local.");
    } finally {
      setIsLoading(false);
    }
  };
  // --- FIM DA MUDANÇA (Exportação Local) ---

  return (
    <div className="export-container export-page-wrapper">
      <div className="export-card">
        <h1>📤 Central de Exportação</h1>
        <p className="menu-subtitle" style={{textAlign: 'center', marginBottom: '30px'}}>
            Gerando relatórios para o evento: <strong>{activeEvent}</strong>
        </p>
        
        <div className="export-options">
          <div className="option-card cloud">
            <h2>Exportar da Nuvem</h2>
            <p>Busca todos os fechamentos do evento <strong>{activeEvent}</strong> na planilha online e gera um arquivo.</p>
            <button className="export-button cloud-btn" onClick={startOnlineExport} disabled={isLoading || activeEvent === 'Nenhum Evento Ativo'}>
              Exportar da Nuvem
            </button>
          </div>

          <div className="option-card local">
            <h2>Exportar Dados Locais</h2>
            <p>Gera uma planilha com os fechamentos do evento <strong>{activeEvent}</strong> salvos neste computador.</p>
            <button className="export-button local-btn" onClick={generateLocalExcel} disabled={isLoading || activeEvent === 'Nenhum Evento Ativo'}>
              Exportar Locais
            </button>
          </div>
        </div>
      </div>

      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2>Acesso à Nuvem</h2>
            <p>Digite a senha para buscar os dados online.</p>
            <div className="input-group">
              <input 
                ref={passwordInputRef}
                type="password" 
                placeholder="Senha de acesso" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            <div className="modal-buttons">
              <button className="cancel-button" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</button>
              <button className="confirm-button" onClick={handlePasswordSubmit}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
         <div className="modal-overlay">
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{loadingMessage}</p>
            </div>
        </div>
      )}
    </div>
  );
}

export default ExportDataPage;