import React from 'react';
import '../pages/LoginPage.css'; // Reutilizando estilos de botão/card

const UpdateModal = ({ storeLink }) => {
  const handleUpdateClick = () => {
    if (storeLink) {
        // Abre o link da loja no navegador padrão
        window.open(storeLink, '_blank'); 
    } else {
        // Tenta abrir a loja da Microsoft genericamente
        window.open('ms-windows-store://home', '_blank');
    }
  };

  return (
    <div className="modal-overlay" style={{zIndex: 9999}}>
      <div className="modal-content" style={{textAlign: 'center', maxWidth: '400px'}}>
        <div style={{fontSize: '50px', marginBottom: '10px'}}>🚀</div>
        <h2 style={{color: '#1E63B8'}}>Nova Versão Disponível!</h2>
        <p style={{margin: '20px 0', color: '#555', lineHeight: '1.5'}}>
          Uma atualização importante foi lançada na Microsoft Store. 
          Para continuar utilizando todas as funcionalidades e correções, por favor atualize o sistema.
        </p>
        
        <div className="modal-buttons" style={{flexDirection: 'column', gap: '10px'}}>
            <button className="login-button" onClick={handleUpdateClick}>
                📲 Atualizar Agora
            </button>
            <p style={{fontSize: '11px', color: '#999', marginTop: '10px'}}>
                Após clicar, feche este aplicativo para que a atualização ocorra.
            </p>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;