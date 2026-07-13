/**
 * Orbit Game page controller.
 * Owns page-specific setup; the guessing map itself lives in guess_map.js.
 */

(function initOrbitGame() {
    /** @type {GuessMap|null} */
    let guessMap = null;

    /** @type {OrbitResultsOverlay|null} */
    let resultsOverlay = null;

    /** @type {HTMLElement|null} */
    let gameRootEl = null;

    /** @type {string|null} */
    let activeGameId = null;

    /** @type {object|null} */
    let currentImageMetadata = null;

    /** @type {string|null} */
    let currentImageObjectUrl = null;

    /** @type {boolean} */
    let isLoadingImage = false;

    /** @type {number} */
    let currentRoundNumber = 1;

    /** @type {number} */
    let totalRounds = 5;

    /** @type {number} */
    let totalScore = 0;

    /** @type {boolean} */
    let gameFinished = false;

    /** @type {{ roundNumber: number, score: number|null }[]} */
    let roundResults = Array.from({ length: 5 }, (_, index) => ({
        roundNumber: index + 1,
        score: null,
    }));

    document.addEventListener('DOMContentLoaded', () => {
        gameRootEl = document.querySelector('.orbit-game');
        setupResultsOverlay();
        setupGuessMap();
        setupSatelliteViewport();
        setupNewImageButton();
        renderRoundOverview();
    });

    function setupResultsOverlay() {
        resultsOverlay = new OrbitResultsOverlay({
            onPlayAgain: () => {
                restartGame();
            },
        });
        resultsOverlay.init();
    }

    function setupSatelliteViewport() {
        const imageEl = document.getElementById('orbit-satellite-image');
        if (imageEl) {
            imageEl.style.visibility = 'hidden';
        }

        loadRandomImage();
    }

    function setupNewImageButton() {
        const newImageBtn = document.getElementById('orbit-new-image-btn');
        if (!newImageBtn) {
            return;
        }

        newImageBtn.addEventListener('click', () => {
            if (!gameFinished) {
                loadRandomImage();
            }
        });
    }

    function syncRoundResults() {
        roundResults = Array.from({ length: totalRounds }, (_, index) => {
            const roundNumber = index + 1;
            const existing = roundResults.find((entry) => entry.roundNumber === roundNumber);
            return existing || { roundNumber, score: null };
        });
    }

    function renderRoundOverview() {
        const overviewEl = document.getElementById('orbit-round-overview');
        if (!overviewEl) {
            return;
        }

        syncRoundResults();

        overviewEl.innerHTML = roundResults
            .map((entry) => {
                const scoreText = entry.score == null ? '--' : entry.score;
                const classes = ['orbit-game__round-card'];
                if (entry.roundNumber === currentRoundNumber && entry.score == null) {
                    classes.push('is-active');
                }
                if (entry.score != null) {
                    classes.push('is-complete');
                }

                return `
                    <div class="${classes.join(' ')}">
                        <span class="orbit-game__round-number">${entry.roundNumber}</span>
                        <span class="orbit-game__round-score">${scoreText}</span>
                    </div>
                `;
            })
            .join('');
    }

    async function loadRandomImage() {
        if (isLoadingImage || gameFinished) {
            return;
        }

        const imageEl = document.getElementById('orbit-satellite-image');
        const newImageBtn = document.getElementById('orbit-new-image-btn');
        const nextRoundBtn = document.getElementById('guess-map-next-round');

        if (!imageEl) {
            return;
        }

        isLoadingImage = true;
        if (newImageBtn) {
            newImageBtn.disabled = true;
        }
        if (nextRoundBtn) {
            nextRoundBtn.disabled = true;
        }

        try {
            const payload = await OrbitImagery.fetchRandomImage();

            if (currentImageObjectUrl) {
                URL.revokeObjectURL(currentImageObjectUrl);
            }

            currentImageObjectUrl = OrbitImagery.base64ToObjectUrl(payload.image_base64);
            currentImageMetadata = payload.metadata;

            imageEl.src = currentImageObjectUrl;
            imageEl.style.visibility = 'visible';

            guessMap?.reset();
            guessMap?.enterActiveMode();
            await startOrbitRound(payload.metadata);
        } catch (error) {
            console.error('[Orbit] Failed to load satellite image:', error);
        } finally {
            isLoadingImage = false;
            if (newImageBtn) {
                newImageBtn.disabled = false;
            }
            if (nextRoundBtn && !nextRoundBtn.hidden) {
                nextRoundBtn.disabled = false;
            }
        }
    }

    function setupGuessMap() {
        guessMap = new GuessMap({
            onCoordsChange(coords) {
                console.debug('[Orbit] guess coords:', coords);
            },
            onGuess(coords) {
                handleGuess(coords);
            },
            onNextRound() {
                loadRandomImage();
            },
        });

        guessMap.init();
        window.orbitGuessMap = guessMap;
    }

    async function startOrbitRound(metadata) {
        if (!metadata) {
            return;
        }

        try {
            const response = await fetch('/api/orbit/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: metadata.latitude,
                    lon: metadata.longitude,
                    game_id: activeGameId || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to start orbit round (${response.status})`);
            }

            const payload = await response.json();
            activeGameId = payload.id;
            currentRoundNumber = payload.round_number;
            totalRounds = payload.total_rounds;
            totalScore = payload.total_score;
            syncRoundResults();
            renderRoundOverview();
        } catch (error) {
            console.error('[Orbit] Failed to start round:', error);
        }
    }

    async function handleGuess(coords) {
        console.info('[Orbit] Guess submitted:', coords);

        if (!activeGameId || !guessMap?.isGuessingEnabled) {
            return;
        }

        try {
            const response = await fetch('/api/orbit/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeGameId,
                    lat: coords.lat,
                    lon: coords.lon,
                }),
            });

            if (!response.ok) {
                throw new Error(`Guess submission failed (${response.status})`);
            }

            const result = await response.json();
            totalScore = result.total_score;
            totalRounds = result.total_rounds;
            roundResults = roundResults.map((entry) =>
                entry.roundNumber === result.round_number
                    ? { ...entry, score: result.score }
                    : entry,
            );

            if (!result.game_finished) {
                currentRoundNumber = result.round_number + 1;
            } else {
                currentRoundNumber = result.round_number;
            }

            syncRoundResults();
            renderRoundOverview();
            guessMap?.showRoundResult(result);
            guessMap?.setScorePanel({
                score: result.score,
                distanceKm: result.distance,
                label: 'Round result',
            });
            gameFinished = result.game_finished;
            guessMap?.enterReviewMode({ showNextRound: !result.game_finished });

            if (result.game_finished) {
                await showFinalResults();
            }
        } catch (error) {
            console.error('[Orbit] Guess API error:', error);
        }
    }

    async function showFinalResults() {
        if (!activeGameId || !resultsOverlay) {
            return;
        }

        try {
            const response = await fetch(`/api/orbit/${activeGameId}/results`);
            if (!response.ok) {
                throw new Error(`Failed to load final results (${response.status})`);
            }

            const results = await response.json();
            gameRootEl?.classList.add('is-results-active');

            window.setTimeout(() => {
                resultsOverlay.show(results);
            }, 450);
        } catch (error) {
            console.error('[Orbit] Failed to show final results:', error);
        }
    }

    function restartGame() {
        resultsOverlay?.hide();
        gameRootEl?.classList.remove('is-results-active');

        if (currentImageObjectUrl) {
            URL.revokeObjectURL(currentImageObjectUrl);
            currentImageObjectUrl = null;
        }

        activeGameId = null;
        currentImageMetadata = null;
        gameFinished = false;
        currentRoundNumber = 1;
        totalRounds = 5;
        totalScore = 0;
        roundResults = Array.from({ length: totalRounds }, (_, index) => ({
            roundNumber: index + 1,
            score: null,
        }));

        const imageEl = document.getElementById('orbit-satellite-image');
        if (imageEl) {
            imageEl.removeAttribute('src');
            imageEl.style.visibility = 'hidden';
        }

        renderRoundOverview();
        guessMap?.reset();
        guessMap?.enterActiveMode();
        loadRandomImage();
    }

    window.orbitGame = {
        getGuessMap() {
            return guessMap;
        },
        getCurrentImageMetadata() {
            return currentImageMetadata;
        },
        loadRandomImage,
        restartGame,
        setGameId(gameId) {
            activeGameId = gameId;
        },
        getGameId() {
            return activeGameId;
        },
    };
})();
