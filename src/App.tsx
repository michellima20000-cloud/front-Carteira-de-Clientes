import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { AccountChoicePage } from './pages/AccountChoicePage';
import { BlocklistPage } from './pages/BlocklistPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { GoalsPage } from './pages/GoalsPage';
import { ImportPage } from './pages/ImportPage';
import { LoginPage } from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QuickRepliesPage } from './pages/QuickRepliesPage';
import { SalesPage } from './pages/SalesPage';
import { TeamPage } from './pages/TeamPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicOnlyRoute } from './routes/PublicOnlyRoute';

function RootRedirect() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  return <Navigate to={status === 'authenticated' ? '/conta' : '/entrar'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/conta" element={<AccountChoicePage />} />
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/vendas" element={<SalesPage />} />
            <Route path="/metas" element={<GoalsPage />} />
            <Route path="/conversas" element={<ConversationsPage />} />
            <Route path="/respostas-rapidas" element={<QuickRepliesPage />} />
            <Route path="/bloqueados" element={<BlocklistPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/equipe" element={<TeamPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
