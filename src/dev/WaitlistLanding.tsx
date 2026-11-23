import { createRoot } from 'react-dom/client';
import LandingPage from '../components/LandingPage';
import { LanguageProvider } from '../context/LanguageContext';
import '../index.css';
import '../styles/trustleaf-theme.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <LandingPage onNavigate={path => window.location.assign(path)} />
  </LanguageProvider>,
);
