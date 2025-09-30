import React, { useState } from 'react';
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

  const activeEvent = localStorage.getItem('activeEvent') || 'Nenhum Evento Ativo';

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
      // ALTERADO: Envia o nome do evento ativo para o backend
      const response = await axios.post(`${API_URL}/api/export-online-data`, { 
        password,
        eventName: activeEvent 
      });
      await generateOnlineExcel(response.data.waiters, response.data.cashiers);
    } catch (err) {
      const message = err.response?.data?.message || "Erro de comunicação com o servidor.";
      alert(`Falha na exportação: ${message}`);
    } finally {
      setIsLoading(false);
      setPassword('');
    }
  };
  
  const generateOnlineExcel = async (waitersData, cashiersData) => {
     setLoadingMessage('Gerando planilha Excel...');
     const workbook = new ExcelJS.Workbook();
     
    // --- Aba de Garçons ---
    const waiterSheet = workbook.addWorksheet('Garçons');
    if (waitersData.length > 0) {
        const waiterHeaders = Object.keys(waitersData[0]);
        waiterSheet.columns = waiterHeaders.map(key => ({ header: key, key, width: 25 }));
        waiterSheet.addRows(waitersData);
    }
    
    // --- Aba de Caixas ---
    const cashierSheet = workbook.addWorksheet('Caixas');
    if (cashiersData.length > 0) {
        const cashierHeaders = Object.keys(cashiersData[0]);
        cashierSheet.columns = cashierHeaders.map(key => ({ header: key, key, width: 25 }));
        cashierSheet.addRows(cashiersData);
    }

    [waiterSheet, cashierSheet].forEach(sheet => {
        if (sheet.rowCount > 0) {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'FF1E63B8'} };
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    saveAs(blob, `Relatorio_Nuvem_${activeEvent.replace(/ /g, '_')}_${dateStr}.xlsx`);
  };

  const generateLocalExcel = async () => {
    setIsLoading(true);
    setLoadingMessage('Gerando planilha com dados locais...');
    try {
      const allClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      
      // ALTERADO: Filtra os fechamentos apenas para o evento ativo
      const eventClosings = allClosings.filter(c => c.eventName === activeEvent);
      
      if (eventClosings.length === 0) {
        alert(`Nenhum fechamento local encontrado para o evento "${activeEvent}".`);
        setIsLoading(false);
        return;
      }
      
      const workbook = new ExcelJS.Workbook();
      // ... (A lógica de geração da planilha continua a mesma, mas agora usa 'eventClosings')
      // Exemplo para aba de garçons:
      const waiterSheet = workbook.addWorksheet('Garçons');
      waiterSheet.columns = [
        { header: 'Protocolo', key: 'protocol', width: 25 }, { header: 'Data', key: 'timestamp', width: 20 },
        { header: 'Garçom', key: 'waiterName', width: 30 }, { header: 'Venda Total', key: 'valorTotal', width: 15, style: { numFmt: '"R$"#,##0.00' } },
        { header: 'Comissão Total', key: 'comissaoTotal', width: 18, style: { numFmt: '"R$"#,##0.00' } },
        { header: 'Acerto (Receber/Pagar)', key: 'acerto', width: 25, style: { numFmt: '"R$"#,##0.00' } },
        { header: 'Operador', key: 'operatorName', width: 25 },
      ];
      
      const waiterData = eventClosings.filter(c => c.type === 'waiter');
      waiterData.forEach(c => {
        waiterSheet.addRow({
          ...c,
          timestamp: new Date(c.timestamp).toLocaleString('pt-BR'),
          acerto: c.diferencaLabel === 'Pagar ao Garçom' ? -c.diferencaPagarReceber : c.diferencaPagarReceber,
        });
      });
      // ... (Adicionar lógica semelhante para a aba de Caixas)

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      saveAs(blob, `Relatorio_Local_${activeEvent.replace(/ /g, '_')}_${dateStr}.xlsx`);

    } catch (err) {
      console.error("Erro ao gerar a planilha local:", err);
      alert("Ocorreu um erro ao gerar a planilha local.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="export-container">
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
              <input type="password" placeholder="Senha de acesso" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} autoFocus />
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