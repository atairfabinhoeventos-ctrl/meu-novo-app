import React from 'react';

const UpdateModal = ({ storeLink }) => {
  
  const handleUpdateClick = () => {
    if (storeLink && storeLink.length > 4 && !storeLink.startsWith('http')) {
        window.open(`ms-windows-store://pdp/?ProductId=${storeLink}`);
    } else if (storeLink && storeLink.startsWith('ms-windows-store')) {
        window.open(storeLink);
    } else {
        window.open('ms-windows-store://downloadsandupdates');
    }
  };

  return (
    <div className="update-overlay">
      <div className="update-card">
        
        {/* CABEÇALHO */}
        <div className="brand-section">
            <img src="/logo2.png" alt="SisFO Logo" className="brand-logo" />
            <div className="system-name">
                <h1>SisFO</h1>
                <p>SISTEMA DE FECHAMENTO OPERACIONAL</p>
            </div>
        </div>

        {/* FAIXA DE ALERTA */}
        <div className="alert-banner">
            ⚠️ ATUALIZAÇÃO OBRIGATÓRIA ⚠️
        </div>

        <div className="card-content">
            {/* TEXTO AGORA 100% BRANCO E SEM SOMBRA */}
            <p className="update-message">
              Uma nova versão foi detectada na Microsoft Store. 
              <br/>
              Para continuar, é necessário atualizar o sistema.
            </p>
            
            <div className="button-wrapper">
                <button className="ms-store-btn" onClick={handleUpdateClick}>
                    <div className="ms-icon-grid">
                        <div style={{background:'#f25022'}}></div>
                        <div style={{background:'#7fba00'}}></div>
                        <div style={{background:'#00a4ef'}}></div>
                        <div style={{background:'#ffb900'}}></div>
                    </div>
                    
                    <div className="btn-text">
                        <span>Disponível na</span>
                        <strong>Microsoft Store</strong>
                    </div>
                </button>
                
                {/* TEXTO DE BAIXO TAMBÉM BRANCO */}
                <p className="update-hint">
                   O sistema fechará automaticamente após o clique.
                </p>
            </div>
        </div>
      </div>

      <style>{`
        .update-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.4s ease-out;
        }

        .update-card {
            background: linear-gradient(135deg, #0e1b2a 0%, #1E63B8 100%);
            width: 100%;
            max-width: 550px;
            border-radius: 25px;
            overflow: hidden;
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
            display: flex;
            flex-direction: column;
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
            animation: slideUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        /* Bolas de Fundo */
        .update-card::before {
            content: ''; position: absolute; top: -80px; left: -80px; width: 250px; height: 250px;
            background-color: rgba(255, 255, 255, 0.05); border-radius: 50%; pointer-events: none;
        }
        .update-card::after {
            content: ''; position: absolute; bottom: -60px; right: -60px; width: 200px; height: 200px;
            background-color: rgba(255, 255, 255, 0.05); border-radius: 50%; pointer-events: none;
        }

        .brand-section {
            padding: 50px 20px 30px 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            z-index: 2;
        }

        .brand-logo {
            width: 320px;
            height: auto;
            margin-bottom: 20px;
            filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));
        }

        .system-name h1 {
            color: #ffffff;
            margin: 0;
            font-size: 5rem;
            font-weight: 900;
            letter-spacing: -2px;
            line-height: 1;
            text-shadow: 0 4px 15px rgba(0,0,0,0.25);
        }

        .system-name p {
            color: rgba(255, 255, 255, 0.9);
            margin: 10px 0 0 0;
            font-size: 1.1rem;
            font-weight: 600;
            letter-spacing: 3px;
            text-transform: uppercase;
        }

        .alert-banner {
            background-color: #FFC107;
            color: #000;
            font-weight: 900;
            text-align: center;
            padding: 15px;
            font-size: 1.3rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            position: relative;
            z-index: 2;
        }

        .card-content {
            padding: 40px;
            text-align: center;
            position: relative;
            z-index: 2;
        }

        /* --- CORREÇÃO DO TEXTO --- */
        .update-message {
            font-size: 1.4rem;
            line-height: 1.5;
            margin-bottom: 40px;
            color: #FFFFFF; /* Branco Puro */
            font-weight: 600;
            text-shadow: none; /* Remove qualquer sombra cinza */
        }

        .button-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .ms-store-btn {
            background-color: #ffffff;
            color: #000;
            border: none;
            padding: 15px 35px;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            width: 100%;
            max-width: 350px;
            height: 70px;
        }
        
        .ms-store-btn:hover {
            transform: scale(1.03);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            background-color: #f8f9fa;
        }

        .ms-icon-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 32px; height: 32px;
        }
        .ms-icon-grid div { width: 100%; height: 100%; }

        .btn-text {
            display: flex; flex-direction: column; align-items: flex-start; text-align: left; line-height: 1.2;
        }
        .btn-text span { font-size: 0.85rem; color: #444; text-transform: uppercase; font-weight: 600; }
        .btn-text strong { font-size: 1.3rem; font-weight: 800; color: #000; }

        /* --- CORREÇÃO DO TEXTO DE HINT --- */
        .update-hint {
            font-size: 0.95rem;
            color: #effd2dff; /* Branco Puro */
            margin: 0;
            font-style: italic;
            opacity: 1; /* Sem transparência */
            text-shadow: none; /* Sem sombra */
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default UpdateModal;