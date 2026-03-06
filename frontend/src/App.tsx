import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LangProvider, useLang } from './i18n/LangProvider';
import { EntitySchemasProvider } from './context/EntitySchemasContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/layout/Layout';
import SearchModal from './components/ui/SearchModal';
import Dashboard from './pages/Dashboard';
import Entities from './pages/Entities';
import EntityPage from './pages/EntityPage';
import GraphExplorer from './pages/GraphExplorer';
import CreateEntity from './pages/CreateEntity';
import ImportPage from './pages/ImportPage';
import EntityTypesPage from './pages/EntityTypesPage';
import SettingsPage from './pages/SettingsPage';
import EntityBoardPage from './pages/EntityBoardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AppInner() {
  const { lang } = useLang();
  return (
    <SettingsProvider lang={lang}>
      <BrowserRouter>
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
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
          <SearchModal />
        </EntitySchemasProvider>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <AppInner />
      </LangProvider>
    </QueryClientProvider>
  );
}
