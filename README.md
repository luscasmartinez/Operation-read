# Aegea — Mapa Operacional

Sistema que lê arquivos Excel automaticamente de uma pasta no Google Drive e
renderiza os registros em um mapa interativo para análise operacional.

- **Backend**: FastAPI + Pandas → **Google Cloud Run**
- **Frontend**: React + TypeScript + Leaflet → **Vercel**

---

## 1. Pré-requisitos

| Requisito | Observação |
|-----------|------------|
| Service Account do Google Cloud | Arquivo `.json` com as credenciais |
| Pasta no Google Drive compartilhada | Compartilhe com o `client_email` do JSON com permissão **Leitor** |
| Node.js 20+ | Para o frontend |
| Python 3.12+ | Para o backend |
| `gcloud` CLI | Necessário apenas para o deploy do backend |

---

## 2. Rodando localmente

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

mkdir -p credentials
# copie o JSON da Service Account para credentials/service-account.json

cp .env.example .env
# edite o .env e preencha GOOGLE_DRIVE_FOLDER_ID com o ID da sua pasta

uvicorn app.main:app --reload --port 8080
```

O ID da pasta é o trecho final da URL do Drive:
`https://drive.google.com/drive/folders/1718J5ZVNsKMclGTov60FXbpI285tswhk`
→ ID: `1718J5ZVNsKMclGTov60FXbpI285tswhk`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # defina VITE_API_URL=http://localhost:8080
npm run dev
```

Acesse `http://localhost:5173`.

---

## 3. Deploy em produção

### Visão geral do fluxo

```
GitHub ──push──► Vercel (frontend)
                      │
                      │ VITE_API_URL
                      ▼
              Google Cloud Run (backend)
                      │
                      │ Secret Manager
                      ▼
              Service Account JSON
                      │
                      ▼
              Google Drive (Excel)
```

---

### 3.1 Backend — Google Cloud Run

> O JSON da Service Account **não deve** ir para o repositório nem para a
> imagem Docker. Armazene-o no Secret Manager.

**Passo 1 — Suba o segredo (apenas uma vez)**

```bash
gcloud secrets create aegea-drive-credentials \
  --data-file=backend/credentials/service-account.json
```

**Passo 2 — Faça o deploy**

```bash
cd backend

gcloud run deploy aegea-backend \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --memory 1Gi \
  --set-env-vars GOOGLE_DRIVE_FOLDER_ID=<ID_DA_PASTA> \
  --set-env-vars CORS_ALLOWED_ORIGINS=https://<seu-projeto>.vercel.app \
  --set-secrets /app/credentials/service-account.json=aegea-drive-credentials:latest \
  --update-env-vars GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account.json
```

Substitua `<ID_DA_PASTA>` pelo ID do Google Drive e `<seu-projeto>` pelo
subdomínio gerado pela Vercel (obtido no passo 3.2).

**Passo 3 — Anote a URL gerada**

Ao final do deploy, o Cloud Run exibe algo como:
```
Service URL: https://aegea-backend-xxxx-uc.a.run.app
```
Guarde essa URL — ela será usada como `VITE_API_URL` no frontend.

> **Dica**: `--min-instances 1` mantém uma instância sempre ativa, preservando
> o cache dos arquivos Excel em memória e evitando cold start a cada requisição.

**Atualizando o backend** após mudanças de código:

```bash
cd backend
gcloud run deploy aegea-backend --source . --region southamerica-east1
```

---

### 3.2 Frontend — Vercel

**Passo 1 — Suba o código para o GitHub**

O `.gitignore` já impede que credenciais e `.env` sejam enviados.

```bash
git add .
git commit -m "deploy inicial"
git push origin main
```

**Passo 2 — Importe o projeto na Vercel**

1. Acesse [vercel.com/new](https://vercel.com/new) e clique em **Add New Project**.
2. Selecione o repositório do GitHub.
3. Na tela de configuração, defina:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite *(detectado automaticamente pelo `vercel.json`)*
4. Em **Environment Variables**, adicione:
   | Nome | Valor |
   |------|-------|
   | `VITE_API_URL` | `https://aegea-backend-xxxx-uc.a.run.app` *(URL do Cloud Run)* |
5. Clique em **Deploy**.

**Passo 3 — Atualize o CORS no Cloud Run**

Após o primeiro deploy, a Vercel gera um domínio definitivo (ex.:
`https://aegea-mapa.vercel.app`). Atualize o backend:

```bash
gcloud run services update aegea-backend \
  --region southamerica-east1 \
  --update-env-vars CORS_ALLOWED_ORIGINS=https://aegea-mapa.vercel.app
```

**Deploys futuros** são automáticos: qualquer `git push origin main` aciona
um novo build na Vercel.

---

## 4. Adicionando novos arquivos Excel

Basta soltar o novo `.xlsx` dentro da pasta **Aegea** no Drive. O backend
sincroniza automaticamente a cada 60 s, baixando apenas arquivos novos ou
modificados. Não é necessário alterar nenhum código.

Para forçar uma sincronização imediata:

```bash
curl -X POST https://aegea-backend-xxxx-uc.a.run.app/refresh
```

**Colunas obrigatórias**: `Latitude Real` e `Longitude Real` — sem elas o
arquivo é ignorado com aviso no log. As demais colunas são normalizadas
automaticamente; colunas extras ficam disponíveis no popup do marcador.

---

## 5. Estrutura do projeto

```
aegea-mapa/
├── backend/
│   ├── app/
│   │   ├── api/          # Endpoints: /leituras/mapa, /leituras/contagem, /filtros
│   │   ├── models/       # Schemas Pydantic
│   │   ├── services/     # Drive, cache local, DataStore (singleton)
│   │   └── utils/        # Mapeamento de colunas, parser de datas
│   ├── credentials/      # service-account.json (não vai para o git)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/          # Cliente HTTP base
│   │   ├── components/   # Map, Sidebar, StatsCards, Legend
│   │   ├── hooks/        # useContagem, useMapa, useFiltrosDisponiveis
│   │   ├── services/     # mapaService (camada de serviço)
│   │   ├── store/        # Zustand — filtros e estado do mapa
│   │   └── types/        # Interfaces TypeScript
│   └── vercel.json
└── docker-compose.yml    # Sobe backend + frontend com um único comando
```

---

## 6. Escalando para volumes maiores

O projeto já está preparado para centenas de milhares de registros:

- **Filtros obrigatórios no servidor**: o mapa só carrega após selecionar
  Referência + Cidade ou Micro, reduzindo drasticamente o payload.
- **Contagem prévia**: antes de buscar os dados, o frontend consulta
  `/leituras/contagem` e exibe o total; se passar de 50 mil registros,
  pede confirmação ao usuário.
- **Payload leve**: `/leituras/mapa` retorna apenas os campos necessários
  para desenhar os marcadores; o detalhe completo é buscado sob demanda
  ao clicar no ponto.
- **Render em lotes**: os marcadores são renderizados em lotes de 3 000
  por frame (`requestAnimationFrame`), com barra de progresso, evitando
  travar a UI durante a pintura inicial.
- **Cache React Query**: resultados de filtros e contagens ficam em cache
  por 30–60 s, reduzindo chamadas desnecessárias ao backend.

Se o volume crescer para milhões de registros, os próximos passos naturais
seriam: paginação por bounding box (carregar só o que está visível no
mapa) e migrar o armazenamento em memória para DuckDB/Parquet.
