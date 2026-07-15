/**
 * In-place end-of-game results overlay for Orbit Game.
 */
class OrbitResultsOverlay {
    constructor(options = {}) {
        this.overlayId = options.overlayId || 'orbit-results-overlay';
        this.mapElementId = options.mapElementId || 'orbit-results-map';
        this.roundsListId = options.roundsListId || 'orbit-results-rounds-list';
        this.starsElementId = options.starsElementId || 'orbit-results-stars';
        this.totalScoreElementId = options.totalScoreElementId || 'orbit-results-total-score';
        this.maxScoreElementId = options.maxScoreElementId || 'orbit-results-max-score';
        this.totalTimeElementId = options.totalTimeElementId || 'orbit-results-total-time';
        this.playAgainButtonId = options.playAgainButtonId || 'orbit-results-play-again';
        this.onPlayAgain = options.onPlayAgain || null;

        /** @type {L.Map|null} */
        this.map = null;
        /** @type {Record<number, { guessMarker: L.Marker, correctMarker: L.Marker, line: L.Polyline, bounds: L.LatLngBounds }>} */
        this.roundLayers = {};
        this.activeRoundNumber = null;
        this.isVisible = false;

        this.overlayEl = null;
        this.mapEl = null;
        this.roundsListEl = null;
    }

    init() {
        this.overlayEl = document.getElementById(this.overlayId);
        this.mapEl = document.getElementById(this.mapElementId);
        this.roundsListEl = document.getElementById(this.roundsListId);

        const playAgainBtn = document.getElementById(this.playAgainButtonId);
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                this.onPlayAgain?.();
            });
        }
    }

    /**
     * @param {{
     *   total_score: number,
     *   max_score: number,
     *   stars: number,
     *   rounds: Array<{
     *     round_number: number,
     *     score: number,
     *     distance: number,
     *     guess_lat: number,
     *     guess_lon: number,
     *     correct_lat: number,
     *     correct_lon: number
     *   }>
     * }} results
     */
    show(results) {
        if (!this.overlayEl || !results) {
            return;
        }

        this._renderSummary(results);
        this._renderRoundList(results.rounds);
        this.overlayEl.hidden = false;
        this.overlayEl.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(() => {
            this.overlayEl.classList.add('is-visible');
            this.isVisible = true;
            this._ensureMap();
            this._renderMapLayers(results.rounds);

            window.setTimeout(() => {
                this.map?.invalidateSize({ animate: false });
                this._fitAllRounds();
            }, 320);
        });
    }

    hide() {
        if (!this.overlayEl) {
            return;
        }

        this.overlayEl.classList.remove('is-visible');
        this.overlayEl.setAttribute('aria-hidden', 'true');
        this.isVisible = false;

        window.setTimeout(() => {
            if (!this.isVisible) {
                this.overlayEl.hidden = true;
            }
        }, 450);

        this._clearMapLayers();
    }

    _renderSummary(results) {
        const starsEl = document.getElementById(this.starsElementId);
        const totalScoreEl = document.getElementById(this.totalScoreElementId);
        const maxScoreEl = document.getElementById(this.maxScoreElementId);
        const totalTimeEl = document.getElementById(this.totalTimeElementId);

        if (starsEl) {
            starsEl.innerHTML = Array.from({ length: 5 }, (_, index) => {
                const filled = index < results.stars ? 'is-filled' : '';
                return `<span class="orbit-results__star ${filled}" aria-hidden="true">★</span>`;
            }).join('');
            starsEl.setAttribute('aria-label', `${results.stars} out of 5 stars`);
        }

        if (totalScoreEl) {
            totalScoreEl.textContent = String(results.total_score);
        }

        if (maxScoreEl) {
            maxScoreEl.textContent = `/ ${results.max_score}`;
        }

        if (totalTimeEl) {
            totalTimeEl.textContent = results.totalTimeText || '—';
        }
    }

    _renderRoundList(rounds) {
        if (!this.roundsListEl) {
            return;
        }

        this.roundsListEl.innerHTML = rounds
            .map((round) => `
                <button
                    type="button"
                    class="orbit-results__round-item"
                    data-round-number="${round.round_number}"
                >
                    <div class="orbit-results__round-item-top">
                        <span class="orbit-results__round-item-title">Round ${round.round_number}</span>
                        <span class="orbit-results__round-item-score">${round.score}</span>
                    </div>
                    <div class="orbit-results__round-item-meta">
                        Distance: ${round.distance} km
                    </div>
                </button>
            `)
            .join('');

        this.roundsListEl.querySelectorAll('.orbit-results__round-item').forEach((button) => {
            button.addEventListener('click', () => {
                const roundNumber = Number(button.dataset.roundNumber);
                this.focusRound(roundNumber);
            });
        });
    }

    _ensureMap() {
        if (!this.mapEl || this.map) {
            return;
        }

        this.map = L.map(this.mapEl, {
            center: [20, 0],
            zoom: 2,
            zoomControl: true,
            attributionControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(this.map);
    }

    _renderMapLayers(rounds) {
        this._clearMapLayers();

        if (!this.map) {
            return;
        }

        rounds.forEach((round) => {
            const guessLatLng = [round.guess_lat, round.guess_lon];
            const correctLatLng = [round.correct_lat, round.correct_lon];

            const guessMarker = L.marker(guessLatLng, {
                icon: this._createMarkerIcon('guess', round.round_number),
                title: `Round ${round.round_number} guess`,
            }).addTo(this.map);

            const correctMarker = L.marker(correctLatLng, {
                icon: this._createMarkerIcon('correct', round.round_number),
                title: `Round ${round.round_number} correct location`,
            }).addTo(this.map);

            const line = L.polyline([guessLatLng, correctLatLng], {
                color: '#f59e0b',
                weight: 3,
                opacity: 0.85,
            }).addTo(this.map);

            const bounds = L.latLngBounds([guessLatLng, correctLatLng]);
            this.roundLayers[round.round_number] = {
                guessMarker,
                correctMarker,
                line,
                bounds,
            };
        });
    }

    focusRound(roundNumber) {
        const layers = this.roundLayers[roundNumber];
        if (!layers || !this.map) {
            return;
        }

        this.activeRoundNumber = roundNumber;
        this.map.fitBounds(layers.bounds, { padding: [48, 48], maxZoom: 8 });

        this.roundsListEl?.querySelectorAll('.orbit-results__round-item').forEach((item) => {
            item.classList.toggle(
                'is-active',
                Number(item.dataset.roundNumber) === roundNumber,
            );
        });
    }

    _fitAllRounds() {
        const allBounds = Object.values(this.roundLayers).map((layer) => layer.bounds);
        if (!this.map || allBounds.length === 0) {
            return;
        }

        const combined = allBounds.reduce((acc, bounds) => acc.extend(bounds));
        this.map.fitBounds(combined, { padding: [48, 48] });
    }

    _clearMapLayers() {
        Object.values(this.roundLayers).forEach((layer) => {
            this.map?.removeLayer(layer.guessMarker);
            this.map?.removeLayer(layer.correctMarker);
            this.map?.removeLayer(layer.line);
        });
        this.roundLayers = {};
        this.activeRoundNumber = null;
    }

    _createMarkerIcon(type, roundNumber) {
        const modifier = type === 'guess' ? 'guess' : 'correct';
        return L.divIcon({
            className: 'orbit-results-marker',
            html: `<span class="orbit-results-marker__dot orbit-results-marker__dot--${modifier}">${roundNumber}</span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
        });
    }
}

window.OrbitResultsOverlay = OrbitResultsOverlay;
