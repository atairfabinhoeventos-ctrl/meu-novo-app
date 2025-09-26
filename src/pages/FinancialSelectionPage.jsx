// src/pages/FinancialSelectionPage.js (Simplificado, sem pop-up)

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './FinancialSelectionPage.css';

function FinancialSelectionPage() {
  const navigate = useNavigate();
  const [activeEvent, setActiveEvent] = useState('');

  useEffect(() => {
    const event = localStorage.getItem('activeEvent');
    if (event) {
      setActiveEvent(event);
    } else {
      navigate('/event-selection');
    }
  }, [navigate]);

  // Componente interno para os cards
  const Card = ({ to, icon, title, description }) => (
    <Link to={to} className="menu-card">
      <div className="card-icon">{icon}</div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
    </Link>
  );

  return (
    <div className="menu-container">
      <div className="menu-header">
        <h1 className="menu-title">Módulo Financeiro</h1>
        <p className="menu-subtitle">Evento Ativo: <strong>{activeEvent}</strong></p>
      </div>
      
      <div className="menu-grid">
        <Card
          to="/waiter-closing" // Navega diretamente
          icon="👨‍💼"
          title="Fechamento Garçom 8%"
          description="Lançamento de vendas e cálculo de comissão de 8%/4%."
        />
        <Card
          to="/waiter-closing-10"
          icon="💼"
          title="Fechamento Garçom 10%"
          description="Lançamento com cálculo de comissão de 10%."
        />
        <Card
          to="/mobile-cashier-closing"
          icon="📱"
          title="Fechamento Caixa Móvel"
          description="Fechamento individual para caixas com máquinas móveis."
        />
        <Card
          to="/fixed-cashier-closing"
          icon="🏧"
          title="Fechamento Caixa Fixo"
          description="Fechamento consolidado para caixas fixos em grupo."
        />
         <Card
          to="/closing-history"
          icon="📊"
          title="Consultar Fechamentos"
          description="Visualize o histórico de todos os fechamentos do evento."
        />
      </div>
    </div>
  );
}

export default FinancialSelectionPage;