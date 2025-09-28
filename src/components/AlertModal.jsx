// src/components/AlertModal.jsx

import React from 'react';
import './AlertModal.css';

function AlertModal({ message, onClose }) {
  if (!message) {
    return null;
  }

  return (
    <div className="alert-modal-overlay">
      <div className="alert-modal-content">
        <h3 className="alert-modal-title">Atenção!</h3>
        <p className="alert-modal-message">{message}</p>
        <button className="alert-modal-button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

export default AlertModal;