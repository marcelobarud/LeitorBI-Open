# LeitorBI Web

Versao web experimental do LeitorBI.

## Estrutura

- `backend/`: API em FastAPI para analisar exports JSON do Power BI, comparar modelos e gerar Excel.
- `frontend/`: interface React + TypeScript para upload, leitura e exploracao do modelo.

## Como rodar

Backend:

```powershell
cd leitorbi_web/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd leitorbi_web/frontend
npm install
npm run dev
```

Por padrao, o frontend chama a API em `http://localhost:8000`.

## Configuração

Backend:

- `LEITORBI_CORS_ORIGINS`: origens permitidas separadas por vírgula. Padrão: `http://localhost:5173,http://127.0.0.1:5173`.
- `LEITORBI_MAX_UPLOAD_MB`: tamanho máximo do JSON enviado. Padrão: `10`.

Frontend:

- `VITE_API_URL`: URL base da API. Exemplo para `.env.local`: `VITE_API_URL=http://localhost:8000`.

Para publicar em rede ou produção, configure `LEITORBI_CORS_ORIGINS` com a URL do frontend e `VITE_API_URL` com a URL da API.

## Qualidade

O backend tem testes com `pytest` para análise, comparação, exportação Excel e validação de uploads:

```powershell
cd leitorbi_web/backend
pytest
```
