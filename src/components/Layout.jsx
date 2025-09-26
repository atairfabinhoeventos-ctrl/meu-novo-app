// src/components/Layout.jsx (COM LOG DE DEBUG)
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

function Layout() {
  console.log('--- Renderizando componente Layout ---');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default Layout;