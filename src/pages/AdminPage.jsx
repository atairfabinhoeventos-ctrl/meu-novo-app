// src/pages/AdminPage.jsx (Novo Arquivo)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';
import './AdminPage.css'; // Precisaremos criar este CSS

function AdminPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setReconciliationResult(null); // Limpa resultados anteriores
    }
  };

  const handleReconciliation = () => {
    if (!selectedFile) {
      alert('Por favor, selecione um arquivo de planilha primeiro.');
      return;
    }
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const activeEvent = localStorage.getItem('activeEvent');
        if (!activeEvent) {
            alert("Nenhum evento ativo selecionado. Volte e selecione um evento.");
            setIsLoading(false);
            return;
        }

        // Envia os dados para o backend processar
        const response = await axios.post(`${API_URL}/api/reconcile-yuzer`, {
            eventName: activeEvent,
            yuzerData: jsonData
        });
        
        setReconciliationResult(response.data);

      } catch (error) {
        const errorMessage = error.response ? error.response.data.message : 'Ocorreu um erro ao processar o arquivo.';
        alert(`Falha na conciliação: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  return (
    <div className="admin-container">
      <button onClick={() => navigate(-1)} className="back-button">&#x2190; Voltar ao Painel</button>
      <h1>Painel do Administrador</h1>
      <div className="admin-grid">
        {/* Card 1: Atualização */}
        <div className="admin-card">
          <h2>Atualização do Sistema</h2>
          <p>Esta função verificará se há uma nova versão do SisFO disponível e, se houver, fará o download para instalar na próxima reinicialização.</p>
          <button className="admin-button update-btn" disabled>Verificar Atualizações (Em Breve)</button>
        </div>

        {/* Card 2: Conciliação Yuzer */}
        <div className="admin-card">
          <h2>Conciliação Yuzer</h2>
          <p>Envie o relatório de caixas da Yuzer (.xlsx) para comparar com os dados do SisFO para o evento ativo.</p>
          <label htmlFor="file-upload" className="file-upload-label">{fileName || 'Clique para escolher a planilha'}</label>
          <input id="file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
          <button className="admin-button reconcile-btn" onClick={handleReconciliation} disabled={!selectedFile || isLoading}>
            {isLoading ? 'Processando...' : 'Iniciar Conciliação'}
          </button>

          {reconciliationResult && (
            <div className="results-container">
              <h3>Resultado da Conciliação</h3>
              <p><strong>Registros Comparados:</strong> {reconciliationResult.recordsCompared}</p>
              <p><strong>Divergências Encontradas:</strong> {reconciliationResult.divergencesFound}</p>
              {reconciliationResult.totemsFound > 0 && 
                <p className="totem-info"><strong>Totens Ignorados:</strong> {reconciliationResult.totemsFound} registros de totem foram encontrados e não foram comparados.</p>
              }
              {reconciliationResult.divergences?.length > 0 && (
                <ul className="divergence-list">
                  {reconciliationResult.divergences.map((div, index) => (
                    <li key={index}>
                      <strong>{div.name} (CPF: {div.cpf})</strong>
                      <br/>
                      Campo: {div.field} | Valor Yuzer: {div.yuzerValue} | Valor SisFO: {div.sisfoValue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;