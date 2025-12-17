// src/pages/DataUpdatePage.jsx
// (VERSÃO ATUALIZADA: CRIAÇÃO DE EVENTO COM CONFIRMAÇÃO)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './DataUpdatePage.css';
import AlertModal from '../components/AlertModal.jsx'; 

function DataUpdatePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('import');
  
  const [personnel, setPersonnel] = useState([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [events, setEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingOnline, setIsUpdatingOnline] = useState(false);
  const [updatingEvent, setUpdatingEvent] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  // States de Edição e Criação
  const [editingPerson, setEditingPerson] = useState(null);
  const [newEventName, setNewEventName] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false); // NOVO STATE

  const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  useEffect(() => {
    const storedEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const cleanEvents = storedEvents.filter(event => event && event.name && event.name.trim() !== '');
    cleanEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
    setEvents(cleanEvents);

    const storedPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
    storedPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    
    setPersonnel(storedPersonnel);
    setFilteredPersonnel(storedPersonnel);
  }, []);

  // Filtro Inteligente
  useEffect(() => {
    const normalizedQuery = normalizeString(searchQuery.trim());
    if (!normalizedQuery) {
      setFilteredPersonnel(personnel);
      return;
    }
    const normalizedQueryCpf = normalizedQuery.replace(/\D/g, '');

    const filtered = personnel.filter(person => {
      const nameMatch = normalizeString(person.name).includes(normalizedQuery);
      let cpfMatch = false; 
      if (normalizedQueryCpf.length > 0) { 
        cpfMatch = (person.cpf || '').replace(/\D/g, '').includes(normalizedQueryCpf);
      }
      return nameMatch || cpfMatch;
    });
    setFilteredPersonnel(filtered);
  }, [searchQuery, personnel]);

  // --- AÇÕES ---

  const handleEditClick = (person) => {
      setEditingPerson({ originalCpf: person.cpf, tempCpf: person.cpf, tempName: person.name });
  };

  const handleCancelEdit = () => setEditingPerson(null);

  const handleSaveEdit = async () => {
      if (!editingPerson || !editingPerson.tempName.trim() || !editingPerson.tempCpf.trim()) {
          setAlertMessage("Nome e CPF são obrigatórios."); return;
      }
      // Local
      const updatedPersonnel = personnel.map(p => {
          if (p.cpf === editingPerson.originalCpf) return { ...p, cpf: editingPerson.tempCpf, name: editingPerson.tempName };
          return p;
      });
      updatedPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      setPersonnel(updatedPersonnel);
      localStorage.setItem('master_waiters', JSON.stringify(updatedPersonnel));
      
      // Online
      try {
          await axios.post(`${API_URL}/api/edit-waiter`, {
              originalCpf: editingPerson.originalCpf,
              newCpf: editingPerson.tempCpf,
              newName: editingPerson.tempName
          });
          setAlertMessage("Funcionário atualizado com sucesso (Local e Nuvem)!");
      } catch (error) {
          console.error("Erro nuvem:", error);
          setAlertMessage("Salvo LOCALMENTE. Erro ao enviar para a nuvem. Verifique a conexão.");
      }
      setEditingPerson(null);
  };

  // 1. INICIAR CRIAÇÃO (Valida e Abre Modal)
  const initiateCreateEvent = () => {
      if (!newEventName.trim()) return;
      
      if (events.some(e => e.name.toLowerCase() === newEventName.trim().toLowerCase())) {
          setAlertMessage("Já existe um evento com este nome.");
          return;
      }
      setIsCreateConfirmOpen(true);
  };

  // 2. CONFIRMAR CRIAÇÃO (Executa a ação)
  const confirmCreateEvent = async () => {
      setIsCreateConfirmOpen(false);
      setIsCreatingEvent(true);
      const newEvent = { name: newEventName.trim(), active: true };

      // Local
      const updatedEvents = [...events, newEvent];
      updatedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
      setEvents(updatedEvents);
      localStorage.setItem('master_events', JSON.stringify(updatedEvents));

      // Online
      try {
          await axios.post(`${API_URL}/api/add-event`, newEvent);
          setNewEventName('');
          setAlertMessage("Evento criado com sucesso!");
      } catch (error) {
          setAlertMessage("Evento criado LOCALMENTE. Erro na nuvem.");
      } finally { setIsCreatingEvent(false); }
  };

  const handleOnlineSync = () => {
    setIsSyncing(true);
    setAlertMessage('Sincronização iniciada em segundo plano...'); 
    const performSync = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/sync/master-data`);
        const { waiters: onlinePersonnel, events: onlineEvents } = response.data;
        // Lógica de merge mantida
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        const localCpfSet = new Set(localPersonnel.map(w => w.cpf.trim()));
        let newPersonnelCount = 0;
        onlinePersonnel.forEach(onlinePerson => {
          if (onlinePerson.cpf && !localCpfSet.has(onlinePerson.cpf.trim())) {
            localPersonnel.push(onlinePerson); newPersonnelCount++;
          }
        });
        const localEvents = JSON.parse(localStorage.getItem('master_events')) || [];
        const localEventsMap = new Map(localEvents.map(e => [e.name, e]));
        let newEventsCount = 0;
        let updatedEventsCount = 0;
        onlineEvents.forEach(onlineEvent => {
          if (onlineEvent.name) {
            if (localEventsMap.has(onlineEvent.name)) {
              const existingEvent = localEventsMap.get(onlineEvent.name);
              if (existingEvent.active !== onlineEvent.active) { existingEvent.active = onlineEvent.active; updatedEventsCount++; }
            } else {
              localEventsMap.set(onlineEvent.name, onlineEvent); newEventsCount++;
            }
          }
        });
        const mergedEvents = Array.from(localEventsMap.values());
        localStorage.setItem('master_waiters', JSON.stringify(localPersonnel)); 
        localStorage.setItem('master_events', JSON.stringify(mergedEvents));
        
        localPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
        setPersonnel(localPersonnel); 
        mergedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
        setEvents(mergedEvents);
        setAlertMessage(`Sincronização concluída!\n+ ${newPersonnelCount} Funcionários.\n+ ${newEventsCount} Eventos.`);
      } catch (error) { setAlertMessage("Falha ao sincronizar. Verifique a conexão."); } finally { setIsSyncing(false); }
    };
    performSync();
  };

  const handleImportData = () => {
    if (!selectedFile) { alert('Por favor, selecione um arquivo de planilha primeiro.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let feedbackMessages = [];
        const personnelSheet = workbook.Sheets['Funcionarios'] || workbook.Sheets['Garcons'];
        if (personnelSheet) {
          const newPersonnelRaw = XLSX.utils.sheet_to_json(personnelSheet);
          const existingPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
          const existingCpfSet = new Set(existingPersonnel.map(w => w.cpf.trim()));
          let addedCount = 0;
          newPersonnelRaw.forEach(row => {
            const cleanPersonnel = { cpf: String(row.CPF || row.cpf || '').trim(), name: String(row.NOME || row.name || '').trim() };
            if (cleanPersonnel.cpf && cleanPersonnel.name && !existingCpfSet.has(cleanPersonnel.cpf)) {
              existingPersonnel.push(cleanPersonnel); existingCpfSet.add(cleanPersonnel.cpf); addedCount++;
            }
          });
          localStorage.setItem('master_waiters', JSON.stringify(existingPersonnel));
          existingPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
          setPersonnel(existingPersonnel); 
          feedbackMessages.push(`${addedCount} novos funcionários importados.`);
        }
        if (workbook.Sheets['Eventos']) {
            const eventsSheet = workbook.Sheets['Eventos'];
            const newEventsData = XLSX.utils.sheet_to_json(eventsSheet);
            const existingEvents = JSON.parse(localStorage.getItem('master_events')) || [];
            const existingEventNames = new Set(existingEvents.map(ev => ev.name));
            let addedCount = 0;
            newEventsData.forEach(newEvent => {
              const eventName = String(newEvent['NOME DO EVENTO'] || '').trim();
              if (eventName && !existingEventNames.has(eventName)) {
                existingEvents.push({ name: eventName, active: String(newEvent.STATUS || 'ATIVO').toUpperCase() === 'ATIVO' });
                addedCount++;
              }
            });
            localStorage.setItem('master_events', JSON.stringify(existingEvents));
            existingEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
            setEvents(existingEvents);
            feedbackMessages.push(`${addedCount} novos eventos importados.`);
        }
        if (feedbackMessages.length > 0) alert(feedbackMessages.join('\n'));
        else alert('Nenhum dado válido encontrado.');
        setFileName(''); setSelectedFile(null); document.getElementById('file-upload').value = null;
      } catch (error) { console.error(error); alert('Erro ao processar arquivo.'); }
    };
    reader.readAsBinaryString(selectedFile);
  };
  
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const personnelSheet = workbook.addWorksheet('Funcionarios');
    personnelSheet.columns = [{ header: 'CPF', key: 'cpf', width: 20 }, { header: 'NOME', key: 'name', width: 40 }];
    personnelSheet.addRow({ cpf: '111.222.333-44', name: 'Nome do Funcionário' });
    const eventsSheet = workbook.addWorksheet('Eventos');
    eventsSheet.columns = [{ header: 'NOME DO EVENTO', key: 'name', width: 50 }, { header: 'STATUS', key: 'status', width: 20}];
    eventsSheet.addRow({ name: 'Nome do Evento', status: 'ATIVO' });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Modelo_Importacao.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setSelectedFile(file); setFileName(file.name); }
  };

  const handleUpdateOnlineBase = async () => {
    if (!selectedFile) { alert('Selecione um arquivo.'); return; }
    setIsUpdatingOnline(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let personnelToUpdate = [], eventsToUpdate = [];
        const personnelSheet = workbook.Sheets['Funcionarios'] || workbook.Sheets['Garcons'];
        if (personnelSheet) {
          const newPersonnel = XLSX.utils.sheet_to_json(personnelSheet);
          newPersonnel.forEach(p => { if(p.CPF || p.cpf) personnelToUpdate.push({ cpf: String(p.CPF || p.cpf).trim(), name: String(p.NOME || p.name).trim() }); });
        }
        if (workbook.Sheets['Eventos']) {
          const eventsSheet = workbook.Sheets['Eventos'];
          const newEvents = XLSX.utils.sheet_to_json(eventsSheet);
          newEvents.forEach(ev => { if(ev['NOME DO EVENTO']) eventsToUpdate.push({ name: String(ev['NOME DO EVENTO']).trim(), active: String(ev.STATUS || 'ATIVO').toUpperCase() === 'ATIVO' }); });
        }
        if (personnelToUpdate.length === 0 && eventsToUpdate.length === 0) { alert('Nenhum dado para atualizar.'); setIsUpdatingOnline(false); return; }
        const response = await axios.post(`${API_URL}/api/update-base`, { waiters: personnelToUpdate, events: eventsToUpdate });
        alert(response.data.message); setFileName(''); setSelectedFile(null); document.getElementById('file-upload').value = null;
      } catch (error) { alert(`Falha: ${error.response ? error.response.data.message : 'Erro no servidor'}`); } finally { setIsUpdatingOnline(false); }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleToggleEventStatus = async (eventName) => {
    setUpdatingEvent(eventName);
    const originalEvents = [...events];
    const updatedEvents = events.map(event => event.name === eventName ? { ...event, active: !event.active } : event);
    updatedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
    setEvents(updatedEvents);
    localStorage.setItem('master_events', JSON.stringify(updatedEvents));
    try {
      const eventToUpdate = updatedEvents.find(e => e.name === eventName);
      await axios.post(`${API_URL}/api/update-event-status`, { name: eventToUpdate.name, active: eventToUpdate.active });
    } catch (error) { alert('Falha ao sincronizar status online. Salvo localmente.'); setEvents(originalEvents); localStorage.setItem('master_events', JSON.stringify(originalEvents)); } finally { setUpdatingEvent(null); }
  };

  return (
    <div className="update-container">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      <h1 className="update-title">Administração de Dados</h1>
      
      <div className="online-sync-section">
        <button onClick={handleOnlineSync} className="sync-button" disabled={isSyncing || isUpdatingOnline}>
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Tudo (Online)'}
        </button>
      </div>

      <div className="tab-navigation">
        <button className={`tab-button ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>📂 Importar Arquivos</button>
        <button className={`tab-button ${activeTab === 'consult' ? 'active' : ''}`} onClick={() => setActiveTab('consult')}>👥 Funcionários</button>
        <button className={`tab-button ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>📅 Eventos</button>
      </div>
      
      {/* ABA IMPORTAR */}
      {activeTab === 'import' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>1. Obter Modelo</h2>
            <div className="download-section">
                <button onClick={handleDownloadTemplate} className="download-button">⬇️ Baixar Planilha Modelo (.xlsx)</button>
            </div>
          </div>
          <div className="update-card full-width">
            <h2>2. Carregar Dados</h2>
            <label htmlFor="file-upload" className="file-upload-label">
                <div className="upload-icon">☁️</div>
                <div className="upload-text">{fileName || 'Clique para selecionar a planilha'}</div>
                <div className="upload-subtext">Arquivos .xlsx ou .xls</div>
            </label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            <div className="action-buttons-container">
              <button onClick={handleImportData} className="update-button" disabled={!selectedFile || isUpdatingOnline}>
                📥 Importar Localmente
              </button>
              <button onClick={handleUpdateOnlineBase} className="update-base-button" disabled={!selectedFile || isUpdatingOnline}>
                {isUpdatingOnline ? 'Enviando...' : '☁️ Atualizar na Nuvem'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ABA CONSULTAR / EDITAR */}
      {activeTab === 'consult' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>Base de Funcionários</h2>
            <div className="search-container">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Buscar por Nome ou CPF..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="table-container">
              <table>
                <thead>
                    <tr>
                        <th style={{width: '30%'}}>CPF</th>
                        <th style={{width: '50%'}}>Nome Completo</th>
                        <th style={{width: '20%', textAlign: 'center'}}>Ações</th>
                    </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map(person => (
                      <tr key={person.cpf}>
                        {editingPerson && editingPerson.originalCpf === person.cpf ? (
                            <>
                                <td><input type="text" value={editingPerson.tempCpf} onChange={(e) => setEditingPerson({...editingPerson, tempCpf: e.target.value})} className="edit-input"/></td>
                                <td><input type="text" value={editingPerson.tempName} onChange={(e) => setEditingPerson({...editingPerson, tempName: e.target.value})} className="edit-input"/></td>
                                <td className="action-cell">
                                    <button className="icon-button save" onClick={handleSaveEdit} title="Salvar">💾</button>
                                    <button className="icon-button cancel" onClick={handleCancelEdit} title="Cancelar">❌</button>
                                </td>
                            </>
                        ) : (
                            <>
                                <td>{person.cpf}</td>
                                <td>{person.name}</td>
                                <td className="action-cell">
                                    <button className="icon-button edit" onClick={() => handleEditClick(person)} title="Editar">✏️</button>
                                </td>
                            </>
                        )}
                      </tr>
                    ))
                  ) : ( <tr><td colSpan="3" style={{textAlign: 'center', padding: '30px'}}>Nenhum funcionário encontrado.</td></tr> )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* ABA EVENTOS */}
      {activeTab === 'events' && (
          <div className="tab-content">
            <div className="update-card full-width">
            <h2>Gerenciar Eventos</h2>
            
            <div className="create-event-section">
                <input type="text" placeholder="Nome do novo evento..." value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className="new-event-input"/>
                <button onClick={initiateCreateEvent} className="create-event-button" disabled={isCreatingEvent || !newEventName.trim()}>
                    {isCreatingEvent ? 'Criando...' : '➕ Adicionar Evento'}
                </button>
            </div>

            <div className="event-list">
              {events.length > 0 ? (
                events.map(event => (
                  <div key={event.name} className="event-item">
                    <span>{event.name}</span>
                    <label className="switch">
                      <input type="checkbox" checked={event.active} onChange={() => handleToggleEventStatus(event.name)} disabled={updatingEvent === event.name} />
                      <span className="slider round"></span>
                    </label>
                  </div>
                ))
              ) : ( <p style={{textAlign: 'center', color: '#888'}}>Nenhum evento cadastrado.</p> )}
            </div>
          </div>
        </div>
      )}
      
      <button className="back-to-setup-button" onClick={() => navigate('/setup')}>
        ⬅ Voltar para Seleção de Evento
      </button>

      {/* MODAL DE CONFIRMAÇÃO DE CRIAÇÃO */}
      {isCreateConfirmOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center'}}>
                  <h2 style={{color: '#1E63B8'}}>Confirmar Criação</h2>
                  <p style={{fontSize: '1.1rem', margin: '20px 0'}}>
                      Deseja criar o evento <br/>
                      <strong>"{newEventName}"</strong>?
                  </p>
                  <div className="modal-buttons" style={{justifyContent: 'center'}}>
                      <button className="cancel-button" onClick={() => setIsCreateConfirmOpen(false)}>Cancelar</button>
                      <button className="confirm-button" onClick={confirmCreateEvent} style={{backgroundColor: '#28a745'}}>Sim, Criar</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

export default DataUpdatePage;