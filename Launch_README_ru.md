# Запуск

## Docker

Требуется установленный и запущенный Docker Desktop.

```bash
docker compose up --build
```

Откройте [http://localhost:8000](http://localhost:8000).

Остановить контейнер:

```bash
docker compose down
```

Запуск в фоновом режиме:

```bash
docker compose up --build -d
```

Просмотр логов:

```bash
docker compose logs -f
```

## Локально без Docker

Требуется Python 3.12 или новее.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Откройте [http://localhost:8000](http://localhost:8000).
