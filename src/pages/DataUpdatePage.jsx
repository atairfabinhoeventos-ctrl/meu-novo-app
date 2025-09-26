// src/pages/DataUpdatePage.jsx (VERSÃO COMPLETA E CORRIGIDA)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './DataUpdatePage.css';

function DataUpdatePage() {
  const [activeTab, setActiveTab] = useState('import');
  const [waiters, setWaiters] = useState([]);
  const [filteredWaiters, setFilteredWaiters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [events, setEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const storedEvents = JSON.parse(localStorage.getItem('master_events')) || [];
    const cleanEvents = storedEvents.filter(event => event && event.name && event.name.trim() !== '');
    setEvents(cleanEvents);
    const storedWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
    setWaiters(storedWaiters);
    setFilteredWaiters(storedWaiters);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredWaiters(waiters);
    } else {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = waiters.filter(waiter => 
        waiter.name.toLowerCase().includes(lowercasedQuery) ||
        waiter.cpf.replace(/\D/g, '').includes(lowercasedQuery.replace(/\D/g, ''))
      );
      setFilteredWaiters(filtered);
    }
  }, [searchQuery, waiters]);

  const handleOnlineSync = async () => {
    setIsSyncing(true);
    try {
      const [waitersResponse, eventsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/sync/waiters`),
        axios.get(`${API_URL}/api/sync/events`)
      ]);

      const onlineWaiters = waitersResponse.data;
      const onlineEvents = eventsResponse.data;

      const localWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
      const localCpfSet = new Set(localWaiters.map(w => w.cpf.trim()));
      let newWaitersCount = 0;
      onlineWaiters.forEach(onlineWaiter => {
        if (onlineWaiter.cpf && !localCpfSet.has(onlineWaiter.cpf.trim())) {
          localWaiters.push(onlineWaiter);
          newWaitersCount++;
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

      localStorage.setItem('master_waiters', JSON.stringify(localWaiters));
      localStorage.setItem('master_events', JSON.stringify(mergedEvents));
      setWaiters(localWaiters);
      setEvents(mergedEvents);

      alert(`Sincronização concluída!\n- Garçons: ${newWaitersCount} novo(s) adicionado(s).\n- Eventos: ${newEventsCount} novo(s) adicionado(s) e ${updatedEventsCount} status atualizado(s).`);

    } catch (error) {
      console.error("Erro na sincronização online:", error);
      alert("Falha ao sincronizar. Verifique o backend e a conexão.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const waitersSheet = workbook.addWorksheet('Garcons');
    waitersSheet.columns = [{ header: 'CPF', key: 'cpf', width: 20 }, { header: 'NOME', key: 'name', width: 40 }];
    waitersSheet.addRow({ cpf: '111.222.333-44', name: 'Exemplo de Garçom 1' });
    const eventsSheet = workbook.addWorksheet('Eventos');
    eventsSheet.columns = [{ header: 'NOME DO EVENTO', key: 'name', width: 50 }];
    eventsSheet.addRow({ name: 'Exemplo de Evento A' });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Modelo_Cadastro_Garçons_Eventos.xlsx');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleImportData = () => {
    if (!selectedFile) { alert('Por favor, selecione um arquivo de planilha primeiro.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        let feedbackMessages = [];

        if (workbook.Sheets['Garcons']) {
          const waitersSheet = workbook.Sheets['Garcons'];
          const newWaiters = XLSX.utils.sheet_to_json(waitersSheet);
          const existingWaiters = JSON.parse(localStorage.getItem('master_waiters')) || [];
          const existingCpfSet = new Set(existingWaiters.map(w => w.cpf.trim()));
          let addedCount = 0;
          let existingCount = 0;
          newWaiters.forEach(newWaiter => {
            const cleanCpf = String(newWaiter.CPF || '').trim();
            if (cleanCpf && !existingCpfSet.has(cleanCpf)) {
              existingWaiters.push({ cpf: cleanCpf, name: String(newWaiter.NOME || '').trim() });
              addedCount++;
            } else { existingCount++; }
          });
          localStorage.setItem('master_waiters', JSON.stringify(existingWaiters));
          setWaiters(existingWaiters);
          feedbackMessages.push(`${addedCount} novo(s) garçom(ns) adicionado(s). ${existingCount} já possuía(m) cadastro.`);
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
                existingEvents.push({ name: eventName, active: true });
                addedCount++;
              }
            });
            localStorage.setItem('master_events', JSON.stringify(existingEvents));
            setEvents(existingEvents);
            feedbackMessages.push(`${addedCount} novo(s) evento(s) adicionado(s).`);
        }
        if (feedbackMessages.length > 0) { alert(feedbackMessages.join('\n')); }
        else { alert('Nenhuma aba ("Garcons" ou "Eventos") encontrada na planilha para importar.'); }
        setFileName('');
        setSelectedFile(null);
      } catch (error) { console.error("Erro detalhado ao processar planilha:", error); alert('Ocorreu um erro ao ler o arquivo.'); }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleToggleEventStatus = (eventName) => {
  const updatedEvents = events.map(event => {
    if (event.name === eventName) {
      return { ...event, active: !event.active };
    }
    return event;
  });
  setEvents(updatedEvents); // Atualiza o estado da tela
  localStorage.setItem('master_events', JSON.stringify(updatedEvents)); // Salva a mudança
};

  return (
    <div className="update-container">
      <h1 className="update-title">Atualizar e Gerenciar Dados</h1>

      <div className="online-sync-section">
        <button onClick={handleOnlineSync} className="sync-button" disabled={isSyncing}>
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar com Planilha Online'}
        </button>
      </div>

      <div className="tab-navigation">
        <button className={`tab-button ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>Importar de Arquivo</button>
        <button className={`tab-button ${activeTab === 'consult' ? 'active' : ''}`} onClick={() => setActiveTab('consult')}>Consultar Garçons</button>
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
            <h2>Passo 2: Importar a Planilha Preenchida</h2>
            <p>Selecione o arquivo que você preencheu para carregar os dados no sistema.</p>
            <label htmlFor="file-upload" className="file-upload-label">{fileName || 'Clique aqui para escolher a planilha'}</label>
            <input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
            <button onClick={handleImportData} className="update-button" disabled={!selectedFile}>Importar Dados</button>
          </div>
        </div>
      )}

      {activeTab === 'consult' && (
        <div className="tab-content">
          <div className="update-card full-width">
            <h2>Consultar Garçons Cadastrados</h2>
            <div className="search-container">
              <input type="text" placeholder="🔎 Buscar por nome ou CPF..." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>CPF</th><th>Nome</th></tr></thead>
                <tbody>
                  {filteredWaiters.length > 0 ? (
                    filteredWaiters.map(waiter => (
                      <tr key={waiter.cpf}><td>{waiter.cpf}</td><td>{waiter.name}</td></tr>
                    ))
                  ) : ( <tr><td colSpan="2">Nenhum garçom encontrado.</td></tr> )}
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
                      <input type="checkbox" checked={event.active} onChange={() => handleToggleEventStatus(event.name)} />
                      <span className="slider round"></span>
                    </label>
                  </div>
                ))
              ) : ( <p style={{textAlign: 'center', color: '#888'}}>Nenhum evento cadastrado.</p> )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataUpdatePage;