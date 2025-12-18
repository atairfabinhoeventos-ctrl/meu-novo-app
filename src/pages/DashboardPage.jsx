// src/pages/DashboardPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardPage.css';

function DashboardPage() {
  const navigate = useNavigate();

  // Componente interno para os cards do painel
  const Card = ({ to, icon, title, description, className }) => (
    <div 
      onClick={() => navigate(to)} 
      className={`dashboard-card ${className}`} 
      style={{cursor: 'pointer'}}
    >
      <div className="card-icon">{icon}</div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Painel de Controle SisFO</h1>
      
      <div className="dashboard-grid">
        {/* Módulo Financeiro - Cor Azul Padrão Atualizada */}
        <Card 
          to="/financial-selection" 
          icon="💰" 
          title="Módulo Financeiro" 
          description="Acesse para realizar fechamentos de garçons, caixas e consultar históricos de eventos." 
          className="finance-card" 
        />

        {/* Módulo de Nuvem */}
        <Card 
          to="/cloud-sync" 
          icon="☁️" 
          title="Enviar para Nuvem" 
          description="Envie os fechamentos salvos localmente para a planilha consolidada online." 
          className="cloud-card" 
        />

        {/* Módulo de Exportação */}
        <Card 
          to="/export-data" 
          icon="📤" 
          title="Exportar Dados" 
          description="Gere planilhas a partir dos dados salvos localmente ou dos registros na nuvem." 
          className="export-card" 
        />
        
        {/* Módulo de Atualização de Dados */}
        <Card 
          to="/update-data" 
          icon="🔄" 
          title="Atualizar Dados" 
          description="Cadastre novos garçons e eventos no sistema através de planilhas Excel." 
          className="update-data-card" 
        />

        {/* NOVO MÓDULO: TREINAMENTOS */}
        <Card 
          to="/training" 
          icon="🎓" 
          title="Treinamentos" 
          description="Acesse tutoriais passo a passo, vídeos e manuais de boas práticas do sistema." 
          className="training-card" 
        />
        
        {/* Módulo Administrativo */}
        <Card 
          to="/admin" 
          icon="🛡️" 
          title="Administrador" 
          description="Ferramentas avançadas, conciliação de dados e gerenciamento do sistema." 
          className="admin-card" 
        />
      </div>
    </div>
  );
}

export default DashboardPage;