import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0a0a0a',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', color: '#ff4444' }}>
            Something went wrong
          </h1>
          <pre style={{
            backgroundColor: '#1a1a1a',
            padding: '1.5rem',
            borderRadius: '8px',
            maxWidth: '600px',
            overflowX: 'auto',
            fontSize: '0.875rem',
            color: '#ff6b6b',
            border: '1px solid #333',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#00ff66',
              color: '#000',
              border: 'none',
              fontWeight: 900,
              cursor: 'pointer',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em'
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
