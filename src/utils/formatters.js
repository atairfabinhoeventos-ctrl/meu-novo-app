// src/utils/formatters.js (VERSÃO FINAL E CORRIGIDA)

/**
 * Formata um valor de input para moeda BRL com a lógica de "número cheio".
 * Esta função é apenas para EXIBIÇÃO.
 */
export const formatCurrencyInput = (value) => {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);
  const cleanValue = stringValue.replace(/\D/g, '');

  if (cleanValue === '') return '';

  // Converte para número, sempre dividindo por 100 para ter 2 casas decimais.
  // Ex: '125000' -> 1250.00 | '125050' -> 1250.50
  const numberValue = parseInt(cleanValue, 10) / 100;

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue);
};

/**
 * Formata um número para exibir como resultado de moeda BRL.
 */
export const formatCurrencyResult = (value) => {
    if (isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Formata um texto para o padrão de CPF.
 */
export const formatCpf = (text) => {
  const cleanText = text.replace(/\D/g, '');
  if (cleanText.length <= 3) return cleanText;
  if (cleanText.length <= 6) return `${cleanText.slice(0, 3)}.${cleanText.slice(3)}`;
  if (cleanText.length <= 9) return `${cleanText.slice(0, 3)}.${cleanText.slice(3, 6)}.${cleanText.slice(6)}`;
  return `${cleanText.slice(0, 3)}.${cleanText.slice(3, 6)}.${cleanText.slice(6, 9)}-${cleanText.slice(9, 11)}`;
};