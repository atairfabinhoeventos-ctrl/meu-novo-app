// src/contexts/LicenseContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import { validateLicense } from '../services/licenseService'; // Reutiliza sua função de API

export const LicenseContext = createContext();

export const LicenseProvider = ({ children }) => {
    const [isActivated, setIsActivated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [licenseInfo, setLicenseInfo] = useState(null);

    useEffect(() => {
        checkLicenseStatus();
    }, []);

    const checkLicenseStatus = async () => {
        const storedData = localStorage.getItem('sys_license_data');
        
        if (!storedData) {
            setIsActivated(false);
            setIsLoading(false);
            return;
        }

        const localLicense = JSON.parse(storedData);
        
        // 1. VERIFICAÇÃO OFFLINE (Data de Validade Local)
        if (localLicense.expiration) {
            const [day, month, year] = localLicense.expiration.split('/');
            const expDate = new Date(`${year}-${month}-${day}`);
            const today = new Date();
            today.setHours(0,0,0,0);

            if (today > expDate) {
                console.warn("Bloqueio Local: Licença expirada.");
                setIsActivated(false);
                setIsLoading(false);
                return; // Para aqui, nem tenta ir online
            }
        }

        // 2. TENTATIVA DE VALIDAÇÃO ONLINE (Background)
        // Se a internet funcionar, atualizamos o status e a data.
        // Se a internet falhar, mantemos o acesso liberado (pois passou na verificação de data offline acima).
        try {
            // Chamamos a validação enviando apenas a chave (os outros dados podem ir vazios ou repetidos)
            // Precisamos adaptar o service para aceitar chamadas só com a chave se necessário, 
            // ou enviamos os dados salvos.
            const validationResult = await validateLicense({
                licenseKey: localLicense.key,
                clientName: localLicense.name,
                clientDoc: localLicense.doc,
                clientEmail: localLicense.email
            });

            if (validationResult.valid) {
                // SUCESSO ONLINE: Atualiza os dados locais (pode ter nova data de validade)
                const updatedData = {
                    ...localLicense,
                    expiration: validationResult.expiration,
                    status: validationResult.status
                };
                localStorage.setItem('sys_license_data', JSON.stringify(updatedData));
                setLicenseInfo(updatedData);
                setIsActivated(true);
            } else {
                // FALHA ONLINE (Ex: O admin bloqueou na planilha agora)
                console.warn("Bloqueio Online: Servidor rejeitou a licença.");
                setIsActivated(false);
            }

        } catch (error) {
            console.log("Offline ou Erro de Rede: Mantendo acesso baseado na data local.");
            // Como passou na verificação de data (passo 1), liberamos.
            setLicenseInfo(localLicense);
            setIsActivated(true);
        }

        setIsLoading(false);
    };

    const registerActivation = (data) => {
        localStorage.setItem('sys_license_data', JSON.stringify(data));
        setLicenseInfo(data);
        setIsActivated(true);
    };

    return (
        <LicenseContext.Provider value={{ isActivated, isLoading, registerActivation, licenseInfo }}>
            {children}
        </LicenseContext.Provider>
    );
};