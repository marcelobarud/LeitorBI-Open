import { Component, type ErrorInfo, type ReactNode } from "react";

type CompareErrorBoundaryProps = {
  children: ReactNode;
  onReset: () => void;
};

type CompareErrorBoundaryState = {
  hasError: boolean;
};

export class CompareErrorBoundary extends Component<CompareErrorBoundaryProps, CompareErrorBoundaryState> {
  constructor(props: CompareErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Prevent a malformed comparison payload from blanking the entire app.
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error compare-runtime-error">
          <strong>Não foi possível renderizar a comparação.</strong>
          <span>Limpe o resultado e tente comparar os arquivos novamente.</span>
          <button className="ghost-action" type="button" onClick={this.handleReset}>
            Limpar comparação
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
