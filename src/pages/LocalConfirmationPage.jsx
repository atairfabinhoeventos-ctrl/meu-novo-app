// src/pages/LocalConfirmationPage.js (Corrigido)
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import * as XLSX from 'xlsx';
import '../App.css';

function LocalConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { savedData } = location.state || {};

  if (!savedData) {
    return (
        <div className="app-container">
            <div className="login-form">
                <h1>Erro</h1>
                <p>Nenhum dado de fechamento encontrado.</p>
                <button className="login-button" onClick={() => navigate('/financial-selection')}>Voltar ao Menu</button>
            </div>
        </div>
    );
  }

  const handleSendOnline = async () => {
    if (!window.confirm('Tem certeza que deseja enviar este registro para a planilha principal?')) return;
    try {
      await axios.post(`${API_URL}/api/closings/waiter`, savedData);
      alert(`Registro do garçom "${savedData.waiterName}" enviado com sucesso!`);
      let localClosings = JSON.parse(localStorage.getItem('localClosings')) || [];
      localClosings = localClosings.filter(item => item.protocol !== savedData.protocol);
      localStorage.setItem('localClosings', JSON.stringify(localClosings));
      navigate('/financial-selection');
    } catch (error) {
      alert('Erro ao enviar o registro. Verifique sua conexão com a internet.');
    }
  };

  const handleDownloadSheet = () => {
    const dataToExport = [[
        'DATA', 'EVENTO', 'NOME DO GARÇOM', 'VENDAS TOTAIS', 'CRÉDITO', 'DÉBITO', 'PIX', 'DINHEIRO',
        'TAXA PIX (1%)', 'VENDAS CARTÃO', 'TAXA CARTÃO (4%)', 'COMISSÃO (10%)', 'TOTAL A PAGAR',
        'CAIXINHA', 'PREMIAÇÃO', 'VALOR RECEBIDO', 'SALDO', 'PROTOCOLO', 'OPERADOR'
    ]];

    const vendasCartao = savedData.credito + savedData.debito;
    const dinheiro = savedData.vendasTotais - (vendasCartao + savedData.pix);
    const taxaPix = savedData.pix * 0.01;
    const taxaCartao = vendasCartao * 0.04;
    const comissao = savedData.vendasTotais * 0.10;
    const totalAPagar = comissao + savedData.caixinha + savedData.premiacao - taxaPix - taxaCartao;
    const saldo = dinheiro - totalAPagar;
    
    dataToExport.push([
        new Date(savedData.timestamp).toLocaleString('pt-BR'), savedData.eventName, savedData.waiterName,
        savedData.vendasTotais, savedData.credito, savedData.debito, savedData.pix, dinheiro,
        taxaPix, vendasCartao, taxaCartao, comissao, totalAPagar, savedData.caixinha, savedData.premiacao,
        dinheiro, saldo, savedData.protocol, savedData.operatorName
    ]);

    const ws = XLSX.utils.aoa_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fechamento");
    XLSX.writeFile(wb, `Fechamento_${savedData.waiterName.replace(/ /g, '_')}.xlsx`);
  };

  return (
    <div className="app-container">
      <div className="login-form">
        <h1>Salvo Localmente!</h1>
        <p>O fechamento de <strong>{savedData.waiterName}</strong> foi salvo no seu computador.</p>
        <p>Protocolo Local: <strong>{savedData.protocol}</strong></p>
        <div style={{ margin: '30px 0' }}>
            <button className="login-button" style={{backgroundColor: '#5cb85c'}} onClick={handleSendOnline}>
                Enviar para Planilha Principal
            </button>
            <button className="login-button" style={{backgroundColor: '#5bc0de', marginTop: '15px'}} onClick={handleDownloadSheet}>
                Baixar Planilha (.xlsx)
            </button>
        </div>
        {/* BOTÃO CORRIGIDO AQUI */}
        <button className="link-button" onClick={() => navigate('/financial-selection')}>
          Voltar ao menu sem fazer nada
        </button>
      </div>
    </div>
  );
}
export default LocalConfirmationPage;