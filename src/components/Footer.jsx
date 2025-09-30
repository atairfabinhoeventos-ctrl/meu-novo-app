import React from 'react';
import './Footer.css';
import packageJson from '../../package.json'; // Importa o package.json para pegar a versão

function Footer() {
  const appVersion = packageJson.version; // Pega a versão do seu app

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <span>Versão {appVersion}</span>
        <span>© {new Date().getFullYear()} SisFO - Desenvolvido por Atair Lagares</span>
      </div>
    </footer>
  );
}

export default Footer;