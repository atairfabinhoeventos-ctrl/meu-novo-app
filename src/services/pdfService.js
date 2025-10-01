import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import packageJson from '../../package.json';

// Função para formatar moeda, retornando string vazia se o valor for zero
const formatCurrencyPDF = (value) => {
  const num = Number(value) || 0;
  if (num === 0) {
    return '';
  }
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Função auxiliar para carregar a imagem da logo
const getImageBase64 = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      const reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', imageUrl);
    xhr.responseType = 'blob';
    xhr.send();
  });
};

export const generateWaiterReceiptPDF = async (closingData) => {
  const pageWidth = 105;
  const pageHeight = 147;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  let logoBase64;
  try {
    logoBase64 = await getImageBase64('/logo2.png');
  } catch (error) {
    console.error("Erro ao carregar a imagem da logo:", error);
  }
  
  const margin = 7;
  let finalY = 0;

  // ===== INÍCIO DA ALTERAÇÃO 1: CABEÇALHO =====
  // --- 1. CABEÇALHO MODERNO (ALTURA REDUZIDA) ---
  const headerHeight = 9; // Reduzido de 18 para 9
  doc.setFillColor('#1E63B8');
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  if (logoBase64) {
    // Logo redimensionada e reposicionada para caber no novo cabeçalho
    doc.addImage(logoBase64, 'PNG', margin, 1, 7, 7); 
  }
  
  // Textos reposicionados e com fonte ajustada
  doc.setFontSize(10); 
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#FFFFFF');
  doc.text('Recibo de Fechamento', pageWidth / 2, 5, { align: 'center' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Garçom', pageWidth / 2, 8, { align: 'center' });
  
  finalY = headerHeight + 6;
  doc.setTextColor('#000000');
  // ===== FIM DA ALTERAÇÃO 1 =====

  // --- 2. BLOCO DE INFORMAÇÕES GERAIS ---
  autoTable(doc, {
    startY: finalY,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 0.8 },
    body: [
      [{ content: 'EVENTO:', styles: { fontStyle: 'bold' } }, { content: String(closingData.eventName || '') }],
      [{ content: 'DATA:', styles: { fontStyle: 'bold' } }, { content: new Date(closingData.timestamp).toLocaleString('pt-BR') }],
      [{ content: 'GARÇOM:', styles: { fontStyle: 'bold' } }, { content: String(closingData.waiterName || '') }],
      [{ content: 'Nº/POS:', styles: { fontStyle: 'bold' } }, { content: `${closingData.numeroCamiseta || '-'} / ${closingData.numeroMaquina || '-'}` }],
    ],
  });
  finalY = doc.lastAutoTable.finalY;

  // Linha separadora
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, finalY + 2, pageWidth - margin, finalY + 2);
  doc.setLineDashPattern([], 0);

  // --- 3. BLOCO DE VENDAS, COMISSÕES E SUBTOTAL ---
  const valorFinalAcerto = closingData.valorTotal - closingData.comissaoTotal;
  autoTable(doc, {
    startY: finalY + 4,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 0.8 },
    body: [
      [{ content: 'Total Venda Produtos:', styles: { fontStyle: 'bold' } }, { content: `R$ ${formatCurrencyPDF(closingData.valorTotal)}`, styles: { halign: 'right' } }],
      ['Comissão 8%:', { content: `R$ ${formatCurrencyPDF(closingData.comissao8)}`, styles: { halign: 'right' } }],
      ['Comissão 4%:', { content: `R$ ${formatCurrencyPDF(closingData.comissao4)}`, styles: { halign: 'right' } }],
      [{ content: 'COMISSÃO TOTAL:', styles: { fontStyle: 'bold' } }, { content: `R$ ${formatCurrencyPDF(closingData.comissaoTotal)}`, styles: { halign: 'right', fontStyle: 'bold' } }],
      [{ content: 'SUBTOTAL:', styles: { fontStyle: 'bold' } }, { content: `R$ ${formatCurrencyPDF(valorFinalAcerto)}`, styles: { halign: 'right', fontStyle: 'bold' } }],
    ],
    didDrawPage: (data) => {
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, data.cursor.y + 1, pageWidth - margin, data.cursor.y + 1);
      doc.setLineDashPattern([], 0);
    }
  });
  finalY = doc.lastAutoTable.finalY + 2;

  // --- 4. BLOCO DE PAGAMENTOS ---
  autoTable(doc, {
    startY: finalY,
    theme: 'striped',
    headStyles: { fillColor: '#34495e', textColor: '#FFFFFF', fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.2 },
    head: [['Forma de Pagamento', 'Valor Recebido']],
    body: [
      ['Cartão Crédito', { content: `R$ ${formatCurrencyPDF(closingData.credito)}`, styles: { halign: 'right' } }],
      ['Cartão Débito', { content: `R$ ${formatCurrencyPDF(closingData.debito)}`, styles: { halign: 'right' } }],
      ['Pix', { content: `R$ ${formatCurrencyPDF(closingData.pix)}`, styles: { halign: 'right' } }],
      ['Cashless', { content: `R$ ${formatCurrencyPDF(closingData.cashless)}`, styles: { halign: 'right' } }],
    ],
  });
  finalY = doc.lastAutoTable.finalY;

  // --- 5. BLOCO DE ACERTO FINAL ---
  const settlementY = finalY + 5;
  const settlementHeight = 12;
  doc.setFillColor('#f0f2f5');
  doc.rect(margin, settlementY, pageWidth - margin * 2, settlementHeight, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const settlementText = `${closingData.diferencaLabel}:`;
  const settlementValue = `R$ ${formatCurrencyPDF(closingData.diferencaPagarReceber)}`;
  const settlementColor = closingData.diferencaLabel === 'Pagar ao Garçom' ? '#0000FF' : '#FF0000';
  doc.setTextColor(settlementColor);
  const textY = settlementY + (settlementHeight / 2) + 2;
  doc.text(settlementText, margin + 2, textY);
  doc.text(settlementValue, pageWidth - margin - 2, textY, { align: 'right' });
  doc.setTextColor('#000000');
  finalY = settlementY + settlementHeight;

  // ===== INÍCIO DA ALTERAÇÃO 2: ASSINATURAS =====
  // --- 6. ASSINATURAS (REPOSICIONADAS) ---
  autoTable(doc, {
    startY: finalY + 8, // Posição aproximada do conteúdo (reduzido de 15 para 8)
    theme: 'plain',
    body: [
      [
        { content: '____________________\nAssinatura Garçom', styles: { halign: 'center' } },
        { content: '____________________\nAssin. Conferente', styles: { halign: 'center' } }
      ]
    ],
    styles: { fontSize: 8 },
  });
  // ===== FIM DA ALTERAÇÃO 2 =====
  
  // ===== INÍCIO DA ALTERAÇÃO 3: RODAPÉ =====
  // --- 7. RODAPÉ DO RECIBO (REMOVIDO) ---
  // A seção que exibia o protocolo foi removida.
  // ===== FIM DA ALTERAÇÃO 3 =====

  // --- SALVA O ARQUIVO ---
  doc.save(`Recibo_${closingData.waiterName.replace(/ /g, '_')}_${closingData.protocol}.pdf`);
};