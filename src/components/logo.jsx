// src/components/logo.js
import React from 'react';

// Vamos usar a logo2.png que você pediu
const Logo = ({ style = {} }) => {
  return <img src="/logo1.png" alt="Logo da Empresa" style={style} />;
};

export default Logo;