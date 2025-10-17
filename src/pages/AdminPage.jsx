// src/pages/AdminPage.jsx (CORRIGIDO)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './AdminPage.css';

const API_URL = 'http://localhost:3001';

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
      setReconciliationResult(null);
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
        
        // --- CORREÇÃO APLICADA AQUI ---
        // A opção { range: 9 } instrui a biblioteca a ignorar as 9 primeiras linhas
        // e começar a ler a partir da linha 10, que contém os cabeçalhos corretos.
        const jsonData = XLSX.utils.sheet_to_json(sheet, { range: 9 });

        const activeEvent = localStorage.getItem('activeEvent');
        if (!activeEvent) {
            alert("Nenhum evento ativo selecionado. Por favor, retorne à tela de setup e selecione um evento.");
            setIsLoading(false);
            return;
        }

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
        <div className="admin-card">
          <h2>Atualização do Sistema</h2>
          <p>O aplicativo será atualizado automaticamente através da Microsoft Store quando uma nova versão for publicada.</p>
          <button className="admin-button update-btn" disabled>Atualizações via Loja</button>
        </div>

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
                <p className="totem-info"><strong>Totens Ignorados:</strong> {reconciliationResult.totemsFound} registros de totem (PDV) foram encontrados e não foram comparados.</p>
              }
              {reconciliationResult.divergences?.length > 0 && (
                <ul className="divergence-list">
                  {reconciliationResult.divergences.map((div, index) => (
                    <li key={index}>
                      <strong>{div.name} (CPF: {div.cpf})</strong>
                      <br/>
                      <span className="divergence-detail">Campo: {div.field} | Valor Yuzer: {div.yuzerValue} | Valor SisFO: {div.sisfoValue}</span>
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