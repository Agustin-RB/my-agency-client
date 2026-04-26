import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Stub para cuando se ejecuta en el navegador (sin Electron)
const demoProjects = [
  'Agencia de marketing', 'Brand Identity', 'E-commerce App', 'Packaging Cerveza Artesanal',
  'Campaña Redes Sociales', 'Revista Diseño Interior', 'App Fitness Tracker',
  'Ilustraciones Libro Infantil', 'Identidad Visual Restaurante', 'Catálogo Muebles 2024'
];
if (typeof window !== 'undefined' && !(window as any).electron) {
  (window as any).electron = {
    invoke: (channel: string, ...args: any[]) => {
      if (channel === 'list-projects') return Promise.resolve(demoProjects);
      if (channel === 'list-psd-files' || channel === 'list-file-versions') return Promise.resolve([]);
      if (channel === 'get-file-mtime') return Promise.resolve({ mtime: 0 });
      if (channel === 'watch-file') return Promise.resolve({ success: true });
      if (channel === 'open-file-dialog' || channel === 'convert-to-png' || channel === 'open-in-design-app') return Promise.resolve({ error: 'Ejecutá la app con Electron para usar esta función' });
      if (channel === 'get-file-base64') return Promise.resolve({ error: 'No disponible en navegador' });
      if (channel === 'get-file-info') return Promise.resolve(null);
      if (channel === 'save-file-version') return Promise.resolve({ error: 'No disponible en navegador' });
      if (channel === 'create-project') return Promise.resolve({ error: 'No disponible en navegador' });
      return Promise.resolve(null);
    },
    on: () => {}
  };
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
