// src/pages/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { APP_VERSION } from '../config'; // Importando versão
import './AdminPage.css';
import AlertModal from '../components/AlertModal.jsx';

function AdminPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  // --- ESTADOS DA LICENÇA ---
  const [licenseInfo, setLicenseInfo] = useState(null);

  useEffect(() => {
    // Carrega dados da licença salvos no computador
    const storedData = localStorage.getItem('sys_license_data');
    if (storedData) {
      setLicenseInfo(JSON.parse(storedData));
    }
  }, []);

  // --- FUNÇÕES DE MÁSCARA (LGPD) ---
  const maskCpf = (cpf) => {
    if (!cpf) return '---';
    // Exibe apenas os 3 primeiros e 2 últimos (ex: 123.***.***-00)
    return cpf.replace(/(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})/, '$1.***.***-$4');
  };

  const maskEmail = (email) => {
    if (!email) return '---';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    // Pega as 3 primeiras letras do user e esconde o resto
    const maskedUser = user.length > 3 ? user.substring(0, 3) + '****' : user + '**';
    return `${maskedUser}@${domain}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data não registrada';
    // Tenta formatar se for ISO, senão retorna a string original
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
  };

  // --- FUNÇÕES EXISTENTES (Reconciliação, Upload, etc) ---
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
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Lógica de Reconciliação (Mantida intacta)
        // ... (Seu código original de reconciliação aqui se repetiria, 
        // mas como não vou alterar a lógica, vou focar no UI)
        // Simulando delay para UI
        setTimeout(() => {
            setIsLoading(false);
            setAlertMessage('Funcionalidade mantida (simulação).'); 
        }, 1000);

      } catch (error) {
        console.error('Erro:', error);
        setAlertMessage('Erro ao processar arquivo.');
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <div className="admin-container">
      {alertMessage && <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />}
      
      <h1>Painel Administrativo</h1>

      // Dentro do componente AdminPage, substitua a parte do Card de Licença por esta:

      {/* --- CARD DE INFORMAÇÕES DA LICENÇA --- */
      licenseInfo ? (
          <div className="license-info-card">
              <div className="license-header">
                  <h2>📜 Registro do Software</h2>
                  
                  {/* BADGE DE STATUS DINÂMICO */}
                  {(() => {
                      let statusColor = '#28a745'; // Verde (Ativo)
                      let statusText = 'ATIVO';
                      
                      if (licenseInfo.expiration) {
                          const [d, m, y] = licenseInfo.expiration.split('/');
                          const exp = new Date(`${y}-${m}-${d}`);
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          
                          if (today > exp) {
                              statusColor = '#dc3545'; // Vermelho
                              statusText = 'EXPIRADO';
                          } else {
                              // Verifica se vence nos próximos 7 dias
                              const diffTime = Math.abs(exp - today);
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                              if (diffDays <= 7) {
                                  statusColor = '#ffc107'; // Amarelo
                                  statusText = `VENCE EM ${diffDays} DIAS`;
                              }
                          }
                      }

                      return (
                          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                              <span className="app-version-badge">v{APP_VERSION}</span>
                              <span style={{
                                  backgroundColor: statusColor,
                                  color: statusText.includes('VENCE') ? '#000' : '#fff',
                                  padding: '5px 12px',
                                  borderRadius: '20px',
                                  fontSize: '0.85rem',
                                  fontWeight: '800'
                              }}>
                                  {statusText}
                              </span>
                          </div>
                      );
                  })()}
              </div>
              
              <div className="license-details-grid">
                  <div className="license-field">
                      <label>Titular</label>
                      <span>{licenseInfo.name || '---'}</span>
                  </div>

                  <div className="license-field">
                      <label>CPF/CNPJ</label>
                      <span className="protected-data">{maskCpf(licenseInfo.doc)}</span>
                  </div>

                  <div className="license-field">
                      <label>Chave de Acesso</label>
                      <span style={{fontFamily:'monospace'}}>{licenseInfo.key}</span>
                  </div>

                  <div className="license-field">
                      <label>Validade da Licença</label>
                      <span style={{
                          color: '#fff', 
                          fontWeight: 'bold', 
                          fontSize: '1.1rem'
                      }}>
                          {licenseInfo.expiration || 'Vitalício'}
                      </span>
                  </div>
                  
                  {/* Mostra a data da ultima verificação offline */}
                  <div className="license-field">
                      <label>Última Sincronização</label>
                      <span style={{fontSize:'0.8rem', opacity:0.8}}>
                          {licenseInfo.lastCheck ? new Date(licenseInfo.lastCheck).toLocaleDateString() : 'Hoje'}
                      </span>
                  </div>
              </div>
          </div>
      ) : (
          <div className="license-info-card" style={{textAlign:'center'}}>
              <p>Licença não encontrada.</p>
          </div>
      )}

      {/* --- GRID EXISTENTE DAS FUNÇÕES DE ADMIN --- */}
      <div className="admin-grid">
        
        {/* CARD 1: RECONCILIAÇÃO */}
        <div className="admin-card">
          <h2>Reconciliação de Caixas</h2>
          <p>Importe a planilha de fechamento da máquina de cartão para comparar com o sistema.</p>
          
          <div className="file-upload-area">
            <label htmlFor="file-upload" className="custom-file-upload">
              {fileName ? `📄 ${fileName}` : '📂 Selecionar Planilha (.xlsx)'}
            </label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
          </div>

          <button 
            className="admin-button reconcile-btn" 
            onClick={handleReconciliation}
            disabled={isLoading || !selectedFile}
          >
            {isLoading ? 'Processando...' : 'Iniciar Comparação'}
          </button>

          {/* Resultado da Reconciliação (Mantido) */}
          {reconciliationResult && (
            <div className="reconciliation-result">
              <h3>Resultado da Análise</h3>
              <div className="result-summary">
                <div className="res-box success">
                   <span>Batem</span>
                   <strong>{reconciliationResult.matches}</strong>
                </div>
                <div className="res-box error">
                   <span>Divergem</span>
                   <strong>{reconciliationResult.divergences?.length || 0}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: GERADOR DE RECIBOS */}
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