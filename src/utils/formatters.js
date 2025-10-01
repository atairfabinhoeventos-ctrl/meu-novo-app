// Função para formatar o valor para EXIBIÇÃO no input com máscara
export const formatCurrencyInput = (value) => {
  if (!value) return '';

  // 1. Pega apenas os dígitos
  const digitsOnly = String(value).replace(/\D/g, '');
  if (digitsOnly === '') return '';

  // 2. Transforma em número para remover zeros à esquerda (ex: "0050" vira 50)
  const numberValue = parseInt(digitsOnly, 10);
  const valueAsString = String(numberValue);

  // 3. Adiciona zeros à esquerda para garantir que sempre haja casas decimais
  const paddedValue = valueAsString.padStart(3, '0');
  
  // 4. Separa a parte inteira dos centavos
  const integerPart = paddedValue.slice(0, -2);
  const decimalPart = paddedValue.slice(-2);
  
  // 5. Adiciona os pontos de milhar na parte inteira
  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedIntegerPart},${decimalPart}`;
};

// Função para formatar o resultado final (com R$)
export const formatCurrencyResult = (value) => {
  const num = Number(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função para formatar CPF
export const formatCpf = (cpf) => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  }
  return cpf;
};