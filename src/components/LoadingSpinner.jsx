import React from 'react';

// Este componente recebe uma propriedade 'message' para exibir um texto customizado.
function LoadingSpinner({ message = 'Carregando...' }) {
  return (
    <div className="modal-overlay">
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default LoadingSpinner;