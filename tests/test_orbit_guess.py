import os
import sys
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app.routers.orbit import orbit_games


client = TestClient(app)


def test_orbit_guess_flow_returns_result_payload():
    orbit_games.clear()
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
    assert body["finished"] is False
    assert body["round_number"] == 1
    assert body["total_rounds"] == 5


def test_orbit_session_supports_five_rounds():
    orbit_games.clear()
    session_response = client.post(
        "/api/orbit/start",
        json={"lat": 48.8566, "lon": 2.3522},
    )
    assert session_response.status_code == 200

    session_id = session_response.json()["id"]
    total_score = 0

    for round_number in range(1, 6):
        round_response = client.post(
            "/api/orbit/start",
            json={"game_id": session_id, "lat": 48.8566 + round_number, "lon": 2.3522 + round_number},
        )
        assert round_response.status_code == 200
        round_payload = round_response.json()
        assert round_payload["round_number"] == round_number
        assert round_payload["total_rounds"] == 5

        guess_response = client.post(
            "/api/orbit/guess",
            json={"id": session_id, "lat": 48.8566 + round_number, "lon": 2.3522 + round_number},
        )
        assert guess_response.status_code == 200
        body = guess_response.json()
        assert body["round_number"] == round_number
        assert body["total_rounds"] == 5
        assert body["game_finished"] is (round_number == 5)
        assert body["total_score"] >= total_score
        total_score = body["total_score"]

    results_response = client.get(f"/api/orbit/{session_id}/results")
    assert results_response.status_code == 200
    results_body = results_response.json()
    assert results_body["total_score"] == total_score
    assert results_body["max_score"] == 25000
    assert results_body["total_rounds"] == 5
    assert len(results_body["rounds"]) == 5
    assert 0 <= results_body["stars"] <= 5


@patch("app.routers.orbit.build_orbit_hint_facts", return_value=["Hemisphere: Northern"])
def test_orbit_hint_endpoint_returns_circle_and_marks_used(mock_build_hints):
    orbit_games.clear()
    start_response = client.post(
        "/api/orbit/start",
        json={"lat": 48.8566, "lon": 2.3522},
    )
    assert start_response.status_code == 200
    game_id = start_response.json()["id"]

    hint_response = client.get(f"/api/orbit/hint/{game_id}")
    assert hint_response.status_code == 200
    hint_body = hint_response.json()
    assert hint_body["radius_km"] == 3000
    assert hint_body["used"] is True
    assert isinstance(hint_body["center_lat"], float)
    assert isinstance(hint_body["center_lon"], float)
    assert hint_body["facts"] == []
    mock_build_hints.assert_not_called()

    second_hint_response = client.get(f"/api/orbit/hint/{game_id}")
    assert second_hint_response.status_code == 400
    assert second_hint_response.json()["detail"] == "Hint already used"


def test_orbit_hint_without_game_id_uses_single_session():
    orbit_games.clear()
    start_response = client.post(
        "/api/orbit/start",
        json={"lat": 35.6895, "lon": 139.6917},
    )
    assert start_response.status_code == 200

    hint_response = client.get("/api/orbit/hint")
    assert hint_response.status_code == 200
    hint_body = hint_response.json()
    assert hint_body["radius_km"] == 3000
    assert hint_body["used"] is True
    assert hint_body["facts"] == []


@patch("app.routers.orbit.build_orbit_hint_facts", return_value=["Hemisphere: Northern"])
def test_orbit_data_hint_returns_facts_once(mock_build_hints):
    orbit_games.clear()
    start_response = client.post("/api/orbit/start", json={"lat": 48.8566, "lon": 2.3522})
    game_id = start_response.json()["id"]

    hint_response = client.get(f"/api/orbit/hint/{game_id}/data")
    assert hint_response.status_code == 200
    assert hint_response.json()["facts"] == ["Hemisphere: Northern"]
    assert hint_response.json()["radius_km"] is None
    mock_build_hints.assert_called_once()

    second_response = client.get(f"/api/orbit/hint/{game_id}/data")
    assert second_response.status_code == 400
