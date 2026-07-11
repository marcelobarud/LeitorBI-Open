import { FileJson } from "lucide-react";

type HomeEmptyStateProps = {
  onOpenFilePicker: () => void;
  disabled: boolean;
  selectedFileLabel: string;
};

export function HomeEmptyState({ onOpenFilePicker, disabled, selectedFileLabel }: HomeEmptyStateProps) {
  return (
    <div className="home-empty-page">
      <header className="page-header">
        <FileJson size={22} />
        <div>
          <h2>Inicio</h2>
          <p>Carregue um arquivo JSON exportado do Power BI para iniciar o levantamento.</p>
        </div>
      </header>

      <section className="empty-workspace">
        <h1>Nenhum arquivo carregado</h1>
        <p>
          Carregue um arquivo JSON exportado do Power BI para iniciar a analise. O LeitorBI ira levantar tabelas
          utilizadas no modelo, colunas totais, medidas, fontes de dados e relacionamentos, ignorando tabelas tecnicas
          de data automatica.
        </p>

        <button
          className="empty-drop-hint"
          type="button"
          onClick={onOpenFilePicker}
          disabled={disabled}
          aria-label="Carregar arquivo JSON exportado do Power BI"
        >
          <FileJson size={34} />
          <strong>{disabled ? "Analisando arquivo..." : "Selecionar JSON do modelo"}</strong>
          <span>{selectedFileLabel || "Aceita arquivos .json de ate 10 MB."}</span>
        </button>

        <div className="upload-rules">
          <span>Formato aceito: `.json` em UTF-8</span>
          <span>Limite: 10 MB por arquivo</span>
          <span>Dados reais exigem login e ficam restritos ao processamento da API.</span>
        </div>
      </section>
    </div>
  );
}
