import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { toast } from './presentation/shared/toast-store';
import { ToastContainer } from './presentation/shared/ToastContainer';
import { bindMcpEvents } from './server-state/mcp';

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, retry: 0 },
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({
    onError: (err) => toast.error('데이터 불러오기 실패', errorMessage(err)),
  }),
  mutationCache: new MutationCache({
    onError: (err) => toast.error('동작 실패', errorMessage(err)),
  }),
});

bindMcpEvents(queryClient, (level, message) => {
  if (level === 'error') toast.error('MCP', message);
  else if (level === 'warn') toast.warning('MCP', message);
  else toast.info('MCP', message);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ToastContainer />
    </QueryClientProvider>
  </React.StrictMode>,
);
