// src/pages/ExportDataPage.jsx (CORRIGIDO: DATA EXCEL SERIAL NUMBER)
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

  const getValue = (rowObj, possibleKeys) => {
    if (!rowObj) return '';
    const rowKeys = Object.keys(rowObj);
    const foundKey = rowKeys.find(rk => possibleKeys.some(pk => rk.trim().toUpperCase() === pk.trim().toUpperCase()));
    return foundKey ? rowObj[foundKey] : '';
  };

  const getExtraValue = (rowObj) => {
      const extraKeys = Object.keys(rowObj).filter(k => k.startsWith('EXTRA_'));
      if (extraKeys.length > 0) {
          const lastKey = extraKeys[extraKeys.length - 1];
          return rowObj[lastKey];
      }
      return '';
  };

  const processAndFixWaiters = (rawWaiters) => {
    const fixedNormal = [];
    const fixedZig = [];

    rawWaiters.forEach(w => {
      const cpfVal = String(getValue(w, ['CPF'])).toLowerCase();
      const isShifted = cpfVal.includes('waiter');

      let cleanData = {};

      if (isShifted) {
        const operadorExtra = getExtraValue(w); 
        cleanData = {
            'DATA': getValue(w, ['DATA', 'DATE']),
            'PROTOCOLO': getValue(w, ['PROTOCOLO']),
            'TIPO': getValue(w, ['CPF']),
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
            'ACERTO': getValue(w, ['OPERADOR']),
            'OPERADOR': operadorExtra || ''
        };
      } else {
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

      const tipo = String(cleanData['TIPO']).toLowerCase();
      if (tipo.includes('zig')) {
        const zigObj = { ...cleanData, 
            'RECARGA CASHLESS': cleanData['VENDA TOTAL'], 
            'VALOR TOTAL PRODUTOS': cleanData['CASHLESS'] 
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
    setLoadingMessage('Buscando dados da nuvem e formatando relatório...');
    setError('');
    setIsPasswordModalOpen(false);

    try {
      const response = await axios.post(`${API_URL}/api/export-online-data`, { password, eventName: activeEvent });
      const { waiters, zigWaiters, cashiers } = response.data;

      const allWaitersRaw = [...(waiters || []), ...(zigWaiters || [])];
      const { fixedNormal, fixedZig } = processAndFixWaiters(allWaitersRaw);

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
     
     // Formato de Moeda Contábil Brasileiro
     const moneyFormat = '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-@_-';
     // Formato de Data e Hora
     const dateTimeFormat = 'dd/mm/yyyy hh:mm:ss';

    const parseCurrency = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string' || value.trim() === '') return 0;
        let s = String(value).trim().replace('R$', '').trim();
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(/,/g, '.');
        else s = s.replace(/,/g, '');
        return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
    };
    
    // --- FUNÇÃO CORRIGIDA PARA DATA DO EXCEL ---
    const parseDate = (val) => {
        if (!val) return null;

        // Se for um número, assumimos que é um Serial Number do Excel (Dias desde 1900)
        // O Excel inicia em 30/12/1899. O JS inicia em 01/01/1970. Diferença: 25569 dias.
        // Multiplica-se por 86400 (segundos no dia) e 1000 (ms).
        if (typeof val === 'number') {
            // (Serial - 25569) * 86400 * 1000
            // Adicionamos + 1 segundo ou fração para compensar arredondamentos de ponto flutuante
             const utc_days  = Math.floor(val - 25569);
             const utc_value = utc_days * 86400;
             const date_info = new Date(utc_value * 1000);

             // A parte decimal do serial é a hora
             const fractional_day = val - Math.floor(val) + 0.0000001;
             const total_seconds_in_day = Math.floor(86400 * fractional_day);
             const seconds = total_seconds_in_day % 60;
             const minutes = Math.floor(total_seconds_in_day / 60) % 60;
             const hours   = Math.floor(total_seconds_in_day / 3600);

             date_info.setUTCHours(hours, minutes, seconds);
             return date_info;
        }

        // Se for string, tentamos o parse normal
        let d = new Date(val);
        
        if (isNaN(d.getTime())) {
            // Tenta formato DD/MM/YYYY HH:mm:ss
            const parts = String(val).split(/[\s/:-]/);
            if (parts.length >= 3) {
                 const day = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1;
                 const year = parseInt(parts[2], 10);
                 const hour = parseInt(parts[3] || 0, 10);
                 const min = parseInt(parts[4] || 0, 10);
                 const sec = parseInt(parts[5] || 0, 10);
                 d = new Date(year, month, day, hour, min, sec);
            }
        } else {
             // Se vier com Z (UTC) do backend e queremos mostrar a hora local que foi registrada
             if (String(val).endsWith('Z')) {
                 d.setHours(d.getHours() - 3); 
             }
        }
        
        return isNaN(d.getTime()) ? val : d;
    };
    
    // --- 1. GARÇONS ---
    const waiterSheet = workbook.addWorksheet('Garçons');
    if (waitersData?.length > 0) {
        const cols = [
          { header: 'Data', key: 'DATA', width: 22, style: { numFmt: dateTimeFormat } },
          { header: 'Protocolo', key: 'PROTOCOLO', width: 25 },
          { header: 'Tipo', key: 'TIPO', width: 12 },
          { header: 'CPF', key: 'CPF', width: 18 },
          { header: 'Nome Garçom', key: 'NOME GARÇOM', width: 30 },
          { header: 'Nº Maquina', key: 'Nº MAQUINA', width: 15, style: { alignment: { horizontal: 'center' } } },
          { header: 'Venda Total', key: 'VENDA TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Devolução/Estorno', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Venda 8%', key: 'VENDA 8%', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Venda 4%', key: 'VENDA 4%', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Comissão Total', key: 'COMISSÃO TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Crédito', key: 'CRÉDITO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Débito', key: 'DÉBITO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Pix', key: 'PIX', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Cashless', key: 'CASHLESS', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Acerto', key: 'ACERTO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Operador', key: 'OPERADOR', width: 25 },
        ];
        waiterSheet.columns = cols;
        
        waiterSheet.addRows(waitersData.map(r => {
            const row = {}; 
            const valVendaTotal = parseCurrency(r['VENDA TOTAL']);
            const valCashless = parseCurrency(r['CASHLESS']);

            r['VENDA 8%'] = valVendaTotal - valCashless;
            r['VENDA 4%'] = valCashless;

            cols.forEach(c => {
                let val = r[c.key];
                if (c.key === 'DATA') { val = parseDate(val); } 
                else if (c.style?.numFmt) { val = parseCurrency(val); }
                row[c.key] = val;
            }); 
            return row;
        }));
    }
    
    // --- 2. ZIG ---
    const zigSheet = workbook.addWorksheet('GarçomZIG');
    if (zigWaitersData?.length > 0) {
        const cols = [
          { header: 'Data', key: 'DATA', width: 22, style: { numFmt: dateTimeFormat } },
          { header: 'Protocolo', key: 'PROTOCOLO', width: 25 },
          { header: 'Tipo', key: 'TIPO', width: 12 },
          { header: 'CPF', key: 'CPF', width: 18 },
          { header: 'Nome Garçom', key: 'NOME GARÇOM', width: 30 },
          { header: 'Nº Maquina', key: 'Nº MAQUINA', width: 15, style: { alignment: { horizontal: 'center' } } }, 
          { header: 'Recarga Cashless', key: 'RECARGA CASHLESS', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Crédito', key: 'CRÉDITO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Débito', key: 'DÉBITO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Pix', key: 'PIX', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Valor Total Produtos', key: 'VALOR TOTAL PRODUTOS', width: 22, style: { numFmt: moneyFormat } },
          { header: 'Devolução/Estorno', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Comissão Total', key: 'COMISSÃO TOTAL', width: 20, style: { numFmt: moneyFormat } },
          { header: 'Acerto', key: 'ACERTO', width: 18, style: { numFmt: moneyFormat } },
          { header: 'Operador', key: 'OPERADOR', width: 25 },
        ];
        zigSheet.columns = cols;
        zigSheet.addRows(zigWaitersData.map(r => {
            const row = {}; 
            cols.forEach(c => {
                 let val = r[c.key];
                 if (c.key === 'DATA') val = parseDate(val);
                 else if (c.style?.numFmt) val = parseCurrency(val);
                 row[c.key] = val;
            });
            return row;
        }));
    }

    // --- 3. CAIXAS ---
    const cashierSheet = workbook.addWorksheet('Caixas');
    if (cashiersData?.length > 0) {
        const cols = [
            { header: 'PROTOCOLO', key: 'PROTOCOLO', width: 25 },
            { header: 'DATA', key: 'DATA', width: 22, style: { numFmt: dateTimeFormat } },
            { header: 'TIPO', key: 'TIPO', width: 10 },
            { header: 'CPF', key: 'CPF', width: 18 },
            { header: 'NOME DO CAIXA', key: 'NOME DO CAIXA', width: 30 },
            { header: 'Nº MÁQUINA', key: 'Nº MÁQUINA', width: 15, style: { alignment: { horizontal: 'center' } } },
            { header: 'VENDA TOTAL', key: 'VENDA TOTAL', width: 20, style: { numFmt: moneyFormat } },
            { header: 'CRÉDITO', key: 'CRÉDITO', width: 18, style: { numFmt: moneyFormat } },
            { header: 'DÉBITO', key: 'DÉBITO', width: 18, style: { numFmt: moneyFormat } },
            { header: 'PIX', key: 'PIX', width: 18, style: { numFmt: moneyFormat } },
            { header: 'CASHLESS', key: 'CASHLESS', width: 18, style: { numFmt: moneyFormat } },
            { header: 'TROCO', key: 'TROCO', width: 18, style: { numFmt: moneyFormat } },
            { header: 'DEVOLUÇÃO ESTORNO', key: 'DEVOLUÇÃO ESTORNO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'DINHEIRO FÍSICO', key: 'DINHEIRO FÍSICO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'VALOR ACERTO', key: 'VALOR ACERTO', width: 20, style: { numFmt: moneyFormat } },
            { header: 'DIFERENÇA', key: 'DIFERENÇA', width: 18, style: { numFmt: moneyFormat } },
            { header: 'OPERADOR', key: 'OPERADOR', width: 25 },
        ];
        cashierSheet.columns = cols;
        cashierSheet.addRows(cashiersData.map(r => {
            const row = {}; 
            cols.forEach(c => {
                 let val = r[c.key];
                 if (c.key === 'DATA') val = parseDate(val);
                 else if (c.style?.numFmt) val = parseCurrency(val);
                 row[c.key] = val;
            });
            return row;
        }));
    }

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

  const generateLocalExcel = async () => {
      setIsLoading(true);
      try {
        const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
        const eventClosings = allClosings.filter(c => c.eventName === activeEvent);
        if (eventClosings.length === 0) { alert(`Nenhum dado local.`); setIsLoading(false); return; }
        
        const waitersData = eventClosings.filter(c => c.type.includes('waiter') && c.type !== 'waiter_zig').map(c => ({
             'DATA': c.timestamp, 'PROTOCOLO': c.protocol, 'TIPO': c.type, 'CPF': c.cpf,
             'NOME GARÇOM': c.waiterName, 'Nº MAQUINA': c.numeroMaquina, 
             'VENDA TOTAL': c.valorTotal, 'CRÉDITO': c.credito, 'DÉBITO': c.debito, 
             'PIX': c.pix, 'CASHLESS': c.cashless, 'DEVOLUÇÃO ESTORNO': c.valorEstorno, 
             'COMISSÃO TOTAL': c.comissaoTotal, 'ACERTO': c.diferencaPagarReceber, 'OPERADOR': c.operatorName
        }));

        const zigData = eventClosings.filter(c => c.type === 'waiter_zig').map(c => ({
             'DATA': c.timestamp, 'PROTOCOLO': c.protocol, 'TIPO': 'waiter_zig', 'CPF': c.cpf,
             'NOME GARÇOM': c.waiterName, 'Nº MAQUINA': c.numeroMaquina,
             'RECARGA CASHLESS': c.valorTotal, 'CRÉDITO': c.credito, 'DÉBITO': c.debito,
             'PIX': c.pix, 'VALOR TOTAL PRODUTOS': c.valorTotalProdutos, 
             'DEVOLUÇÃO ESTORNO': c.valorEstorno, 'COMISSÃO TOTAL': c.comissaoTotal, 
             'ACERTO': c.diferencaPagarReceber, 'OPERADOR': c.operatorName
        }));

        const cashiersData = []; 
        eventClosings.filter(c => c.type.includes('cashier')).forEach(c => {
             if(c.caixas) {
                 c.caixas.forEach((cx, idx) => {
                     cashiersData.push({
                        'PROTOCOLO': cx.protocol || `${c.protocol}-${idx+1}`,
                        'DATA': c.timestamp, 'TIPO': 'Fix', 'CPF': cx.cpf, 'NOME DO CAIXA': cx.cashierName,
                        'Nº MÁQUINA': cx.numeroMaquina, 'VENDA TOTAL': cx.valorTotalVenda,
                        'CRÉDITO': cx.credito, 'DÉBITO': cx.debito, 'PIX': cx.pix, 'CASHLESS': cx.cashless,
                        'TROCO': cx.valorTroco, 'DEVOLUÇÃO ESTORNO': cx.valorEstorno, 
                        'DINHEIRO FÍSICO': cx.dinheiroFisico, 'VALOR ACERTO': 0, 'DIFERENÇA': 0, 'OPERADOR': c.operatorName
                     });
                 });
             } else {
                 cashiersData.push({
                    'PROTOCOLO': c.protocol, 'DATA': c.timestamp, 'TIPO': 'Mobile', 'CPF': c.cpf, 
                    'NOME DO CAIXA': c.cashierName, 'Nº MÁQUINA': c.numeroMaquina, 
                    'VENDA TOTAL': c.valorTotalVenda, 'CRÉDITO': c.credito, 'DÉBITO': c.debito, 
                    'PIX': c.pix, 'CASHLESS': c.cashless, 'TROCO': c.valorTroco, 
                    'DEVOLUÇÃO ESTORNO': c.valorEstorno, 'DINHEIRO FÍSICO': c.dinheiroFisico, 
                    'VALOR ACERTO': c.valorAcerto, 'DIFERENÇA': c.diferenca, 'OPERADOR': c.operatorName
                 });
             }
        });

        await generateExcel(waitersData, zigData, cashiersData, "Local");

      } catch(e) { console.error(e); alert('Erro ao exportar local.'); } 
      finally { setIsLoading(false); }
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