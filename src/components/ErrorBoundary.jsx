import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error Boundary global.
 * Captura errores no manejados en componentes hijos y evita pantalla blanca.
 * Registra en consola el componente y la causa del crash para diagnóstico.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });

    // Diagnóstico en consola: qué componente causó el crash y por qué
    console.error('[ErrorBoundary] Crash detectado:', {
      mensaje: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      error,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-gray-50 rounded-xl border border-gray-200">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Ocurrió un error al cargar esta sección
          </h2>
          <p className="text-gray-600 text-center max-w-md mb-6">
            Revisa la consola del navegador (F12) para ver más detalles del problema.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={this.handleRetry}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              Recargar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
