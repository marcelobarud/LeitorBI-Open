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

