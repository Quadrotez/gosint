import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LangProvider, useLang } from './i18n/LangProvider';
import { EntitySchemasProvider } from './context/EntitySchemasContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import SearchModal from './components/ui/SearchModal';
import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import EntityPage from './pages/EntityPage';
import GraphExplorer from './pages/GraphExplorer';
import CreateEntity from './pages/CreateEntity';
import ImportPage from './pages/ImportPage';
import EntityTypesPage from './pages/EntityTypesPage';
import RelationshipTypesPage from './pages/RelationshipTypesPage';
import SettingsPage from './pages/SettingsPage';
import EntityBoardPage from './pages/EntityBoardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppInner() {
  const { lang } = useLang();
  const { isAuthenticated } = useAuth();

  return (
    <SettingsProvider lang={lang}>
      <ToastProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

            {/* Protected routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <EntitySchemasProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/entities" element={<Entities />} />
                      <Route path="/entities/:id" element={<EntityPage />} />
                      <Route path="/entities/:id/board" element={<EntityBoardPage />} />
                      <Route path="/graph" element={<GraphExplorer />} />
                      <Route path="/create" element={<CreateEntity />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/entity-types" element={<EntityTypesPage />} />
                      <Route path="/relationship-types" element={<RelationshipTypesPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/admin" element={
                        <AdminRoute><AdminPage /></AdminRoute>
                      } />
                    </Routes>
                  </Layout>
                  <SearchModal />
                </EntitySchemasProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LangProvider>
          <AppInner />
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
