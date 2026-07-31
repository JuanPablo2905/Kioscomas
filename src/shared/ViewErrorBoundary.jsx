import React from "react";
import { AlertTriangle, Bug, RotateCcw } from "lucide-react";

export class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, technicalDetails: "" };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error al mostrar una sección", error, info);
    this.setState({
      technicalDetails: [
        error?.name && `${error.name}: ${error.message || ""}`,
        error?.stack,
        info?.componentStack && `Componentes:${info.componentStack}`,
      ].filter(Boolean).join("\n").slice(0, 8000),
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.view !== this.props.view && this.state.error) {
      this.setState({ error: null, technicalDetails: "" });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 text-red-500" size={32} />
          <h2 className="text-lg font-semibold text-gray-900">
            No se pudo abrir esta sección
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            La app sigue funcionando. Volvé al inicio y reportá qué sección estabas abriendo.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => this.props.onReport?.({
                detalleTecnico: this.state.technicalDetails,
                vista: this.props.view,
              })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <Bug size={15} />
              Reportar este error
            </button>
            <button
              onClick={this.props.onRecover}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <RotateCcw size={15} />
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
