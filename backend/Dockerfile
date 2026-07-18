FROM python:3.12-slim

WORKDIR /app

# Dependências de sistema mínimas para pandas/openpyxl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# A credencial da Service Account é montada como Secret no Cloud Run
# (ver README), não copiada para a imagem.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
