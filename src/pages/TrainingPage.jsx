import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './TrainingPage.css';

const TrainingPage = () => {
  const navigate = useNavigate();
  
  // Controle de Navegação e Estados - Iniciando em 'home'
  const [activeTrack, setActiveTrack] = useState('home'); 
  const [step, setStep] = useState(0);
  const [subModule, setSubModule] = useState('waiter8'); 

  // Configuração das Trilhas
  const tracks = {
    home: [{ title: "SisFO Academy", inst: "Bem-vindo! Selecione um treinamento no menu lateral para começar.", screen: "home-screen" }],
    acesso: [
      { title: "Identificação do Operador", inst: "Introduza o nome e aceite os termos da LGPD (Padrão SisFO).", screen: "login" },
      { title: "Dashboard Principal", inst: "Este é o painel oficial. Clique no Módulo Financeiro para continuar.", screen: "dash" }
    ],
    evento: [
      { title: "Configuração de Evento", inst: "Selecione o evento ativo para carregar as tabelas de preços.", screen: "setup" }
    ],
    financeiro: [
      { title: "Painel Financeiro", inst: "Escolha o perfil operacional conforme a imagem oficial do sistema.", screen: "fin-grid" },
      { title: "Lançamento de Dados", inst: "Preencha os campos. O sistema calcula o saldo automaticamente com base no módulo.", screen: "fin-form" },
      { title: "Recibo Meia Folha A4", inst: "Confira o comprovante de 3 colunas gerado para conferência.", screen: "receipt-a4" }
    ],
    novo_evento: [{ title: "Módulo em Construção", inst: "Área de cadastro em manutenção.", screen: "const" }],
    recibos_massa: [{ title: "Módulo em Construção", inst: "Impressão em lote em manutenção.", screen: "const" }],
    nuvem: [{ title: "Módulo em Construção", inst: "Sincronização Cloud em manutenção.", screen: "const" }]
  };

  const currentSteps = tracks[activeTrack];
  const handleNext = () => step < currentSteps.length - 1 && setStep(step + 1);
  const handlePrev = () => step > 0 && setStep(step - 1);

  const renderVirtualScreen = () => {
    const s = currentSteps[step].screen;

    switch (s) {
      case 'home-screen': return (
        <div className="v-sandbox v-blue-bg">
          <div className="v-home-content">
            <h1>SisFO <span className="txt-yellow">Academy</span> 📖</h1>
          </div>
        </div>
      );

      case 'login': return (
        <div className="v-sandbox v-blue-bg">
          <div className="v-login-card spotlight">
            <div className="v-l-left"><img src="logo2.png" alt="" /><h1>SisFO</h1></div>
            <div className="v-l-right">
              <label>OPERADOR</label>
              <input type="text" readOnly value="OPERADOR ACADEMY" />
              <div className="v-check"><input type="checkbox" checked readOnly /> <span>Aceito LGPD</span></div>
              <button className="v-btn-blue on">ACESSAR</button>
            </div>
          </div>
        </div>
      );

      case 'setup': return (
        <div className="v-sandbox v-gray-bg">
          <div className="v-setup-card spotlight">
            <div className="v-s-left"><img src="logo2.png" alt="" /><h1>SisFO</h1></div>
            <div className="v-s-right">
              <header><h3>Setup de Evento</h3></header>
              <div className="v-fld"><label>SELECIONE O EVENTO ATIVO:</label><select className="v-input"><option>EVENTO TESTE 1.4.4 - GOIÂNIA</option></select></div>
              <button className="v-btn-blue on">CONFIRMAR</button>
            </div>
          </div>
        </div>
      );

      case 'dash': return (
        <div className="v-sandbox v-gray-bg v-flex-col">
          <header className="v-header-real"><img src="logo2.png" alt="" /> <span>Painel Administrativo</span></header>
          <div className="v-dash-grid">
            <div className="v-card-real ds-fin spotlight">💰 Financeiro</div>
            <div className="v-card-real ds-cloud">☁️ Nuvem</div>
            <div className="v-card-real ds-adm">🛡️ Admin</div>
            <div className="v-card-real ds-upd">🔄 Dados</div>
            <div className="v-card-real ds-trn">🎓 Academy</div>
            <div className="v-card-real ds-exp">📤 Exportar</div>
          </div>
        </div>
      );

      case 'fin-grid': return (
        <div className="v-sandbox v-gray-bg v-flex-col">
          <header className="v-header-real"><img src="logo2.png" alt="" /> <div className="v-h-info"><span>Usuário: Academy</span></div></header>
          <div className="v-fin-title">Módulo Financeiro</div>
          <div className="v-fin-grid spotlight">
            <div className="v-fin-card" onClick={() => {setSubModule('waiter8'); handleNext();}}>👤 <strong>Garçom 8%</strong></div>
            <div className="v-fin-card" onClick={() => {setSubModule('mobile'); handleNext();}}>📱 <strong>Caixa Móvel</strong></div>
            <div className="v-fin-card" onClick={() => {setSubModule('fixed'); handleNext();}}>🏧 <strong>Caixa Fixo</strong></div>
            <div className="v-fin-card" onClick={() => {setSubModule('waiter10'); handleNext();}}>💼 <strong>Garçom 10%</strong></div>
            <div className="v-fin-card" onClick={() => {setSubModule('zig'); handleNext();}}>💳 <strong>ZIG Cash 8%</strong></div>
            <div className="v-fin-card">📊 <strong>Consultar</strong></div>
          </div>
        </div>
      );

      case 'fin-form': return (
        <div className="v-sandbox v-gray-bg v-flex-col">
          <header className="v-header-real"><img src="logo2.png" alt="" /> <span>{subModule.toUpperCase()}</span></header>
          <div className="v-form-real spotlight">
            <div className="form-section">
              <div className="form-row">
                <div className="input-group"><label>Buscar Colaborador</label><input readOnly value="JOSÉ SILVA" /></div>
              </div>
              <div className="form-row">
                <div className="input-group"><label>Identificação</label><input readOnly value={subModule === 'fixed' ? 'GRUPO 01' : 'Camiseta 14'} /></div>
                {subModule === 'zig' ? 
                  <div className="input-group"><label>Venda Produtos (ZIG)</label><input className="highlighted-input" readOnly value="R$ 800,00" /></div> :
                  <div className="input-group"><label>Máquina POS</label><input readOnly value="POS-01" /></div>
                }
              </div>
            </div>
            <div className="results-container">
              <p className="total-text">Status: <strong style={{color: '#1E63B8'}}>PAGAR AO GARÇOM R$ 124,00</strong></p>
            </div>
          </div>
        </div>
      );

      case 'receipt-a4': return (
        <div className="v-sandbox v-overlay">
          <div className="v-a4-paper spotlight">
            <div className="v-a4-header">
              <img src="logo2.png" style={{height: '80px'}} alt="" />
              <div className="v-a4-title">RECIBO DE FECHAMENTO<br/><small>Prot: #2025-ACAD-88</small></div>
            </div>
            <div className="v-a4-grid">
               <div className="v-a4-col" style={{flex: '1.3'}}><strong>ID:</strong> José Silva<br/>CPF: 000.000...</div>
               <div className="v-a4-col" style={{flex: '0.9'}}><strong>COMISSÃO:</strong> R$ 84,00</div>
               <div className="v-a4-col" style={{flex: '0.8'}}><strong>RESULTADO:</strong> PAGAR R$ 124,00</div>
            </div>
            <div className="v-a4-sigs"><div className="v-sig">Freelancer</div><div className="v-sig">Conferente</div></div>
          </div>
        </div>
      );

      case 'const': return (
        <div className="v-sandbox v-blue-bg">
          <div className="v-const-card">
            <div className="v-const-icon">🚧</div>
            <h2>Módulo em Construção</h2>
            <p>Trabalhando para disponibilizar esta função.</p>
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="ac-root">
      <aside className="ac-sidebar">
        <div className="ac-logo">
          <h2>SisFO <span className="txt-yellow">Academy</span></h2>
        </div>
        <nav className="ac-nav">
          <button className={activeTrack === 'home' ? 'on' : ''} onClick={() => {setActiveTrack('home'); setStep(0);}}>🏠 Home</button>
          <button className={activeTrack === 'acesso' ? 'on' : ''} onClick={() => {setActiveTrack('acesso'); setStep(0);}}>🔐 Acesso ao Sistema</button>
          <button className={activeTrack === 'evento' ? 'on' : ''} onClick={() => {setActiveTrack('evento'); setStep(0);}}>📅 Seleção de Evento</button>
          <button className={activeTrack === 'financeiro' ? 'on' : ''} onClick={() => {setActiveTrack('financeiro'); setStep(0);}}>💰 Painel Financeiro</button>
          <button className={activeTrack === 'novo_evento' ? 'on' : ''} onClick={() => {setActiveTrack('novo_evento'); setStep(0);}}>➕ Novo Evento</button>
          <button className={activeTrack === 'recibos_massa' ? 'on' : ''} onClick={() => {setActiveTrack('recibos_massa'); setStep(0);}}>🖨️ Recibos em Massa</button>
          <button className={activeTrack === 'nuvem' ? 'on' : ''} onClick={() => {setActiveTrack('nuvem'); setStep(0);}}>☁️ Relatório Nuvem</button>
        </nav>
        <button className="ac-exit" onClick={() => navigate('/dashboard')}>SAIR</button>
      </aside>

      <main className="ac-viewport">
        <header className="ac-top-header">
          <div className="ac-step-info">
            <span className="ac-step-badge">PASSO {step + 1} DE {currentSteps.length}</span>
            <h3>{currentSteps[step].title}</h3>
            <p>{currentSteps[step].inst}</p>
          </div>
          <div className="ac-nav-btns">
            <button className="ac-btn-nav" onClick={handlePrev} disabled={step === 0}>ANTERIOR</button>
            <button className="ac-btn-nav primary" onClick={handleNext}>PRÓXIMO</button>
          </div>
        </header>

        <div className="ac-monitor-container">
          <div className="ac-monitor-bezel">
            <div className="ac-screen-inner">
              {renderVirtualScreen()}
            </div>
          </div>
          <div className="ac-monitor-base"></div>
        </div>
      </main>
    </div>
  );
};

export default TrainingPage;