// src/pages/DashboardPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();
  const Card = ({ to, icon, title, description, className }) => (
    <div onClick={() => navigate(to)} className={`dashboard-card ${className}`} style={{cursor: 'pointer'}}>
      <div className="card-icon">{icon}</div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Painel de Controle SisFO</h1>
      <div className="dashboard-grid">
        <Card to="/event-selection" icon="💰" title="Módulo Financeiro" description="Acesse para realizar fechamentos de garçons, caixas e consultar históricos de eventos." className="finance-card" />
        <Card to="/cloud-sync" icon="☁️" title="Enviar para Nuvem" description="Envie os fechamentos salvos localmente para a planilha consolidada online." className="cloud-card" />
        <Card to="/export-data" icon="📤" title="Exportar Dados Locais" description="Gere uma planilha consolidada com todos os fechamentos que foram salvos localmente." className="export-card" />
        <Card to="/update-data" icon="🔄" title="Atualizar Dados" description="Cadastre novos garçons e eventos no sistema através de uma planilha." className="update-card" />
      </div>
    </div>
  );
}

export default DashboardPage;