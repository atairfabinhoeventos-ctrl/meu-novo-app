import axios from 'axios';
import { API_URL } from '../config';

// Gera um ID único persistente para este navegador/PC
const getMachineId = () => {
    let mid = localStorage.getItem('sys_machine_id');
    if (!mid) {
        // Gera um ID aleatório + timestamp
        mid = 'ID-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem('sys_machine_id', mid);
    }
    return mid;
};

export const activateLicense = async (data) => {
    // data = { licenseKey, clientName, clientDoc, clientEmail }
    try {
        const machineId = getMachineId();
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

export const getStoredLicense = () => {
    const stored = localStorage.getItem('sys_license_data');
    return stored ? JSON.parse(stored) : null;
};