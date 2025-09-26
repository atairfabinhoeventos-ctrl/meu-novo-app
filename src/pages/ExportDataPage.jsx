// src/pages/ExportDataPage.jsx (Corrigido para ler a nova estrutura de eventos)

import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import '../App.css';

function ExportDataPage() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [waiterClosings, setWaiterClosings] = useState([]);
  const [cashierClosings, setCashierClosings] = useState([]);

  useEffect(() => {
    // --- ALTERAÇÃO AQUI ---
    // Carrega a lista de objetos de evento e filtra para pegar apenas os ativos
    const allEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const activeEvents = allEvents.filter(event => event.active);
    setEvents(activeEvents);
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      const eventClosings = allClosings.filter(c => c.eventName === selectedEvent);
      setWaiterClosings(eventClosings.filter(c => c.waiterName));
      setCashierClosings(eventClosings.filter(c => c.cashierName || c.caixas));
    } else {
      setWaiterClosings([]);
      setCashierClosings([]);
    }
  }, [selectedEvent]);

  const handleGenerateWaiterExcel = async () => { /* ... (código inalterado) ... */
    if (waiterClosings.length === 0) {
      alert('Nenhum fechamento de garçom para exportar para este evento.');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fechamentos Garçons");
    const header = ["NOME GARÇOM", "VALOR VENDA TOTAL", "DEVOLUÇÃO ESTORNO", "VALOR TOTAL PARA ACERTO", "VALOR DE VENDA 8%", "COMISSÃO 8%", "VALOR DE VENDA 4%", "COMISSÃO 4%", "COMISSÃO TOTAL 8% E 4%", "VALOR A ACERTAR COM O GARÇOM", "CRÉDITO", "DÉBITO", "PIX", "CASHLESS", "PIX LECIR", "DINHEIRO", "TOTAL", "Nº DA MÁQUINA", "NOME DO EVENTO", "OPERADOR", "DATA E HORA DO REGISTRO"];
    const headerRow = worksheet.addRow(header);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    waiterClosings.forEach(closing => {
      const valorTotal = closing.valorTotal || 0;
      const estorno = closing.temEstorno ? (closing.valorEstorno || 0) : 0;
      const cashless = closing.cashless || 0;
      const credito = closing.credito || 0;
      const debito = closing.debito || 0;
      const pix = closing.pix || 0;
      const comissaoTotal = closing.comissaoTotal || 0;
      const valorTotalParaAcerto = valorTotal - estorno;
      const valorVenda8 = valorTotalParaAcerto - cashless;
      const comissao8 = valorVenda8 * 0.08;
      const valorVenda4 = cashless;
      const comissao4 = valorVenda4 * 0.04;
      const valorAAcertarComGarcom = valorTotalParaAcerto - comissaoTotal;
      const dinheiro = valorTotalParaAcerto - (credito + debito + pix + cashless);
      const totalFinal = valorTotalParaAcerto - comissaoTotal;
      const rowData = [closing.waiterName, valorTotal, estorno, valorTotalParaAcerto, valorVenda8, comissao8, valorVenda4, comissao4, comissaoTotal, valorAAcertarComGarcom, credito, debito, pix, cashless, null, dinheiro, totalFinal, closing.numeroMaquina, closing.eventName, closing.operatorName, new Date(closing.timestamp).toLocaleString('pt-BR')];
      const dataRow = worksheet.addRow(rowData);
      for(let i = 2; i <= 17; i++) { dataRow.getCell(i).numFmt = 'R$ #,##0.00'; }
    });
    worksheet.columns.forEach(column => { column.width = 18; });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Relatorio_Garçons_${selectedEvent.replace(/ /g, '_')}.xlsx`);
  };

  const handleGenerateCashierExcel = async () => { /* ... (código inalterado) ... */
    if (cashierClosings.length === 0) {
      alert('Nenhum fechamento de caixa para exportar para este evento.');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fechamentos Caixas");
    const header = ["EVENTO", "PROTOCOLO", "DATA", "TIPO", "CPF", "NOME DO CAIXA", "Nº MÁQUINA", "RECEBEU TROCO", "VALOR TROCO", "TEVE ESTORNO", "VALOR ESTORNO", "VENDA TOTAL", "CRÉDITO", "DÉBITO", "PIX", "CASHLESS", "DINHEIRO FÍSICO", "VALOR ACERTO", "DIFERENÇA", "OPERADOR"];
    const headerRow = worksheet.addRow(header);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E63B8' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    cashierClosings.forEach(closing => {
      if (closing.caixas && Array.isArray(closing.caixas)) {
        closing.caixas.forEach(caixa => {
          const rowData = [closing.eventName, closing.protocol, new Date(closing.timestamp).toLocaleString('pt-BR'), 'Fixo (Grupo)', caixa.cpf, caixa.cashierName, caixa.numeroMaquina, closing.valorTroco > 0 ? 'SIM' : 'NÃO', closing.valorTroco, caixa.temEstorno ? 'SIM' : 'NÃO', caixa.valorEstorno, caixa.valorTotalVenda, caixa.credito, caixa.debito, caixa.pix, caixa.cashless, caixa.dinheiroFisico, null, null, closing.operatorName];
          const dataRow = worksheet.addRow(rowData);
          [8, 9, 10, 11, 12, 13, 14, 15, 16].forEach(colIdx => { dataRow.getCell(colIdx).numFmt = 'R$ #,##0.00'; });
        });
      } else {
        const rowData = [closing.eventName, closing.protocol, new Date(closing.timestamp).toLocaleString('pt-BR'), 'Móvel', closing.cpf, closing.cashierName, closing.numeroMaquina, closing.temTroco ? 'SIM' : 'NÃO', closing.valorTroco, closing.temEstorno ? 'SIM' : 'NÃO', closing.valorEstorno, closing.valorTotalVenda, closing.credito, closing.debito, closing.pix, closing.cashless, closing.dinheiroFisico, closing.valorAcerto, closing.diferenca, closing.operatorName];
        const dataRow = worksheet.addRow(rowData);
        [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].forEach(colIdx => { dataRow.getCell(colIdx).numFmt = 'R$ #,##0.00'; });
      }
    });
    worksheet.columns.forEach(column => { column.width = 18; });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Relatorio_Caixas_${selectedEvent.replace(/ /g, '_')}.xlsx`);
  };

  return (
    <div className="app-container">
      <div className="login-form form-scrollable" style={{maxWidth: '900px'}}>
        <h1>Exportar Dados Salvos</h1>
        
        <div className="form-section">
          <div className="input-group">
            <label>1. Selecione o Evento</label>
            <select className="select-input" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}>
              <option value="">-- Escolha um evento --</option>
              {/* --- ALTERAÇÃO AQUI --- */}
              {/* Agora acessamos event.name para a chave, valor e texto da opção */}
              {events.map(event => 
                <option key={event.name} value={event.name}>{event.name}</option>
              )}
            </select>
          </div>
        </div>

        {selectedEvent && (
          <>
            <div className="form-section">
                <h2>Relatório de Garçons</h2>
                <p>Encontrados <strong>{waiterClosings.length}</strong> registros de garçons salvos localmente.</p>
                <button className="login-button" style={{backgroundColor: '#5cb85c', marginTop: '20px'}} onClick={handleGenerateWaiterExcel} disabled={waiterClosings.length === 0}>
                  Gerar Planilha de Garçons (.xlsx)
                </button>
            </div>
            <div className="form-section">
                <h2>Relatório de Caixas</h2>
                <p>Encontrados <strong>{cashierClosings.length}</strong> registros de caixas salvos localmente.</p>
                <button 
                  className="login-button" 
                  style={{backgroundColor: '#5bc0de', marginTop: '20px'}} 
                  onClick={handleGenerateCashierExcel} 
                  disabled={cashierClosings.length === 0}
                >
                  Gerar Planilha de Caixas (.xlsx)
                </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ExportDataPage;