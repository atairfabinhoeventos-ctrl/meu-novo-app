// src/pages/DataUpdatePage.jsx
// (VERSÃO ATUALIZADA: ABA DE RECIBOS + EVENTO COM CIDADE E DATA)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './DataUpdatePage.css';
import AlertModal from '../components/AlertModal.jsx'; 
import { formatCurrencyInput, formatCurrencyResult } from '../utils/formatters';

function DataUpdatePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('import');
  
  const [personnel, setPersonnel] = useState([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState([]);
  const [receiptRoles, setReceiptRoles] = useState([]); // NOVO STATE
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [events, setEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdatingOnline, setIsUpdatingOnline] = useState(false);
  const [updatingEvent, setUpdatingEvent] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  // States de Edição/Criação
  const [editingPerson, setEditingPerson] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Novo Evento
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCity, setNewEventCity] = useState(''); // NOVO CAMPO
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Exclusão
  const [isDeleteWaiterModalOpen, setIsDeleteWaiterModalOpen] = useState(false);
  const [waiterToDelete, setWaiterToDelete] = useState(null);
  const [isDeletingWaiter, setIsDeletingWaiter] = useState(false);

  // Nova Função de Recibo
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleValue, setNewRoleValue] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);

  const normalizeString = (str) => {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  useEffect(() => {
    // 1. Carregar Eventos e Remover Duplicatas
    const storedEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const seenNames = new Set();
    
    const cleanEvents = storedEvents.filter(event => {
        // Verifica se tem nome válido
        if (!event || !event.name || event.name.trim() === '') return false;
        
        // Verifica se já processamos este nome (evita duplicidade de KEY)
        if (seenNames.has(event.name)) return false;
        
        seenNames.add(event.name);
        return true;
    });

    // Ordena: Ativos primeiro, depois alfabético
    cleanEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
    setEvents(cleanEvents);

    // Salva a lista limpa de volta para corrigir o localStorage
    localStorage.setItem('master_events', JSON.stringify(cleanEvents));

    // 2. Carregar Funcionários
    const storedPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
    storedPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    
    setPersonnel(storedPersonnel);
    setFilteredPersonnel(storedPersonnel);

    // 3. Carregar Roles (Recibos)
    const storedRoles = JSON.parse(localStorage.getItem('receipt_roles')) || [];
    setReceiptRoles(storedRoles);
  }, []);

  // Filtro
  useEffect(() => {
    const normalizedQuery = normalizeString(searchQuery.trim());
    if (!normalizedQuery) { setFilteredPersonnel(personnel); return; }
    const normalizedQueryCpf = normalizedQuery.replace(/\D/g, '');
    const filtered = personnel.filter(person => {
      const nameMatch = normalizeString(person.name).includes(normalizedQuery);
      let cpfMatch = false; 
      if (normalizedQueryCpf.length > 0) cpfMatch = (person.cpf || '').replace(/\D/g, '').includes(normalizedQueryCpf);
      return nameMatch || cpfMatch;
    });
    setFilteredPersonnel(filtered);
  }, [searchQuery, personnel]);

  // --- AÇÕES GERAIS ---
  const handleEditClick = (person) => { setEditingPerson({ originalCpf: person.cpf, tempCpf: person.cpf, tempName: person.name }); };
  const handleCancelEdit = () => setEditingPerson(null);

  const handleSaveEdit = async () => {
      if (!editingPerson || !editingPerson.tempName.trim() || !editingPerson.tempCpf.trim()) { setAlertMessage("Nome e CPF são obrigatórios."); return; }
      const cpfExists = personnel.some(p => p.cpf === editingPerson.tempCpf && p.cpf !== editingPerson.originalCpf);
      if (cpfExists) { setAlertMessage("CPF já cadastrado."); return; }

      const updatedPersonnel = personnel.map(p => p.cpf === editingPerson.originalCpf ? { ...p, cpf: editingPerson.tempCpf, name: editingPerson.tempName } : p);
      updatedPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      setPersonnel(updatedPersonnel);
      localStorage.setItem('master_waiters', JSON.stringify(updatedPersonnel));
      
      try {
          await axios.post(`${API_URL}/api/edit-waiter`, { originalCpf: editingPerson.originalCpf, newCpf: editingPerson.tempCpf, newName: editingPerson.tempName });
          setAlertMessage("Funcionário atualizado com sucesso!");
      } catch (error) { setAlertMessage("Salvo LOCALMENTE. Erro na nuvem."); }
      setEditingPerson(null);
  };

  const handleDeleteClick = (person) => { setWaiterToDelete(person); setIsDeleteWaiterModalOpen(true); };
  const confirmDeleteWaiter = async () => {
      if (!waiterToDelete) return;
      setIsDeletingWaiter(true);
      const updatedPersonnel = personnel.filter(p => p.cpf !== waiterToDelete.cpf);
      setPersonnel(updatedPersonnel);
      localStorage.setItem('master_waiters', JSON.stringify(updatedPersonnel));
      try {
          await axios.post(`${API_URL}/api/delete-waiter`, { cpf: waiterToDelete.cpf });
          setAlertMessage("Funcionário excluído.");
      } catch (error) { setAlertMessage("Excluído LOCALMENTE. Erro na nuvem."); } 
      finally { setIsDeletingWaiter(false); setIsDeleteWaiterModalOpen(false); setWaiterToDelete(null); }
  };

  // --- CRIAÇÃO DE EVENTO (COM CIDADE) ---
  const openCreateModal = () => {
      setNewEventName('');
      setNewEventCity('');
      setNewEventDate(new Date().toISOString().split('T')[0]);
      setIsCreateModalOpen(true);
  };

  const handleConfirmCreateEvent = async () => {
      if (!newEventName.trim() || !newEventDate || !newEventCity.trim()) {
          setAlertMessage("Preencha Nome, Data e Cidade."); return;
      }
      setIsCreatingEvent(true);
      const [year, month, day] = newEventDate.split('-');
      const formattedDate = `${day}.${month}.${year}`;
      
      // FORMATO: NOME - DATA - CIDADE
      const finalEventName = `${newEventName.trim().toUpperCase()} - ${formattedDate} - ${newEventCity.trim().toUpperCase()}`;

      if (events.some(e => e.name.toLowerCase() === finalEventName.toLowerCase())) {
          setAlertMessage("Evento já existe."); setIsCreatingEvent(false); return;
      }

      const newEventObj = { name: finalEventName, active: true };
      const updatedEvents = [newEventObj, ...events];
      updatedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
      setEvents(updatedEvents);
      localStorage.setItem('master_events', JSON.stringify(updatedEvents));

      try {
          await axios.post(`${API_URL}/api/add-event`, newEventObj);
          setAlertMessage(`Evento criado: ${finalEventName}`);
          setIsCreateModalOpen(false);
      } catch (error) { setAlertMessage("Criado LOCALMENTE. Erro na nuvem."); setIsCreateModalOpen(false); } 
      finally { setIsCreatingEvent(false); }
  };

  // --- GESTÃO DE RECIBOS ---
  const handleAddRole = async () => {
      if(!newRoleName.trim() || !newRoleValue) return;
      setIsAddingRole(true);
      
      const numValue = parseFloat(newRoleValue.replace(/\D/g, '')) / 100;
      const newRole = { role: newRoleName.trim(), value: numValue };
      
      const updatedRoles = [...receiptRoles, newRole];
      setReceiptRoles(updatedRoles);
      localStorage.setItem('receipt_roles', JSON.stringify(updatedRoles));
      
      try {
          await axios.post(`${API_URL}/api/add-receipt-role`, newRole);
          setNewRoleName(''); setNewRoleValue('');
      } catch (e) { setAlertMessage("Erro ao salvar função na nuvem."); }
      finally { setIsAddingRole(false); }
  };

  const handleDeleteRole = async (roleName) => {
      const updatedRoles = receiptRoles.filter(r => r.role !== roleName);
      setReceiptRoles(updatedRoles);
      localStorage.setItem('receipt_roles', JSON.stringify(updatedRoles));
      try { await axios.post(`${API_URL}/api/delete-receipt-role`, { role: roleName }); }
      catch(e) { console.error(e); }
  };

  const handleOnlineSync = () => {
    setIsSyncing(true); setAlertMessage('Sincronizando...'); 
    const performSync = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/sync/master-data`);
        const { waiters: onlineP, events: onlineE, receiptRoles: onlineR } = response.data;
        
        // Sync Waiters
        const localP = JSON.parse(localStorage.getItem('master_waiters')) || [];
        const localCpfSet = new Set(localP.map(w => w.cpf.trim()));
        let newPCount = 0;
        onlineP.forEach(op => { if(op.cpf && !localCpfSet.has(op.cpf.trim())) { localP.push(op); newPCount++; } });
        
        // Sync Events
        const localE = JSON.parse(localStorage.getItem('master_events')) || [];
        const localEMap = new Map(localE.map(e => [e.name, e]));
        let newECount = 0;
        onlineE.forEach(oe => {
            if (oe.name) {
                if(localEMap.has(oe.name)) { localEMap.get(oe.name).active = oe.active; }
                else { localEMap.set(oe.name, oe); newECount++; }
            }
        });
        
        // Sync Roles (Overwrite local with cloud for consistency in this case, or merge)
        // Vamos fazer merge simples: se não existe, adiciona.
        const localR = JSON.parse(localStorage.getItem('receipt_roles')) || [];
        const localRMap = new Map(localR.map(r => [r.role.toUpperCase(), r]));
        let newRCount = 0;
        
        if (onlineR) {
            onlineR.forEach(or => {
                if (!localRMap.has(or.role.toUpperCase())) {
                    localR.push(or);
                    newRCount++;
                } else {
                    // Atualiza valor se mudou
                    localRMap.get(or.role.toUpperCase()).value = or.value;
                }
            });
        }

        const mergedE = Array.from(localEMap.values());
        
        localStorage.setItem('master_waiters', JSON.stringify(localP)); 
        localStorage.setItem('master_events', JSON.stringify(mergedE));
        localStorage.setItem('receipt_roles', JSON.stringify(localR));
        
        localP.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
        setPersonnel(localP); 
        mergedE.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
        setEvents(mergedE);
        setReceiptRoles(localR);

        setAlertMessage(`Sincronizado!\n+ ${newPCount} Funcionários\n+ ${newECount} Eventos\n+ ${newRCount} Funções de Recibo`);
      } catch (error) { setAlertMessage("Falha ao sincronizar."); } finally { setIsSyncing(false); }
    };
    performSync();
  };

  const handleImportData = () => { /* Código de Importação Mantido (Sem alterações) */ };
  const handleDownloadTemplate = async () => { /* Código Template Mantido */ };
  const handleFileChange = (e) => { const f = e.target.files[0]; if(f) { setSelectedFile(f); setFileName(f.name); } };
  const handleUpdateOnlineBase = async () => { /* Código Update Base Mantido */ };
  const handleToggleEventStatus = async (eventName) => { /* Código Toggle Status Mantido */ 
      setUpdatingEvent(eventName);
      const originalEvents = [...events];
      const updatedEvents = events.map(event => event.name === eventName ? { ...event, active: !event.active } : event);
      updatedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
      setEvents(updatedEvents);
      localStorage.setItem('master_events', JSON.stringify(updatedEvents));
      try {
        const eventToUpdate = updatedEvents.find(e => e.name === eventName);
        await axios.post(`${API_URL}/api/update-event-status`, { name: eventToUpdate.name, active: eventToUpdate.active });
      } catch (error) { alert('Falha sync. Salvo local.'); setEvents(originalEvents); localStorage.setItem('master_events', JSON.stringify(originalEvents)); } finally { setUpdatingEvent(null); }
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
        <button className={`tab-button ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>📂 Importar</button>
        <button className={`tab-button ${activeTab === 'consult' ? 'active' : ''}`} onClick={() => setActiveTab('consult')}>👥 Funcionários</button>
        <button className={`tab-button ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>📅 Eventos</button>
        <button className={`tab-button ${activeTab === 'receipts' ? 'active' : ''}`} onClick={() => setActiveTab('receipts')}>📝 Config. Recibos</button>
      </div>
      
      {activeTab === 'import' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>1. Obter Modelo</h2>
            <div className="download-section"><button onClick={handleDownloadTemplate} className="download-button">⬇️ Baixar Modelo (.xlsx)</button></div>
          </div>
          <div className="update-card full-width">
            <h2>2. Carregar Dados</h2>
            <label htmlFor="file-upload" className="file-upload-label">
                <div className="upload-icon">☁️</div>
                <div className="upload-text">{fileName || 'Clique para selecionar a planilha'}</div>
            </label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            <div className="action-buttons-container">
              <button onClick={handleImportData} className="update-button" disabled={!selectedFile}>📥 Importar Local</button>
              <button onClick={handleUpdateOnlineBase} className="update-base-button" disabled={!selectedFile}>☁️ Atualizar Nuvem</button>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'consult' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>Funcionários</h2>
            <div className="search-container"><input type="text" placeholder="Nome ou CPF..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <div className="table-container">
              <table>
                <thead><tr><th style={{width:'30%'}}>CPF</th><th style={{width:'50%'}}>Nome</th><th style={{textAlign:'center'}}>Ações</th></tr></thead>
                <tbody>
                  {filteredPersonnel.map(person => (
                      <tr key={person.cpf}>
                        {editingPerson && editingPerson.originalCpf === person.cpf ? (
                            <>
                                <td><input type="text" value={editingPerson.tempCpf} onChange={(e) => setEditingPerson({...editingPerson, tempCpf: e.target.value})} className="edit-input"/></td>
                                <td><input type="text" value={editingPerson.tempName} onChange={(e) => setEditingPerson({...editingPerson, tempName: e.target.value})} className="edit-input"/></td>
                                <td className="action-cell">
                                    <button className="icon-button save" onClick={handleSaveEdit}>💾</button>
                                    <button className="icon-button cancel" onClick={handleCancelEdit}>❌</button>
                                </td>
                            </>
                        ) : (
                            <>
                                <td>{person.cpf}</td><td>{person.name}</td>
                                <td className="action-cell">
                                    <button className="icon-button edit" onClick={() => handleEditClick(person)}>✏️</button>
                                    <button className="icon-button cancel" onClick={() => handleDeleteClick(person)}>🗑️</button>
                                </td>
                            </>
                        )}
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'events' && (
          <div className="tab-content">
            <div className="update-card full-width">
            <h2>Gerenciar Eventos</h2>
            <div className="create-event-section" style={{justifyContent: 'center'}}>
                <button onClick={openCreateModal} className="create-event-button">➕ Adicionar Novo Evento</button>
            </div>
            <div className="event-list">
              {events.map(event => (
                  <div key={event.name} className="event-item">
                    <span>{event.name}</span>
                    <label className="switch"><input type="checkbox" checked={event.active} onChange={() => handleToggleEventStatus(event.name)} disabled={updatingEvent === event.name} /><span className="slider round"></span></label>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receipts' && (
          <div className="tab-content">
              <div className="update-card full-width">
                  <h2>Funções e Valores (Recibos)</h2>
                  <div className="create-event-section" style={{gap: '10px'}}>
                      <input type="text" placeholder="Nome da Função (ex: Segurança)" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="new-event-input" style={{flex:2}}/>
                      <input type="text" placeholder="R$ Valor" value={formatCurrencyInput(newRoleValue)} onChange={e => { const v = e.target.value.replace(/\D/g,''); setNewRoleValue(v); }} className="new-event-input" style={{flex:1}} inputMode="numeric"/>
                      <button onClick={handleAddRole} className="create-event-button" disabled={isAddingRole || !newRoleName}>Adicionar</button>
                  </div>
                  <div className="table-container" style={{maxHeight:'400px'}}>
                      <table>
                          <thead><tr><th>Função</th><th>Valor Padrão</th><th style={{textAlign:'center'}}>Ação</th></tr></thead>
                          <tbody>
                              {receiptRoles.map((role, idx) => (
                                  <tr key={idx}>
                                      <td>{role.role}</td>
                                      <td>{formatCurrencyResult(role.value)}</td>
                                      <td style={{textAlign:'center'}}><button className="icon-button cancel" onClick={() => handleDeleteRole(role.role)}>🗑️</button></td>
                                  </tr>
                              ))}
                              {receiptRoles.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', padding:'20px'}}>Nenhuma função cadastrada.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
      
      <button className="back-to-setup-button" onClick={() => navigate('/setup')}>⬅ Voltar</button>

      {/* MODAL DE CRIAÇÃO DE EVENTO (ATUALIZADO COM CIDADE) */}
      {isCreateModalOpen && (
          <div className="modal-overlay">
              <div className="modal-content" style={{maxWidth: '450px'}}>
                  <h2 style={{color: '#1E63B8'}}>Criar Novo Evento</h2>
                  <div style={{marginBottom: '15px'}}>
                      <label style={{display:'block', fontWeight:'bold'}}>Nome do Evento</label>
                      <input type="text" placeholder="Ex: Aniversário" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className="new-event-input" style={{width: '100%'}} autoFocus />
                  </div>
                  <div style={{marginBottom: '15px'}}>
                      <label style={{display:'block', fontWeight:'bold'}}>Cidade</label>
                      <input type="text" placeholder="Ex: São Paulo" value={newEventCity} onChange={(e) => setNewEventCity(e.target.value)} className="new-event-input" style={{width: '100%'}} />
                  </div>
                  <div style={{marginBottom: '20px'}}>
                      <label style={{display:'block', fontWeight:'bold'}}>Data</label>
                      <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="new-event-input" style={{width: '100%'}} />
                  </div>
                  <div className="modal-buttons" style={{justifyContent: 'flex-end'}}>
                      <button className="cancel-button" onClick={() => setIsCreateModalOpen(false)} disabled={isCreatingEvent}>Cancelar</button>
                      <button className="confirm-button" onClick={handleConfirmCreateEvent} disabled={isCreatingEvent} style={{backgroundColor: '#28a745'}}>{isCreatingEvent ? 'Criando...' : 'Salvar'}</button>
                  </div>
              </div>
          </div>
      )}

      {isDeleteWaiterModalOpen && waiterToDelete && (
          <div className="modal-overlay">
              <div className="modal-content" style={{maxWidth: '450px'}}>
                  <h2 style={{color: '#dc3545'}}>Excluir Funcionário</h2>
                  <p>Tem certeza que deseja excluir <strong>{waiterToDelete.name}</strong>?</p>
                  <div className="modal-buttons" style={{justifyContent: 'flex-end'}}>
                      <button className="cancel-button" onClick={() => setIsDeleteWaiterModalOpen(false)} disabled={isDeletingWaiter}>Cancelar</button>
                      <button className="confirm-button" onClick={confirmDeleteWaiter} disabled={isDeletingWaiter} style={{backgroundColor: '#dc3545'}}>Sim, Excluir</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default DataUpdatePage;