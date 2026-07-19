# Uruchomienie

## Docker

Wymagany jest zainstalowany i uruchomiony Docker Desktop.

```bash
docker compose up --build
```

Otwórz [http://localhost:8000](http://localhost:8000).

Zatrzymanie kontenera:

```bash
docker compose down
```

Uruchomienie w tle:

```bash
docker compose up --build -d
```

Przeglądanie logów:

```bash
docker compose logs -f
```

## Lokalnie bez Dockera

Wymagany jest Python w wersji 3.12 lub nowszej.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Otwórz [http://localhost:8000](http://localhost:8000).
