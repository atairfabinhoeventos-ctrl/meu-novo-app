import React, { useState, useContext } from 'react';
import { LicenseContext } from '../contexts/LicenseContext';
import { activateLicense } from '../services/licenseService';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal'; 
import './ActivationPage.css';

function ActivationPage() {
    const { registerActivation } = useContext(LicenseContext);
    
    const [formData, setFormData] = useState({
        licenseKey: '',
        clientName: '',
        clientDoc: '',
        clientEmail: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [alertInfo, setAlertInfo] = useState({ message: '', isOpen: false });
    const [showSupportModal, setShowSupportModal] = useState(false);

    // --- MÁSCARAS ---
    const handleNameChange = (e) => {
        const val = e.target.value;
        const formatted = val.toLowerCase().replace(/(?:^|\s|['"([{])+\S/g, match => match.toUpperCase());
        setFormData({ ...formData, clientName: formatted });
    };

    const handleKeyChange = (e) => {
        let val = e.target.value.toUpperCase();
        if (val.length > 20) return; 
        setFormData({ ...formData, licenseKey: val });
    };

    const handleCpfChange = (e) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (value.length > 11) value = value.slice(0, 11); 

        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

        setFormData({ ...formData, clientDoc: value });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- VALIDAÇÕES ---
    const validateForm = () => {
        const nameParts = formData.clientName.trim().split(/\s+/);
        if (nameParts.length < 2) {
            setAlertInfo({ isOpen: true, message: 'Por favor, insira o Nome Completo (Nome e Sobrenome).' });
            return false;
        }

        if (!formData.clientEmail.includes('@') || !formData.clientEmail.toLowerCase().includes('.com')) {
            setAlertInfo({ isOpen: true, message: 'Insira um e-mail válido (deve conter @ e .com).' });
            return false;
        }

        if (formData.licenseKey.length !== 20) {
            setAlertInfo({ isOpen: true, message: `A chave deve ter exatamente 20 caracteres. (Atual: ${formData.licenseKey.length})` });
            return false;
        }

        if (formData.clientDoc.length < 14) {
            setAlertInfo({ isOpen: true, message: 'Insira um CPF válido.' });
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);

        try {
            const result = await activateLicense(formData);
            if (result.valid) {
                registerActivation({
                    key: formData.licenseKey,
                    name: formData.clientName,
                    expiration: result.expiration
                });
            }
        } catch (err) {
            setAlertInfo({ isOpen: true, message: err.message || 'Falha na ativação. Verifique os dados.' });
        } finally {
            setLoading(false);
        }
    };

    const closeAlert = () => {
        setAlertInfo({ ...alertInfo, isOpen: false });
    };

    return (
        <div className="activation-wrapper">
            
            {alertInfo.isOpen && (
                <AlertModal 
                    message={alertInfo.message} 
                    onClose={closeAlert} 
                />
            )}

            {showSupportModal && (
                <div className="modal-overlay" onClick={() => setShowSupportModal(false)}>
                    <div className="support-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="support-header">
                            <h3>📞 Contato de Suporte</h3>
                            <button className="close-x-btn" onClick={() => setShowSupportModal(false)}>×</button>
                        </div>
                        <div className="support-body">
                            <p className="support-name">Atair Lagares</p>
                            <p className="support-role">Responsável Técnico</p>
                            <div className="contact-row">
                                <span>📱</span> <strong>+55 (62) 9.8330-3959</strong>
                            </div>
                            <div className="contact-row">
                                <span>✉️</span> <strong>atair@live.com</strong>
                            </div>
                            <div className="support-note">
                                <p>Atendimento em horário comercial.</p>
                                <p>Não possui chave? Entre em contato para liberação.</p>
                            </div>
                            <button className="close-support-btn" onClick={() => setShowSupportModal(false)}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="activation-card">
                {/* LADO ESQUERDO */}
                <div className="activation-left">
                    <div className="brand-area">
                        <img src="/logo2.png" alt="SisFO Logo" className="main-logo" />
                        <h2>SisFO</h2>
                        <p>Sistema de Fechamento Operacional</p>
                    </div>

                    {/* Botão Card para abrir suporte (SEM O ÍCONE AMARELO AGORA) */}
                    <div className="support-trigger-card" onClick={() => setShowSupportModal(true)}>
                        <div className="trigger-text">
                            <strong>Precisa de Ajuda?</strong>
                            <span>Clique para ver dados do Suporte</span>
                        </div>
                    </div>
                </div>

                {/* LADO DIREITO */}
                <div className="activation-right">
                    <h2>Ativação do Produto</h2>
                    <p className="subtitle">Preencha seus dados para liberar o acesso.</p>

                    <form onSubmit={handleSubmit}>
                        
                        <div className="act-input-group">
                            <label>Chave de Licença (20 Dígitos)</label>
                            <input 
                                name="licenseKey"
                                type="text" 
                                className="act-input key-input" 
                                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                                value={formData.licenseKey}
                                onChange={handleKeyChange}
                                maxLength={20}
                                required
                            />
                        </div>

                        <div className="act-input-group">
                            <label>Nome Completo</label>
                            <input 
                                name="clientName"
                                type="text" 
                                className="act-input" 
                                placeholder="Ex: João Silva"
                                value={formData.clientName}
                                onChange={handleNameChange}
                                required
                            />
                        </div>

                        <div style={{display: 'flex', gap: '15px'}}>
                            <div className="act-input-group" style={{flex: 1}}>
                                <label>CPF / CNPJ</label>
                                <input 
                                    name="clientDoc"
                                    type="text" 
                                    className="act-input" 
                                    placeholder="000.000.000-00"
                                    value={formData.clientDoc}
                                    onChange={handleCpfChange}
                                    maxLength={18}
                                    required
                                />
                            </div>
                            <div className="act-input-group" style={{flex: 1.3}}>
                                <label>E-mail</label>
                                <input 
                                    name="clientEmail"
                                    type="email" 
                                    className="act-input" 
                                    placeholder="exemplo@email.com"
                                    value={formData.clientEmail}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="act-button" disabled={loading}>
                            {loading ? 'Verificando Licença...' : 'Validar e Ativar'}
                        </button>
                        
                        {/* AVISO DE INTERNET (NOVO) */}
                        <p className="internet-warning">
                            <span style={{marginRight: '5px'}}>📡</span>
                            Para ativação do produto é necessário conexão com a internet para validação dos dados.
                        </p>
                    </form>

                    {loading && <LoadingSpinner message="Consultando servidor..." />}
                </div>
            </div>
        </div>
    );
}

export default ActivationPage;