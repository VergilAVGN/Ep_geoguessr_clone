# Launch

## Docker

Requires Docker Desktop installed and running.

```bash
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000).

Stop the container:

```bash
docker compose down
```

Run in the background (detached mode):

```bash
docker compose up --build -d
```

View logs:

```bash
docker compose logs -f
```

## Locally without Docker

Requires Python 3.12 or newer.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).
