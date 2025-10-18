// src/pages/DataUpdatePage.jsx (VERSÃO COM FILTRO DE NOME/CPF CORRIGIDO)
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

  // --- FILTRO INTELIGENTE (VERSÃO CORRIGIDA) ---
  useEffect(() => {
    // 1. Normaliza a busca (remove acentos, minúsculas)
    const normalizedQuery = normalizeString(searchQuery.trim());
    if (!normalizedQuery) {
      setFilteredPersonnel(personnel);
      return;
    }
    
    // 2. Cria uma versão da busca SÓ com dígitos para o CPF
    const normalizedQueryCpf = normalizedQuery.replace(/\D/g, '');

    const filtered = personnel.filter(person => {
      // 3. Compara o NOME
      const nameMatch = normalizeString(person.name).includes(normalizedQuery);
      
      // 4. Compara o CPF (com a correção)
      let cpfMatch = false; // Começa como falso
      
      // 5. SÓ tenta buscar no CPF se a busca com dígitos (normalizedQueryCpf) não for vazia
      if (normalizedQueryCpf.length > 0) { 
        cpfMatch = (person.cpf || '').replace(/\D/g, '').includes(normalizedQueryCpf);
      }
      
      // Retorna verdadeiro se achar no NOME ou no CPF
      return nameMatch || cpfMatch;
    });
    setFilteredPersonnel(filtered);
  }, [searchQuery, personnel]);

  // --- FUNÇÃO DE SINCRONIZAÇÃO EM SEGUNDO PLANO ---
  const handleOnlineSync = () => {
    setIsSyncing(true);
    setAlertMessage('Sincronização iniciada em segundo plano...'); 

    const performSync = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/sync/master-data`);
        const { waiters: onlinePersonnel, events: onlineEvents } = response.data;
        
        const localPersonnel = JSON.parse(localStorage.getItem('master_waiters')) || [];
        const localCpfSet = new Set(localPersonnel.map(w => w.cpf.trim()));
        let newPersonnelCount = 0;
        
        onlinePersonnel.forEach(onlinePerson => {
          if (onlinePerson.cpf && !localCpfSet.has(onlinePerson.cpf.trim())) {
            localPersonnel.push(onlinePerson);
            newPersonnelCount++;
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
              if (existingEvent.active !== onlineEvent.active) {
                existingEvent.active = onlineEvent.active;
                updatedEventsCount++;
              }
            } else {
              localEventsMap.set(onlineEvent.name, onlineEvent);
              newEventsCount++;
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

        setAlertMessage(`Sincronização concluída!\n- Funcionários: ${newPersonnelCount} novo(s) adicionado(s).\n- Eventos: ${newEventsCount} novo(s) adicionado(s) e ${updatedEventsCount} status atualizado(s).`);

      } catch (error) {
        console.error("Erro na sincronização online:", error);
        setAlertMessage("Falha ao sincronizar. Verifique o backend e a conexão.");
      } finally {
        setIsSyncing(false);
      }
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
          let existingCount = 0;
          
          newPersonnelRaw.forEach(row => {
            const cleanPersonnel = {
                cpf: String(row.CPF || row.cpf || '').trim(),
                name: String(row.NOME || row.name || '').trim()
            };

            if (cleanPersonnel.cpf && cleanPersonnel.name && !existingCpfSet.has(cleanPersonnel.cpf)) {
              existingPersonnel.push(cleanPersonnel);
              existingCpfSet.add(cleanPersonnel.cpf);
              addedCount++;
            } else if (cleanPersonnel.cpf) { 
              existingCount++; 
            }
          });

          localStorage.setItem('master_waiters', JSON.stringify(existingPersonnel));
          existingPersonnel.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
          setPersonnel(existingPersonnel); 
          feedbackMessages.push(`${addedCount} novo(s) funcionário(s) adicionado(s). ${existingCount} já possuía(m) cadastro.`);
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
                const status = String(newEvent.STATUS || 'ATIVO').toUpperCase() === 'ATIVO';
                existingEvents.push({ name: eventName, active: status });
                addedCount++;
              }
            });
            localStorage.setItem('master_events', JSON.stringify(existingEvents));
            existingEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'pt-BR'));
            setEvents(existingEvents);
            feedbackMessages.push(`${addedCount} novo(s) evento(s) adicionado(s).`);
        }

        if (feedbackMessages.length > 0) { alert(feedbackMessages.join('\n')); }
        else { 
            alert('Nenhuma aba válida ("Funcionarios", "Garcons" ou "Eventos") encontrada na planilha para importar.'); 
        }
        
        setFileName('');
        setSelectedFile(null);
        document.getElementById('file-upload').value = null;
      } catch (error) { 
          console.error("Erro detalhado ao processar planilha:", error); 
          alert('Ocorreu um erro ao ler o arquivo. Verifique o console para mais detalhes.'); 
      }
    };
    reader.readAsBinaryString(selectedFile);
  };
  
  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const personnelSheet = workbook.addWorksheet('Funcionarios');
    personnelSheet.columns = [{ header: 'CPF', key: 'cpf', width: 20 }, { header: 'NOME', key: 'name', width: 40 }];
    personnelSheet.addRow({ cpf: '111.222.333-44', name: 'Exemplo de Funcionário 1' });
    const eventsSheet = workbook.addWorksheet('Eventos');
    eventsSheet.columns = [{ header: 'NOME DO EVENTO', key: 'name', width: 50 }, { header: 'STATUS', key: 'status', width: 20}];
    eventsSheet.addRow({ name: 'Exemplo de Evento A', status: 'ATIVO' });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Modelo_Cadastro_Funcionarios_Eventos.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleUpdateOnlineBase = async () => {
    if (!selectedFile) {
      alert('Por favor, selecione um arquivo de planilha primeiro.');
      return;
    }
    setIsUpdatingOnline(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let personnelToUpdate = []; 
        let eventsToUpdate = [];

        const personnelSheet = workbook.Sheets['Funcionarios'] || workbook.Sheets['Garcons'];
        
        if (personnelSheet) {
          const newPersonnel = XLSX.utils.sheet_to_json(personnelSheet);
          newPersonnel.forEach(person => {
            const cleanCpf = String(person.CPF || person.cpf || '').trim();
            if (cleanCpf) {
              personnelToUpdate.push({
                cpf: cleanCpf,
                name: String(person.NOME || person.name || '').trim()
              });
            }
          });
        }
        if (workbook.Sheets['Eventos']) {
          const eventsSheet = workbook.Sheets['Eventos'];
          const newEvents = XLSX.utils.sheet_to_json(eventsSheet);
          newEvents.forEach(event => {
            const eventName = String(event['NOME DO EVENTO'] || '').trim();
            if (eventName) {
              eventsToUpdate.push({
                name: eventName,
                active: String(event.STATUS || 'ATIVO').toUpperCase() === 'ATIVO'
              });
            }
          });
        }
        if (personnelToUpdate.length === 0 && eventsToUpdate.length === 0) {
            alert('Nenhum dado de funcionário ou evento válido foi encontrado na planilha para enviar.');
            setIsUpdatingOnline(false);
            return;
        }
        
        const response = await axios.post(`${API_URL}/api/update-base`, {
          waiters: personnelToUpdate, // A API ainda espera 'waiters'
          events: eventsToUpdate,
        });
        
        alert(response.data.message); 
        setFileName('');
        setSelectedFile(null);
        document.getElementById('file-upload').value = null;
      } catch (error) {
        console.error("Erro ao atualizar base online:", error);
        const errorMessage = error.response ? error.response.data.message : 'Ocorreu um erro ao se comunicar com o servidor.';
        alert(`Falha na atualização: ${errorMessage}`);
      } finally {
        setIsUpdatingOnline(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleToggleEventStatus = async (eventName) => {
    setUpdatingEvent(eventName);
    const originalEvents = [...events];
    const updatedEvents = events.map(event => {
      if (event.name === eventName) {
        return { ...event, active: !event.active };
      }
      return event;
    });
    updatedEvents.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
    setEvents(updatedEvents);
    localStorage.setItem('master_events', JSON.stringify(updatedEvents));
    try {
      const eventToUpdate = updatedEvents.find(e => e.name === eventName);
      await axios.post(`${API_URL}/api/update-event-status`, {
        name: eventToUpdate.name,
        active: eventToUpdate.active,
      });
    } catch (error) {
      console.error('Erro ao sincronizar status do evento:', error);
      alert('Falha ao sincronizar a alteração com a base online. O status foi salvo localmente.');
      setEvents(originalEvents);
      localStorage.setItem('master_events', JSON.stringify(originalEvents));
    } finally {
      setUpdatingEvent(null);
    }
  };

  return (
    <div className="update-container">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      <h1 className="update-title">Atualizar e Gerenciar Dados</h1>
      <div className="online-sync-section">
        <button onClick={handleOnlineSync} className="sync-button" disabled={isSyncing || isUpdatingOnline}>
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar com Planilha Online'}
        </button>
      </div>
      <div className="tab-navigation">
        <button className={`tab-button ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>Importar de Arquivo</button>
        <button className={`tab-button ${activeTab === 'consult' ? 'active' : ''}`} onClick={() => setActiveTab('consult')}>Consultar Funcionários</button>
        <button className={`tab-button ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>Gerenciar Eventos</button>
      </div>
      {activeTab === 'import' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>Passo 1: Baixar o Modelo</h2>
            <p>Baixe a planilha modelo, preencha com seus dados e salve no seu computador.</p>
            <button onClick={handleDownloadTemplate} className="download-button">Baixar Modelo (.xlsx)</button>
          </div>
          <div className="update-card full-width">
            <h2>Passo 2: Enviar a Planilha Preenchida</h2>
            <p>Selecione o arquivo que você preencheu para carregar os dados no sistema.</p>
            <label htmlFor="file-upload" className="file-upload-label">{fileName || 'Clique aqui para escolher a planilha'}</label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            <div className="action-buttons-container">
              <button onClick={handleImportData} className="update-button" disabled={!selectedFile || isUpdatingOnline}>
                Importar Apenas Local
              </button>
              <button onClick={handleUpdateOnlineBase} className="update-base-button" disabled={!selectedFile || isUpdatingOnline}>
                {isUpdatingOnline ? 'Atualizando Online...' : 'Atualizar Base Online'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'consult' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>Consultar Funcionários Cadastrados</h2>
            <div className="search-container">
              <input type="text" placeholder="🔎 Buscar por nome ou CPF..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>CPF</th><th>Nome</th></tr></thead>
                <tbody>
                  {filteredPersonnel.length > 0 ? (
                    filteredPersonnel.map(person => (
                      <tr key={person.cpf}><td>{person.cpf}</td><td>{person.name}</td></tr>
                    ))
                  ) : ( 
                    <tr><td colSpan="2">Nenhum funcionário encontrado para a sua busca.</td></tr> 
                  )}
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
            <p>Ative ou desative os eventos que devem aparecer na tela de seleção.</p>
            <div className="event-list">
              {events.length > 0 ? (
                events.map(event => (
                  <div key={event.name} className="event-item">
                    <span>{event.name}</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={event.active} 
                        onChange={() => handleToggleEventStatus(event.name)}
                        disabled={updatingEvent === event.name} 
                      />
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
        Voltar para Seleção de Evento
      </button>
    </div>
  );
}

export default DataUpdatePage;