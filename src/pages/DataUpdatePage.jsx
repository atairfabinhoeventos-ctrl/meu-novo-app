// src/pages/DataUpdatePage.jsx
// (VERSÃO COMPLETA E FINAL: SEM ABREVIAÇÕES)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation(); // Hook para ler dados de navegação
  const [activeTab, setActiveTab] = useState('import');
  
  const [personnel, setPersonnel] = useState([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState([]);
  const [receiptRoles, setReceiptRoles] = useState([]); 
  
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
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCity, setNewEventCity] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isDeleteWaiterModalOpen, setIsDeleteWaiterModalOpen] = useState(false);
  const [waiterToDelete, setWaiterToDelete] = useState(null);
  const [isDeletingWaiter, setIsDeletingWaiter] = useState(false);

  // Recibos - Novo e Edição
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleValue, setNewRoleValue] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [editingRole, setEditingRole] = useState(null); 

  // States para Modal de Senha
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { type: 'ADD'|'EDIT'|'DELETE', payload: ... }
  const passwordInputRef = useRef(null);

  const normalizeString = (str) => {
    if (!str) return '';
    return String(str).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  useEffect(() => {
    if (isPasswordModalOpen) setTimeout(() => passwordInputRef.current?.focus(), 100);
  }, [isPasswordModalOpen]);

  // --- EFEITO: DETECTAR NAVEGAÇÃO EXTERNA ---
  useEffect(() => {
      // Se a navegação veio com estado { initialTab: 'events' }, muda a aba
      if (location.state && location.state.initialTab) {
          setActiveTab(location.state.initialTab);
      }
  }, [location]);

  useEffect(() => {
    const storedEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const seenNames = new Set();
    const cleanEvents = storedEvents.filter(event => {
        if (!event || !event.name || event.name.trim() === '') return false;
        if (seenNames.has(event.name)) return false;
        seenNames.add(event.name);
        return true;
    });
    cleanEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
    setEvents(cleanEvents);
    localStorage.setItem('master_events', JSON.stringify(cleanEvents));

    const storedPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
    storedPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
    setPersonnel(storedPersonnel);
    setFilteredPersonnel(storedPersonnel);

    const storedRoles = JSON.parse(localStorage.getItem('receipt_roles')) || [];
    storedRoles.sort((a, b) => (a.role || '').localeCompare(b.role || '', 'pt-BR'));
    setReceiptRoles(storedRoles);
  }, []);

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

  // --- FUNÇÕES DE CONTROLE DE SENHA E RECIBOS ---

  const initiateAction = (action) => {
      setPendingAction(action);
      setPassword('');
      setPasswordError('');
      setShowPassword(false);
      setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async () => {
      if (!password) { setPasswordError('Digite a senha.'); return; }
      
      setIsPasswordModalOpen(false);
      const action = pendingAction;
      setPendingAction(null);

      if (action.type === 'ADD') await handleAddRole(password);
      else if (action.type === 'EDIT') await handleSaveRoleEdit(password);
      else if (action.type === 'DELETE') await handleDeleteRole(action.payload, password);
  };

  const handleAddRole = async (authPassword) => {
      setIsAddingRole(true);
      const numValue = parseFloat(newRoleValue.replace(/\D/g, '')) / 100;
      const newRole = { role: newRoleName.trim(), value: numValue };
      
      // Atualização Otimista Local
      const updatedRoles = [...receiptRoles, newRole];
      updatedRoles.sort((a, b) => a.role.localeCompare(b.role, 'pt-BR'));
      
      try {
          await axios.post(`${API_URL}/api/add-receipt-role`, { ...newRole, password: authPassword });
          setReceiptRoles(updatedRoles);
          localStorage.setItem('receipt_roles', JSON.stringify(updatedRoles));
          setNewRoleName(''); setNewRoleValue('');
          setAlertMessage("Função adicionada com sucesso!");
      } catch (e) { 
          if (e.response && e.response.status === 401) setAlertMessage("Senha incorreta.");
          else setAlertMessage(e.response?.data?.message || "Erro ao salvar na nuvem."); 
      } finally { setIsAddingRole(false); }
  };

  const handleSaveRoleEdit = async (authPassword) => {
      const numValue = parseFloat(String(editingRole.tempValue).replace(/\D/g, '')) / 100;
      
      try {
          await axios.post(`${API_URL}/api/edit-receipt-role`, {
              originalRole: editingRole.originalRole,
              newRole: editingRole.tempRole.trim(),
              newValue: numValue,
              password: authPassword
          });
          
          // Atualiza Local se sucesso
          const updatedRoles = receiptRoles.map(r => 
              r.role === editingRole.originalRole ? { role: editingRole.tempRole.trim(), value: numValue } : r
          );
          updatedRoles.sort((a, b) => a.role.localeCompare(b.role, 'pt-BR'));
          setReceiptRoles(updatedRoles);
          localStorage.setItem('receipt_roles', JSON.stringify(updatedRoles));
          
          setAlertMessage("Função atualizada!");
          setEditingRole(null);
      } catch (e) {
          if (e.response && e.response.status === 401) setAlertMessage("Senha incorreta.");
          else setAlertMessage(e.response?.data?.message || "Erro ao editar na nuvem.");
      }
  };

  const handleDeleteRole = async (roleName, authPassword) => {
      try { 
          await axios.post(`${API_URL}/api/delete-receipt-role`, { role: roleName, password: authPassword });
          
          const updatedRoles = receiptRoles.filter(r => r.role !== roleName);
          setReceiptRoles(updatedRoles);
          localStorage.setItem('receipt_roles', JSON.stringify(updatedRoles));
          setAlertMessage("Função excluída.");
      } catch(e) { 
          if (e.response && e.response.status === 401) setAlertMessage("Senha incorreta.");
          else console.error(e); 
      }
  };

  const onAddClick = () => {
      if(!newRoleName.trim() || !newRoleValue) { setAlertMessage("Preencha nome e valor."); return; }
      const normalizedNew = normalizeString(newRoleName);
      if (receiptRoles.some(r => normalizeString(r.role) === normalizedNew)) { setAlertMessage("Função já existe."); return; }
      initiateAction({ type: 'ADD' });
  };

  const onSaveEditClick = () => {
      if (!editingRole || !editingRole.tempRole.trim()) { setAlertMessage("Nome inválido."); return; }
      const normalizedNew = normalizeString(editingRole.tempRole);
      const exists = receiptRoles.some(r => r.role !== editingRole.originalRole && normalizeString(r.role) === normalizedNew);
      if (exists) { setAlertMessage("Já existe."); return; }
      initiateAction({ type: 'EDIT' });
  };

  const onDeleteRoleClick = (roleName) => {
      initiateAction({ type: 'DELETE', payload: roleName });
  };

  // --- FUNÇÕES DE GARÇOM ---

  const handleEditClick = (person) => { setEditingPerson({ originalCpf: person.cpf, tempCpf: person.cpf, tempName: person.name }); };
  
  const handleCancelEdit = () => setEditingPerson(null);
  
  const handleSaveEdit = async () => {
      if (!editingPerson || !editingPerson.tempName.trim() || !editingPerson.tempCpf.trim()) { setAlertMessage("Dados incompletos."); return; }
      const cpfExists = personnel.some(p => p.cpf === editingPerson.tempCpf && p.cpf !== editingPerson.originalCpf);
      if (cpfExists) { setAlertMessage("CPF duplicado."); return; }
      
      const updated = personnel.map(p => p.cpf === editingPerson.originalCpf ? { ...p, cpf: editingPerson.tempCpf, name: editingPerson.tempName } : p);
      updated.sort((a, b) => (a.name||'').localeCompare(b.name||'','pt-BR'));
      setPersonnel(updated);
      localStorage.setItem('master_waiters', JSON.stringify(updated));
      
      try {
          await axios.post(`${API_URL}/api/edit-waiter`, { originalCpf: editingPerson.originalCpf, newCpf: editingPerson.tempCpf, newName: editingPerson.tempName });
          setAlertMessage("Salvo!");
      } catch (e) {
          setAlertMessage("Salvo localmente. Erro nuvem.");
      }
      setEditingPerson(null);
  };

  const handleDeleteClick = (person) => { setWaiterToDelete(person); setIsDeleteWaiterModalOpen(true); };
  
  const confirmDeleteWaiter = async () => {
      if (!waiterToDelete) return;
      setIsDeletingWaiter(true);
      const updated = personnel.filter(p => p.cpf !== waiterToDelete.cpf);
      setPersonnel(updated);
      localStorage.setItem('master_waiters', JSON.stringify(updated));
      
      try {
          await axios.post(`${API_URL}/api/delete-waiter`, { cpf: waiterToDelete.cpf });
          setAlertMessage("Excluído.");
      } catch (e) {
          setAlertMessage("Erro nuvem.");
      } finally {
          setIsDeletingWaiter(false);
          setIsDeleteWaiterModalOpen(false);
      }
  };

  // --- FUNÇÕES DE EVENTO ---

  const openCreateModal = () => {
      setNewEventName('');
      setNewEventCity('');
      setNewEventDate(new Date().toISOString().split('T')[0]);
      setIsCreateModalOpen(true);
  };
  
  const handleConfirmCreateEvent = async () => {
      if (!newEventName.trim() || !newEventDate || !newEventCity.trim()) { setAlertMessage("Preencha tudo."); return; }
      setIsCreatingEvent(true);
      
      const [y, m, d] = newEventDate.split('-');
      const finalName = `${newEventName.trim().toUpperCase()} - ${d}.${m}.${y} - ${newEventCity.trim().toUpperCase()}`;
      
      if (events.some(e => e.name.toLowerCase() === finalName.toLowerCase())) { setAlertMessage("Já existe."); setIsCreatingEvent(false); return; }
      
      const newEv = { name: finalName, active: true };
      const updated = [newEv, ...events];
      updated.sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,'pt-BR'));
      setEvents(updated);
      localStorage.setItem('master_events', JSON.stringify(updated));
      
      try {
          await axios.post(`${API_URL}/api/add-event`, newEv);
          setAlertMessage("Criado!");
          setIsCreateModalOpen(false);
      } catch (e) {
          setAlertMessage("Erro nuvem.");
          setIsCreateModalOpen(false);
      } finally {
          setIsCreatingEvent(false);
      }
  };

  const handleToggleEventStatus = async (eventName) => {
      setUpdatingEvent(eventName);
      const orig = [...events];
      const updated = events.map(e => e.name === eventName ? { ...e, active: !e.active } : e);
      updated.sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name));
      setEvents(updated);
      localStorage.setItem('master_events', JSON.stringify(updated));
      
      try {
          const ev = updated.find(e => e.name === eventName);
          await axios.post(`${API_URL}/api/update-event-status`, { name: ev.name, active: ev.active });
      } catch (e) {
          setEvents(orig);
          localStorage.setItem('master_events', JSON.stringify(orig));
      } finally {
          setUpdatingEvent(null);
      }
  };

  // --- SINCRONIZAÇÃO E IMPORTAÇÃO ---

  const handleOnlineSync = () => {
      setIsSyncing(true);
      setAlertMessage('Sincronizando...');
      const run = async () => {
          try {
              const res = await axios.get(`${API_URL}/api/sync/master-data`);
              const { waiters: op, events: oe, receiptRoles: or } = res.data;
              
              const lp = JSON.parse(localStorage.getItem('master_waiters')) || [];
              const lpSet = new Set(lp.map(w => w.cpf.trim()));
              let np = 0;
              op.forEach(o => { if(o.cpf && !lpSet.has(o.cpf.trim())) { lp.push(o); np++; } });
              
              const le = JSON.parse(localStorage.getItem('master_events')) || [];
              const leMap = new Map(le.map(e => [e.name, e]));
              let ne = 0;
              oe.forEach(o => {
                  if(o.name) {
                      if(leMap.has(o.name)) leMap.get(o.name).active = o.active;
                      else { leMap.set(o.name, o); ne++; }
                  }
              });
              
              const lr = JSON.parse(localStorage.getItem('receipt_roles')) || [];
              const lrMap = new Map(lr.map(r => [normalizeString(r.role), r]));
              let nr = 0;
              if(or) or.forEach(o => {
                  const k = normalizeString(o.role);
                  if(!lrMap.has(k)) { lr.push(o); nr++; }
                  else { lrMap.get(k).value = o.value; }
              });
              
              const me = Array.from(leMap.values());
              localStorage.setItem('master_waiters', JSON.stringify(lp));
              localStorage.setItem('master_events', JSON.stringify(me));
              localStorage.setItem('receipt_roles', JSON.stringify(lr));
              
              lp.sort((a,b)=>(a.name||'').localeCompare(b.name||'','pt-BR')); setPersonnel(lp);
              me.sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,'pt-BR')); setEvents(me);
              lr.sort((a,b)=>(a.role||'').localeCompare(b.role||'','pt-BR')); setReceiptRoles(lr);
              
              setAlertMessage(`Sincronizado!\n+${np} Funcionários\n+${ne} Eventos\n+${nr} Funções`);
          } catch(e) { setAlertMessage("Falha sync."); }
          finally { setIsSyncing(false); }
      };
      run();
  };

  const handleImportData = () => {
      if (!selectedFile) { alert('Selecione arquivo.'); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = e.target.result;
              const workbook = XLSX.read(data, { type: 'binary' });
              let feedback = [];
              
              const pSheet = workbook.Sheets['Funcionarios'] || workbook.Sheets['Garcons'];
              if (pSheet) {
                  const raw = XLSX.utils.sheet_to_json(pSheet);
                  const exist = JSON.parse(localStorage.getItem('master_waiters')) || [];
                  const cpfSet = new Set(exist.map(w => w.cpf.trim()));
                  let add = 0;
                  raw.forEach(r => {
                      const c = { cpf: String(r.CPF||r.cpf||'').trim(), name: String(r.NOME||r.name||'').trim() };
                      if(c.cpf && c.name && !cpfSet.has(c.cpf)) { exist.push(c); cpfSet.add(c.cpf); add++; }
                  });
                  localStorage.setItem('master_waiters', JSON.stringify(exist));
                  exist.sort((a,b) => (a.name||'').localeCompare(b.name||'','pt-BR'));
                  setPersonnel(exist); feedback.push(`${add} funcionários importados.`);
              }
              
              if (workbook.Sheets['Eventos']) {
                  const eSheet = workbook.Sheets['Eventos'];
                  const rawE = XLSX.utils.sheet_to_json(eSheet);
                  const existE = JSON.parse(localStorage.getItem('master_events')) || [];
                  const nameSet = new Set(existE.map(ev => ev.name));
                  let add = 0;
                  rawE.forEach(ne => {
                      const name = String(ne['NOME DO EVENTO']||'').trim();
                      if(name && !nameSet.has(name)) { existE.push({name, active: String(ne.STATUS||'ATIVO').toUpperCase()==='ATIVO'}); add++; }
                  });
                  localStorage.setItem('master_events', JSON.stringify(existE));
                  existE.sort((a,b) => b.active-a.active||a.name.localeCompare(b.name,'pt-BR'));
                  setEvents(existE); feedback.push(`${add} eventos importados.`);
              }
              
              if(feedback.length) alert(feedback.join('\n')); else alert('Nada importado.');
              setFileName(''); setSelectedFile(null); document.getElementById('file-upload').value = null;
          } catch(e) { console.error(e); alert('Erro leitura arquivo.'); }
      };
      reader.readAsBinaryString(selectedFile);
  };

  const handleDownloadTemplate = async () => {
      const wb = new ExcelJS.Workbook();
      const ps = wb.addWorksheet('Funcionarios'); ps.columns = [{header:'CPF',key:'cpf'},{header:'NOME',key:'name'}];
      const es = wb.addWorksheet('Eventos'); es.columns = [{header:'NOME DO EVENTO',key:'name'},{header:'STATUS',key:'status'}];
      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), 'Modelo_Importacao.xlsx');
  };

  const handleFileChange = (e) => { const f = e.target.files[0]; if(f) { setSelectedFile(f); setFileName(f.name); } };

  const handleUpdateOnlineBase = async () => {
      if (!selectedFile) return;
      setIsUpdatingOnline(true);
      const r = new FileReader();
      r.onload = async(e) => {
          try {
              const d = e.target.result; const wb = XLSX.read(d, {type:'binary'});
              let w=[], ev=[];
              
              const ps = wb.Sheets['Funcionarios']||wb.Sheets['Garcons'];
              if(ps) XLSX.utils.sheet_to_json(ps).forEach(p => { if(p.CPF||p.cpf) w.push({cpf:String(p.CPF||p.cpf).trim(), name:String(p.NOME||p.name).trim()}); });
              
              const es = wb.Sheets['Eventos'];
              if(es) XLSX.utils.sheet_to_json(es).forEach(e => { if(e['NOME DO EVENTO']) ev.push({name:String(e['NOME DO EVENTO']).trim(), active:String(e.STATUS||'ATIVO').toUpperCase()==='ATIVO'}); });
              
              await axios.post(`${API_URL}/api/update-base`, { waiters:w, events:ev });
              alert('Base atualizada.'); setFileName(''); setSelectedFile(null);
          } catch(err) { alert('Erro update online.'); }
          finally { setIsUpdatingOnline(false); }
      };
      r.readAsBinaryString(selectedFile);
  };

  const handleEditRoleClick = (role) => { setEditingRole({ originalRole: role.role, tempRole: role.role, tempValue: (role.value * 100).toFixed(0) }); };
  const handleCancelRoleEdit = () => setEditingRole(null);

  // --- RENDERIZAÇÃO ---

  return (
    <div className="update-container">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      <h1 className="update-title">Administração de Dados</h1>
      <div className="online-sync-section"><button onClick={handleOnlineSync} className="sync-button" disabled={isSyncing || isUpdatingOnline}>{isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Tudo (Online)'}</button></div>
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
                      <button onClick={onAddClick} className="create-event-button" disabled={isAddingRole || !newRoleName}>Adicionar</button>
                  </div>
                  <div className="table-container" style={{maxHeight:'400px'}}>
                      <table>
                          <thead><tr><th>Função</th><th>Valor Padrão</th><th style={{textAlign:'center'}}>Ação</th></tr></thead>
                          <tbody>
                              {receiptRoles.map((role, idx) => (
                                  <tr key={idx}>
                                      {editingRole && editingRole.originalRole === role.role ? (
                                          <>
                                              <td><input type="text" value={editingRole.tempRole} onChange={e => setEditingRole({...editingRole, tempRole: e.target.value})} className="edit-input"/></td>
                                              <td><input type="text" value={formatCurrencyInput(editingRole.tempValue)} onChange={e => setEditingRole({...editingRole, tempValue: e.target.value.replace(/\D/g,'')})} className="edit-input" inputMode="numeric"/></td>
                                              <td className="action-cell">
                                                  <button className="icon-button save" onClick={onSaveEditClick}>💾</button>
                                                  <button className="icon-button cancel" onClick={handleCancelRoleEdit}>❌</button>
                                              </td>
                                          </>
                                      ) : (
                                          <>
                                              <td>{role.role}</td>
                                              <td>{formatCurrencyResult(role.value)}</td>
                                              <td className="action-cell">
                                                  <button className="icon-button edit" onClick={() => handleEditRoleClick(role)}>✏️</button>
                                                  <button className="icon-button cancel" onClick={() => onDeleteRoleClick(role.role)}>🗑️</button>
                                              </td>
                                          </>
                                      )}
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

      {/* MODAL DE CRIAÇÃO DE EVENTO */}
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

      {/* MODAL DE SENHA PARA RECIBOS */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center', padding: '30px'}}>
             <div style={{fontSize: '40px', marginBottom: '15px'}}>🔒</div>
             <h2 style={{color: '#333', marginBottom: '10px'}}>Acesso Restrito</h2>
             <p style={{color: '#666', marginBottom: '20px'}}>Digite a senha para alterar as Funções de Recibo.</p>
             <div className="input-group" style={{marginBottom: '20px', position: 'relative'}}>
                <input ref={passwordInputRef} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} placeholder="Senha..." style={{width: '100%', padding: '12px 40px 12px 12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '6px', textAlign: 'center'}} autoFocus />
                <span onClick={() => setShowPassword(!showPassword)} style={{position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px', userSelect: 'none'}}>{showPassword ? "🙈" : "👁️"}</span>
             </div>
             {passwordError && <div style={{color: 'red', fontSize: '14px', marginBottom: '15px', background: '#ffe6e6', padding: '8px', borderRadius: '4px'}}>{passwordError}</div>}
             <div className="modal-buttons" style={{justifyContent: 'center', gap: '10px'}}>
               <button className="cancel-button" onClick={() => { setIsPasswordModalOpen(false); setPendingAction(null); }} style={{padding: '10px 20px'}}>Cancelar</button>
               <button className="confirm-button" onClick={handlePasswordSubmit} style={{padding: '10px 30px', backgroundColor: '#1E63B8'}}>Confirmar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataUpdatePage;