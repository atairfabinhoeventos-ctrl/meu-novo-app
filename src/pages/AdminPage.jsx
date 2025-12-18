// src/pages/AdminPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';
import './AdminPage.css';
import AlertModal from '../components/AlertModal.jsx';

function AdminPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

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
      setAlertMessage('Por favor, selecione um arquivo de planilha primeiro.');
      return;
    }
    const eventName = localStorage.getItem('activeEvent');
    if (!eventName) {
        setAlertMessage('Nenhum evento ativo selecionado.');
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

        const response = await axios.post(`${API_URL}/api/reconcile-yuzer`, {
          eventName: eventName,
          yuzerData: jsonData
        });

        setReconciliationResult(response.data);
      } catch (error) {
        console.error('Erro na conciliação:', error);
        setAlertMessage('Erro ao processar a conciliação. Verifique o arquivo ou a conexão.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  return (
    <div className="admin-container">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      <h1>Painel do Administrador</h1>
      
      <div className="admin-grid">
        {/* CARD 1: CONCILIAÇÃO (JÁ EXISTENTE) */}
        <div className="admin-card">
          <h2>Conciliação Yuzer</h2>
          <p>Importe a planilha de fechamento da Yuzer para comparar com os dados do SisFO.</p>
          
          <div className="upload-section">
            <label htmlFor="yuzer-upload" className="file-upload-label">
              {fileName || 'Clique para selecionar planilha Yuzer (.xlsx)'}
            </label>
            <input id="yuzer-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} style={{display:'none'}} />
          </div>

          <button className="admin-button reconcile-btn" onClick={handleReconciliation} disabled={!selectedFile || isLoading}>
            {isLoading ? 'Processando...' : 'Iniciar Conciliação'}
          </button>

          {reconciliationResult && (
            <div className="results-container">
              <h3>Resultado:</h3>
              <p>Comparados: <strong>{reconciliationResult.recordsCompared}</strong></p>
              <p style={{color: reconciliationResult.divergencesFound > 0 ? 'red' : 'green'}}>
                  Divergências: <strong>{reconciliationResult.divergencesFound}</strong>
              </p>
              {reconciliationResult.totemsFound > 0 && <p><small>Totens ignorados: {reconciliationResult.totemsFound}</small></p>}
              
              {reconciliationResult.divergences?.length > 0 && (
                <div className="divergence-list">
                  {reconciliationResult.divergences.map((div, index) => (
                    <div key={index} className="divergence-item">
                      <strong>{div.name}</strong> (Máq: {div.machine})<br/>
                      <span className="diff-detail">{div.field}: Yuzer {div.yuzerValue} | SisFO {div.sisfoValue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: GERADOR DE RECIBOS (NOVO) */}
        <div className="admin-card receipt-card">
            <h2>Gerador de Recibos</h2>
            <p>Geração em massa de recibos para prestadores de serviço (Segurança, Limpeza, etc).</p>
            <ul style={{textAlign:'left', color:'#666', fontSize:'0.9rem', marginBottom:'20px'}}>
                <li>Importação via Excel</li>
                <li>Reconhecimento automático de funções</li>
                <li>Impressão otimizada (3 por folha)</li>
            </ul>
            <button className="admin-button update-btn" onClick={() => navigate('/receipts-generator')}>
                Acessar Gerador
            </button>
        </div>

      </div>
      
      <button className="back-button-admin" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</button>
    </div>
  );
}

export default AdminPage;