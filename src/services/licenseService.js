import axios from 'axios';
import { API_URL } from '../config';

// Gera um ID único persistente para este computador
const getMachineId = () => {
    let mid = localStorage.getItem('sys_machine_id');
    if (!mid) {
        // Gera um ID aleatório + timestamp
        mid = 'ID-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem('sys_machine_id', mid);
    }
    return mid;
};

// Função principal que chama o backend
export const activateLicense = async (data) => {
    // data espera: { licenseKey, clientName, clientDoc, clientEmail }
    try {
        const machineId = getMachineId();
        // Garante que enviamos o machineId junto com os dados
        const payload = { ...data, machineId };
        
        const response = await axios.post(`${API_URL}/api/activate-license`, payload);
        return response.data;
    } catch (error) {
        if (error.response) {
            throw error.response.data;
        }
        throw { message: 'Erro de conexão. Verifique a internet.' };
    }
};

// --- CORREÇÃO DO ERRO ---
// Criamos a função 'validateLicense' que apenas repassa a chamada para 'activateLicense'.
// Isso satisfaz o import que está no LicenseContext.jsx.
export const validateLicense = async (data) => {
    return activateLicense(data);
};

export const getStoredLicense = () => {
    const stored = localStorage.getItem('sys_license_data');
    return stored ? JSON.parse(stored) : null;
};