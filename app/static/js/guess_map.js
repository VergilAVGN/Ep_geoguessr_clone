/**
 * GuessMap — reusable interactive guessing map (Leaflet.js + OpenStreetMap).
 *
 * Features:
 *  - Single draggable-marker placement (click moves existing marker)
 *  - Hover-expand panel with invalidateSize handling
 *  - Guess button gated on marker placement
 *  - Prepared FastAPI helpers (createGameViaApi / submitGuessToApi)
 *  - Extension hooks for hint circles, timer, scan results, score panel
 *
 * Currently wired only in Orbit Game; no Classic Game dependency.
 */
class GuessMap {
    /**
     * @param {Object} options
     * @param {string} [options.mapElementId]
     * @param {string} [options.guessButtonId]
     * @param {string} [options.panelElementId]
     * @param {string} [options.apiBaseUrl]
     * @param {Function|null} [options.onGuess] - Called with { lat, lon } on Guess click
     * @param {Function|null} [options.onCoordsChange] - Called whenever coords update
     * @param {{ lat: number, lon: number, zoom: number }} [options.defaultView]
     */
    constructor(options = {}) {
        this.mapElementId = options.mapElementId || 'guess-map';
        this.guessButtonId = options.guessButtonId || 'guess-map-submit';
        this.panelElementId = options.panelElementId || 'guess-map-panel';
        this.apiBaseUrl = options.apiBaseUrl || '/api/games';
        this.onGuess = options.onGuess || null;
        this.onCoordsChange = options.onCoordsChange || null;
        this.defaultView = options.defaultView || { lat: 20, lon: 0, zoom: 2 };

        /** @type {L.Map|null} */
        this.map = null;
        /** @type {L.Marker|null} */
        this.marker = null;
        /** @type {L.Circle[]} */
        this.hintCircles = [];
        /** @type {{ lat: number, lon: number }|null} */
        this.selectedCoords = null;
        /** @type {L.Marker|null} */
        this.correctMarker = null;
        /** @type {L.Polyline|null} */
        this.guessLine = null;

        this.panelEl = null;
        this.mapEl = null;
        this.guessBtn = null;
    }

    /** Initialize DOM bindings and Leaflet map. */
    init() {
        this.panelEl = document.getElementById(this.panelElementId);
        this.mapEl = document.getElementById(this.mapElementId);
        this.guessBtn = document.getElementById(this.guessButtonId);

        if (!this.mapEl) {
            console.error(`GuessMap: element #${this.mapElementId} not found`);
            return;
        }

        this._initLeaflet();
        this._bindPanelEvents();
        this._bindGuessButton();
    }

    _initLeaflet() {
        this.map = L.map(this.mapEl, {
            center: [this.defaultView.lat, this.defaultView.lon],
            zoom: this.defaultView.zoom,
            zoomControl: true,
            attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.map);

        this.map.on('click', (event) => {
            this._placeOrMoveMarker(event.latlng);
        });

        // Ensure correct dimensions once layout is settled
        requestAnimationFrame(() => this._invalidateMapSize());
    }

    /**
     * Place the first marker or move the existing one (never duplicates).
     * @param {L.LatLng} latlng
     */
    _placeOrMoveMarker(latlng) {
        if (this.marker) {
            this.marker.setLatLng(latlng);
        } else {
            this.marker = L.marker(latlng, { draggable: false }).addTo(this.map);
        }

        this.selectedCoords = {
            lat: latlng.lat,
            lon: latlng.lng,
        };

        this._syncGuessButton();
        this.onCoordsChange?.(this.getSelectedCoords());
    }

    _syncGuessButton() {
        if (this.guessBtn) {
            this.guessBtn.disabled = !this.selectedCoords;
        }
    }

    _bindPanelEvents() {
        if (!this.panelEl) {
            return;
        }

        // Re-flow Leaflet tiles when the panel animates between sizes
        const refreshMap = () => this._invalidateMapSize();

        this.panelEl.addEventListener('mouseenter', refreshMap);
        this.panelEl.addEventListener('mouseleave', refreshMap);
        this.panelEl.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'width' || event.propertyName === 'height') {
                refreshMap();
            }
        });

        window.addEventListener('resize', refreshMap);
    }

    _bindGuessButton() {
        if (!this.guessBtn) {
            return;
        }

        this.guessBtn.addEventListener('click', () => {
            if (!this.selectedCoords) {
                return;
            }
            this.onGuess?.(this.getSelectedCoords());
        });
    }

    _invalidateMapSize() {
        if (!this.map) {
            return;
        }

        this.map.invalidateSize({ animate: false });

        // Second pass after the 250ms CSS transition completes
        window.setTimeout(() => {
            this.map?.invalidateSize({ animate: false });
        }, 260);
    }

    /** @returns {{ lat: number, lon: number }|null} */
    getSelectedCoords() {
        return this.selectedCoords ? { ...this.selectedCoords } : null;
    }

    // -------------------------------------------------------------------------
    // Future feature hooks
    // -------------------------------------------------------------------------

    /**
     * Draw a hint circle on the map (e.g. distance radius after a scan).
     * @param {number} lat
     * @param {number} lon
     * @param {number} radiusMeters
     * @param {Object} [style]
     * @returns {L.Circle}
     */
    addHintCircle(lat, lon, radiusMeters, style = {}) {
        const circle = L.circle([lat, lon], {
            radius: radiusMeters,
            color: style.color || '#38bdf8',
            fillColor: style.fillColor || '#38bdf8',
            fillOpacity: style.fillOpacity ?? 0.15,
            weight: style.weight ?? 2,
        }).addTo(this.map);

        this.hintCircles.push(circle);
        return circle;
    }

    clearHintCircles() {
        this.hintCircles.forEach((circle) => this.map.removeLayer(circle));
        this.hintCircles = [];
    }

    /** @param {string} text */
    setTimerDisplay(text) {
        const timerEl = document.getElementById('guess-map-timer');
        if (!timerEl) {
            return;
        }
        timerEl.textContent = text;
        timerEl.hidden = !text;
    }

    /**
     * @param {{ score?: number, distanceKm?: number, label?: string }} data
     */
    setScorePanel(data) {
        const scoreEl = document.getElementById('guess-map-score');
        if (!scoreEl) {
            return;
        }

        const parts = [];
        if (data.label) {
            parts.push(`<strong>${data.label}</strong>`);
        }
        if (data.score != null) {
            parts.push(`Score: ${data.score}`);
        }
        if (data.distanceKm != null) {
            parts.push(`Distance: ${data.distanceKm} km`);
        }

        scoreEl.innerHTML = parts.join('<br>');
        scoreEl.hidden = parts.length === 0;
    }

    /** @param {string} html */
    setScanResults(html) {
        const scanEl = document.getElementById('guess-map-scan-results');
        if (!scanEl) {
            return;
        }
        scanEl.innerHTML = html;
        scanEl.hidden = !html;
    }

    clearResultLayers() {
        if (this.guessLine && this.map) {
            this.map.removeLayer(this.guessLine);
        }
        if (this.correctMarker && this.map) {
            this.map.removeLayer(this.correctMarker);
        }
        this.guessLine = null;
        this.correctMarker = null;
    }

    showRoundResult(result) {
        this.clearResultLayers();

        const guessCoords = this.getSelectedCoords();
        if (!guessCoords || !result) {
            return;
        }

        const guessLatLng = [guessCoords.lat, guessCoords.lon];
        const correctLatLng = [result.correct_lat, result.correct_lon];

        this.correctMarker = L.marker(correctLatLng, {
            title: 'Correct location',
        }).addTo(this.map);
        this.correctMarker.bindPopup('Correct location');

        this.guessLine = L.polyline([guessLatLng, correctLatLng], {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.9,
        }).addTo(this.map);

        this.map.fitBounds([guessLatLng, correctLatLng], { padding: [24, 24] });
    }

    // -------------------------------------------------------------------------
    // FastAPI integration (prepared, not required for initial Orbit UI)
    // -------------------------------------------------------------------------

    /** POST /api/games — create a new game session. */
    async createGameViaApi() {
        const response = await fetch(this.apiBaseUrl, { method: 'POST' });
        if (!response.ok) {
            throw new Error(`Failed to create game (${response.status})`);
        }
        return response.json();
    }

    /**
     * POST /api/games/{gameId}/guess — submit the current marker position.
     * @param {string} gameId
     */
    async submitGuessToApi(gameId) {
        const coords = this.getSelectedCoords();
        if (!coords) {
            return null;
        }

        const response = await fetch(`${this.apiBaseUrl}/${gameId}/guess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: coords.lat, lon: coords.lon }),
        });

        if (!response.ok) {
            throw new Error(`Guess submission failed (${response.status})`);
        }

        return response.json();
    }

    /** Remove marker, coords, and hint circles — ready for the next round. */
    reset() {
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }

        this.selectedCoords = null;
        this._syncGuessButton();
        this.clearHintCircles();
        this.clearResultLayers();
        this.setTimerDisplay('');
        this.setScorePanel({});
        this.setScanResults('');
    }
}

window.GuessMap = GuessMap;
