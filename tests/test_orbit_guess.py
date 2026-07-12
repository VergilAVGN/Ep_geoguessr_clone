import os
import sys

from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app


client = TestClient(app)


def test_orbit_guess_flow_returns_result_payload():
    start_response = client.post(
        "/api/orbit/start",
        json={"lat": 48.8566, "lon": 2.3522},
    )

    assert start_response.status_code == 200
    payload = start_response.json()
    assert "id" in payload

    guess_response = client.post(
        "/api/orbit/guess",
        json={"id": payload["id"], "lat": 48.8566, "lon": 2.3522},
    )

    assert guess_response.status_code == 200
    body = guess_response.json()
    assert body["score"] >= 0
    assert body["distance"] >= 0
    assert body["correct_lat"] == 48.8566
    assert body["correct_lon"] == 2.3522
    assert body["finished"] is True
