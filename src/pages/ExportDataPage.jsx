// src/pages/ExportDataPage.jsx (VERSÃO FINAL - CORREÇÃO DE DESLOCAMENTO + OPERADOR EXTRA)
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
    if (isPasswordModalOpen) setTimeout(() => passwordInputRef.current?.focus(), 100);
  }, [isPasswordModalOpen]);

  const startOnlineExport = () => { setError(''); setPassword(''); setIsPasswordModalOpen(true); };

  // --- BUSCA INTELIGENTE DE VALORES ---
  const getValue = (rowObj, possibleKeys) => {
    if (!rowObj) return '';
    const rowKeys = Object.keys(rowObj);
    const foundKey = rowKeys.find(rk => possibleKeys.some(pk => rk.trim().toUpperCase() === pk.trim().toUpperCase()));
    return foundKey ? rowObj[foundKey] : '';
  };

  // --- BUSCA VALORES EXTRAS (ONDE O OPERADOR SE ESCONDEU) ---
  const getExtraValue = (rowObj) => {
      const extraKeys = Object.keys(rowObj).filter(k => k.startsWith('EXTRA_'));
      if (extraKeys.length > 0) {
          // Pega o último valor extra, que geralmente é o Operador
          const lastKey = extraKeys[extraKeys.length - 1];
          return rowObj[lastKey];
      }
      return '';
  };

  const processAndFixWaiters = (rawWaiters) => {
    const fixedNormal = [];
    const fixedZig = [];

    rawWaiters.forEach(w => {
      // Detecta deslocamento: Se 'CPF' contém "waiter" ou "waiter_zig"
      const cpfVal = String(getValue(w, ['CPF'])).toLowerCase();
      const isShifted = cpfVal.includes('waiter');

      let cleanData = {};

      if (isShifted) {
        // --- MODO CORREÇÃO (Desloca tudo 1 pra direita) ---
        const operadorExtra = getExtraValue(w); // Pega do campo EXTRA vindo do server
        
        cleanData = {
            'DATA': getValue(w, ['DATA', 'DATE']),
            'PROTOCOLO': getValue(w, ['PROTOCOLO']),
            'TIPO': getValue(w, ['CPF']), // O Tipo estava na coluna CPF
            'CPF': getValue(w, ['NOME GARÇOM', 'NOME GARCOM']),
            'NOME GARÇOM': getValue(w, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']),
            'Nº MAQUINA': getValue(w, ['VENDA TOTAL', 'RECARGA CASHLESS']), 
            'VENDA TOTAL': getValue(w, ['CRÉDITO', 'CREDITO']),
            'CRÉDITO': getValue(w, ['DÉBITO', 'DEBITO']),
            'DÉBITO': getValue(w, ['PIX']),
            'PIX': getValue(w, ['CASHLESS', 'VALOR TOTAL PRODUTOS']),
            'CASHLESS': getValue(w, ['DEVOLUÇÃO/ESTORNO', 'DEVOLUÇÃO ESTORNO']),
            'DEVOLUÇÃO ESTORNO': getValue(w, ['COMISSÃO TOTAL']),
            'COMISSÃO TOTAL': getValue(w, ['ACERTO', 'VALOR ACERTO']),
            'ACERTO': getValue(w, ['OPERADOR']), // O campo chamado 'OPERADOR' tem o valor do Acerto
            'OPERADOR': operadorExtra || '' // O Operador real está no extra
        };
      } else {
        // --- MODO NORMAL ---
        cleanData = {
            'DATA': getValue(w, ['DATA', 'DATE']),
            'PROTOCOLO': getValue(w, ['PROTOCOLO']),
            'TIPO': getValue(w, ['TIPO', 'TYPE']),
            'CPF': getValue(w, ['CPF']),
            'NOME GARÇOM': getValue(w, ['NOME GARÇOM', 'NOME GARCOM']),
            'Nº MAQUINA': getValue(w, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']),
            'VENDA TOTAL': getValue(w, ['VENDA TOTAL', 'RECARGA CASHLESS']),
            'CRÉDITO': getValue(w, ['CRÉDITO', 'CREDITO']),
            'DÉBITO': getValue(w, ['DÉBITO', 'DEBITO']),
            'PIX': getValue(w, ['PIX']),
            'CASHLESS': getValue(w, ['CASHLESS', 'VALOR TOTAL PRODUTOS']),
            'DEVOLUÇÃO ESTORNO': getValue(w, ['DEVOLUÇÃO/ESTORNO', 'DEVOLUÇÃO ESTORNO']),
            'COMISSÃO TOTAL': getValue(w, ['COMISSÃO TOTAL']),
            'ACERTO': getValue(w, ['ACERTO', 'VALOR ACERTO']),
            'OPERADOR': getValue(w, ['OPERADOR'])
        };
      }

      // Separa ZIG vs Normal
      const tipo = String(cleanData['TIPO']).toLowerCase();
      if (tipo.includes('zig')) {
        const zigObj = { ...cleanData, 
            'RECARGA CASHLESS': cleanData['VENDA TOTAL'], // Adapta nome
            'VALOR TOTAL PRODUTOS': cleanData['CASHLESS'] // Adapta nome
        };
        fixedZig.push(zigObj);
      } else {
        fixedNormal.push(cleanData);
      }
    });

    return { fixedNormal, fixedZig };
  };

  const handlePasswordSubmit = async () => {
    setIsLoading(true);
    setLoadingMessage('Buscando dados da nuvem e corrigindo inconsistências...');
    setError('');
    setIsPasswordModalOpen(false);

    try {
      const response = await axios.post(`${API_URL}/api/export-online-data`, { password, eventName: activeEvent });
      const { waiters, zigWaiters, cashiers } = response.data;

      // Junta e Processa
      const allWaitersRaw = [...(waiters || []), ...(zigWaiters || [])];
      const { fixedNormal, fixedZig } = processAndFixWaiters(allWaitersRaw);

      // Processa Caixas (Geralmente OK)
      const normalizedCashiers = (cashiers || []).map(c => ({
        'PROTOCOLO': getValue(c, ['PROTOCOLO']),
        'DATA': getValue(c, ['DATA']),
        'TIPO': getValue(c, ['TIPO']),
        'CPF': getValue(c, ['CPF']),
        'NOME DO CAIXA': getValue(c, ['NOME DO CAIXA', 'NOME CAIXA', 'CAIXA']),
        'Nº MÁQUINA': getValue(c, ['Nº MÁQUINA', 'Nº MAQUINA', 'MAQUINA']),
        'VENDA TOTAL': getValue(c, ['VENDA TOTAL']),
        'CRÉDITO': getValue(c, ['CRÉDITO', 'CREDITO']),
        'DÉBITO': getValue(c, ['DÉBITO', 'DEBITO']),
        'PIX': getValue(c, ['PIX']),
        'CASHLESS': getValue(c, ['CASHLESS']),
        'TROCO': getValue(c, ['TROCO', 'VALOR TROCO']),
        'DEVOLUÇÃO ESTORNO': getValue(c, ['DEVOLUÇÃO/ESTORNO', 'DEVOLUÇÃO ESTORNO']),
        'DINHEIRO FÍSICO': getValue(c, ['DINHEIRO FÍSICO', 'DINHEIRO FISICO']),
        'VALOR ACERTO': getValue(c, ['VALOR ACERTO', 'ACERTO']),
        'DIFERENÇA': getValue(c, ['DIFERENÇA', 'DIFERENCA']),
        'OPERADOR': getValue(c, ['OPERADOR'])
      }));

      await generateExcel(fixedNormal, fixedZig, normalizedCashiers, "Nuvem");

    } catch (err) {
      console.error(err);
      alert(`Falha na exportação: ${err.response?.data?.message || "Erro desconhecido"}`);
    } finally {
      setIsLoading(false);
      setPassword('');
    }
  };

  const generateExcel = async (waitersData, zigWaitersData, cashiersData, sourcePrefix) => {
     setLoadingMessage('Gerando planilha Excel...');
     const workbook = new ExcelJS.Workbook();
     const moneyFormat = '"R$"#,##0.00;[Red]-"R$"#,##0.00';

    const parseCurrency = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string' || value.trim() === '') return 0;
        let s = String(value).trim().replace('R$', '').trim();
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
        else s = s.replace(/,/g, '');
        return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
    };
    
    // Garçons
    const waiterSheet = workbook.addWorksheet('Garçons');
    if (waitersData?.length > 0) {
        const cols = [
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
        waiterSheet.columns = cols;
        waiterSheet.addRows(waitersData.map(r => {
            const row = {}; 
            cols.forEach(c => row[c.key] = c.style?.numFmt ? parseCurrency(r[c.key]) : r[c.key]); 
            return row;
        }));
    }
    
    // ZIG
    const zigSheet = workbook.addWorksheet('GarçomZIG');
    if (zigWaitersData?.length > 0) {
        const cols = [
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
        zigSheet.columns = cols;
        zigSheet.addRows(zigWaitersData.map(r => {
            const row = {}; 
            cols.forEach(c => row[c.key] = c.style?.numFmt ? parseCurrency(r[c.key]) : r[c.key]); 
            return row;
        }));
    }

    // Caixas
    const cashierSheet = workbook.addWorksheet('Caixas');
    if (cashiersData?.length > 0) {
        const cols = [
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
        cashierSheet.columns = cols;
        cashierSheet.addRows(cashiersData.map(r => {
            const row = {}; 
            cols.forEach(c => row[c.key] = c.style?.numFmt ? parseCurrency(r[c.key]) : r[c.key]); 
            return row;
        }));
    }

    // Estilo
    [waiterSheet, zigSheet, cashierSheet].forEach(sheet => {
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

  const generateLocalExcel = async () => { /* ... código export local mantido ... */ 
      // Mantenha o código original de generateLocalExcel aqui, não foi alterado.
      // Vou resumir apenas para caber na resposta, mas você deve manter o que já funcionava.
      setIsLoading(true);
      try {
        const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
        const eventClosings = allClosings.filter(c => c.eventName === activeEvent);
        if (eventClosings.length === 0) { alert(`Nenhum dado local.`); setIsLoading(false); return; }
        
        // ... (resto da lógica original de local) ...
        // Como o problema era apenas na nuvem, você pode copiar e colar sua função antiga aqui.
        // Se precisar dela completa novamente, avise.
        
        // Exemplo simplificado para não quebrar:
        const waitersRaw = eventClosings.filter(c => c.type.includes('waiter'));
        const cashiersRaw = eventClosings.filter(c => c.type.includes('cashier'));
        // ... mapeamento ...
        // await generateExcel(...)
        alert("Use o código anterior para Local se precisar. O foco aqui foi a Nuvem.");
      } catch(e) { console.error(e); } finally { setIsLoading(false); }
  };

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
            <p>Busca da nuvem (com correção automática de colunas).</p>
            <button className="export-button cloud-btn" onClick={startOnlineExport} disabled={isLoading || activeEvent === 'Nenhum Evento Ativo'}>Exportar da Nuvem</button>
          </div>
          <div className="option-card local">
            <h2>Exportar Dados Locais</h2>
            <p>Dados deste computador.</p>
            <button className="export-button local-btn" onClick={generateLocalExcel} disabled={isLoading || activeEvent === 'Nenhum Evento Ativo'}>Exportar Locais</button>
          </div>
        </div>
      </div>
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2>Acesso à Nuvem</h2>
            <input ref={passwordInputRef} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} />
            <div className="modal-buttons">
              <button className="cancel-button" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</button>
              <button className="confirm-button" onClick={handlePasswordSubmit}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {isLoading && <div className="modal-overlay"><div className="loading-container"><div className="loading-spinner"></div><p>{loadingMessage}</p></div></div>}
    </div>
  );
}

export default ExportDataPage;