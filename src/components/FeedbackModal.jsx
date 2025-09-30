import React from 'react';
import './FeedbackModal.css';

function FeedbackModal({ isOpen, onClose, title, message, status }) {
  if (!isOpen) {
    return null;
  }

  const isSuccess = status === 'success';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`feedback-icon ${isSuccess ? 'success' : 'error'}`}>
          {isSuccess ? '✔' : '✖'}
        </div>
        <h2 className="feedback-title">{title}</h2>
        <p className="feedback-text" dangerouslySetInnerHTML={{ __html: message }}></p>
        <div className="modal-buttons">
          <button 
            className={`feedback-close-button ${isSuccess ? 'success-btn' : 'error-btn'}`} 
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;