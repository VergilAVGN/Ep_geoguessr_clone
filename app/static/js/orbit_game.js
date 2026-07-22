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

    /** @type {boolean} */
    let roundTimerEnabled = true;

    /** @type {boolean} */
    let circleHintsEnabled = true;

    let dataHintsEnabled = true;

    let circleHintUsed = false;

    let dataHintUsed = false;

    /** @type {number} */
    let roundTimerDurationMs = 5 * 60 * 1000;

    /** @type {number|null} */
    let roundTimerIntervalId = null;

    /** @type {number|null} */
    let roundTimerStartedAt = null;

    /** @type {number} */
    let totalElapsedMs = 0;

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
        window.addEventListener('settings-updated', (event) => {
            const nextEnabled = event.detail?.show_timer ?? roundTimerEnabled;
            applyTimerSetting(nextEnabled);
            applyHintSettings(event.detail || {});
        });
        void loadSettings();
    });

    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (!response.ok) {
                throw new Error(`Failed to load settings (${response.status})`);
            }

            const data = await response.json();
            applyTimerSetting(data.show_timer ?? true);
            applyHintSettings(data);
        } catch (error) {
            console.error('[Orbit] Failed to load settings:', error);
        }
    }

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

        stopRoundTimer({ persistElapsed: true });

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
            startRoundTimer();
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
                if (activeGameId) {
                    persistLastGuess(coords);
                }
            },
            onGuess(coords) {
                handleGuess(coords);
            },
            onNextRound() {
                loadRandomImage();
            },
        });

        guessMap.init();
        setupHintButton();
        window.orbitGuessMap = guessMap;
    }

    function setupHintButton() {
        const circleHintBtn = document.getElementById('guess-map-circle-hint');
        const dataHintBtn = document.getElementById('guess-map-data-hint');
        if (!circleHintBtn || !dataHintBtn) {
            return;
        }

        circleHintBtn.addEventListener('click', async () => {
            if (!activeGameId || !circleHintsEnabled || circleHintBtn.disabled) {
                return;
            }
            circleHintBtn.disabled = true;

            try {
                const response = await fetch(`/api/orbit/hint/${activeGameId}`);
                if (!response.ok) {
                    throw new Error(`Hint request failed (${response.status})`);
                }

                const hint = await response.json();
                guessMap?.clearHintCircles();
                guessMap?.addHintCircle(hint.center_lat, hint.center_lon, hint.radius_km * 1000, {
                    color: '#4ea5ff',
                    fillColor: '#bfdbfe',
                    fillOpacity: 0.2,
                });
                circleHintUsed = true;
                setHintButtonVisibility();
            } catch (error) {
                console.error('[Orbit] Failed to load hint:', error);
                if (circleHintsEnabled && Boolean(activeGameId)) {
                    circleHintBtn.disabled = false;
                }
            }
        });

        dataHintBtn.addEventListener('click', async () => {
            if (!activeGameId || !dataHintsEnabled || dataHintBtn.disabled) {
                return;
            }
            dataHintBtn.disabled = true;
            try {
                const response = await fetch(`/api/orbit/hint/${activeGameId}/data`);
                if (!response.ok) {
                    throw new Error(`Data hint request failed (${response.status})`);
                }
                showHintFacts((await response.json()).facts || []);
                dataHintUsed = true;
                setHintButtonVisibility();
            } catch (error) {
                console.error('[Orbit] Failed to load data hint:', error);
                if (dataHintsEnabled && Boolean(activeGameId)) {
                    dataHintBtn.disabled = false;
                }
            }
        });

        setHintButtonVisibility();
    }

    function showHintFacts(facts) {
        const resultsEl = document.getElementById('guess-map-scan-results');
        if (!resultsEl || !facts.length) {
            return;
        }

        resultsEl.replaceChildren(
            ...facts.map((fact) => {
                const item = document.createElement('div');
                item.className = 'guess-map-panel__scan-line';
                item.textContent = fact;
                return item;
            }),
        );
        resultsEl.hidden = false;
    }

    function setHintButtonVisibility() {
        const isRoundActive = Boolean(activeGameId) && !gameFinished;
        const buttons = [
            [document.getElementById('guess-map-circle-hint'), circleHintsEnabled && !circleHintUsed],
            [document.getElementById('guess-map-data-hint'), dataHintsEnabled && !dataHintUsed],
        ];
        buttons.forEach(([button, enabled]) => {
            if (button) {
                button.hidden = !enabled || !isRoundActive;
                button.disabled = !enabled || !isRoundActive;
            }
        });
    }

    function applyHintSettings(settings) {
        const legacyHintsEnabled = settings.show_hints ?? true;
        circleHintsEnabled = settings.show_circle_hints ?? legacyHintsEnabled;
        dataHintsEnabled = settings.show_data_hints ?? legacyHintsEnabled;
        setHintButtonVisibility();
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
                    layer: metadata.layer,
                    date: metadata.date,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to start orbit round (${response.status})`);
            }

            const payload = await response.json();
            activeGameId = payload.id;
            circleHintUsed = false;
            dataHintUsed = false;
            currentRoundNumber = payload.round_number;
            totalRounds = payload.total_rounds;
            totalScore = payload.total_score;
            syncRoundResults();
            renderRoundOverview();
            setHintButtonVisibility();
        } catch (error) {
            console.error('[Orbit] Failed to start round:', error);
        }
    }

    function persistLastGuess(coords) {
        if (!activeGameId) {
            return;
        }

        window.localStorage.setItem(`orbit-last-guess-${activeGameId}`, JSON.stringify(coords));
    }

    function getLastPersistedGuess() {
        if (!activeGameId) {
            return null;
        }

        try {
            const stored = window.localStorage.getItem(`orbit-last-guess-${activeGameId}`);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('[Orbit] Failed to read last guess:', error);
            return null;
        }
    }

    async function handleGuess(coords) {
        console.info('[Orbit] Guess submitted:', coords);

        if (!activeGameId || !guessMap?.isGuessingEnabled) {
            return;
        }

        stopRoundTimer({ persistElapsed: true });

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
            setHintButtonVisibility();

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
                resultsOverlay.show({
                    ...results,
                    totalTimeText: roundTimerEnabled ? formatDuration(totalElapsedMs) : 'Timer off',
                });
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
        totalElapsedMs = 0;
        roundResults = Array.from({ length: totalRounds }, (_, index) => ({
            roundNumber: index + 1,
            score: null,
        }));

        const imageEl = document.getElementById('orbit-satellite-image');
        if (imageEl) {
            imageEl.removeAttribute('src');
            imageEl.style.visibility = 'hidden';
        }

        stopRoundTimer({ persistElapsed: false });
        renderRoundOverview();
        guessMap?.reset();
        guessMap?.enterActiveMode();
        syncTimerDisplay();
        setHintButtonVisibility();
        loadRandomImage();
    }

    function applyTimerSetting(enabled) {
        roundTimerEnabled = Boolean(enabled);

        if (!roundTimerEnabled) {
            stopRoundTimer({ persistElapsed: false });
            syncTimerDisplay();
            return;
        }

        if (activeGameId && !gameFinished && !roundTimerIntervalId) {
            startRoundTimer();
        }
    }

    function startRoundTimer() {
        stopRoundTimer({ persistElapsed: true });

        if (!roundTimerEnabled) {
            syncTimerDisplay();
            return;
        }

        roundTimerStartedAt = Date.now();
        syncTimerDisplay();

        roundTimerIntervalId = window.setInterval(() => {
            if (!roundTimerStartedAt) {
                return;
            }

            const elapsed = Date.now() - roundTimerStartedAt;
            const remaining = Math.max(0, roundTimerDurationMs - elapsed);

            if (remaining <= 0) {
                stopRoundTimer({ persistElapsed: true });
                void finishRoundByTimeout();
                return;
            }

            syncTimerDisplay(remaining);
        }, 1000);
    }

    function stopRoundTimer({ persistElapsed = true } = {}) {
        if (roundTimerIntervalId !== null) {
            window.clearInterval(roundTimerIntervalId);
            roundTimerIntervalId = null;
        }

        if (persistElapsed && roundTimerStartedAt && roundTimerEnabled) {
            const elapsed = Date.now() - roundTimerStartedAt;
            if (elapsed > 0) {
                totalElapsedMs += elapsed;
            }
        }

        roundTimerStartedAt = null;
        syncTimerDisplay();
    }

    async function finishRoundByTimeout() {
        const fallbackGuess = getLastPersistedGuess();

        if (!activeGameId || !guessMap?.isGuessingEnabled) {
            return;
        }

        guessMap?.setTimerDisplay('00:00');
        guessMap?.setScorePanel({
            score: null,
            distanceKm: null,
            label: 'Time is up',
        });

        try {
            const response = await fetch('/api/orbit/guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeGameId,
                    lat: fallbackGuess?.lat ?? null,
                    lon: fallbackGuess?.lon ?? null,
                    timed_out: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`Timeout guess failed (${response.status})`);
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
            console.error('[Orbit] Timeout guess API error:', error);
        }
    }

    function syncTimerDisplay(remainingMs = null) {
        const timerPanel = document.getElementById('orbit-timer-panel');
        const timerValueEl = document.getElementById('orbit-timer-value');
        const timerProgressEl = document.getElementById('orbit-timer-progress');

        if (!roundTimerEnabled) {
            if (timerPanel) {
                timerPanel.hidden = true;
                timerPanel.style.display = 'none';
            }
            if (timerProgressEl) {
                timerProgressEl.style.width = '0%';
            }
            guessMap?.setTimerDisplay('');
            return;
        }

        if (remainingMs == null) {
            if (timerPanel) {
                timerPanel.hidden = true;
                timerPanel.style.display = 'none';
            }
            if (timerProgressEl) {
                timerProgressEl.style.width = '0%';
            }
            guessMap?.setTimerDisplay('');
            return;
        }

        const formattedValue = formatCountdown(remainingMs);
        const progressPercent = Math.max(0, Math.min(100, (remainingMs / roundTimerDurationMs) * 100));
        if (timerValueEl) {
            timerValueEl.textContent = formattedValue;
        }
        if (timerProgressEl) {
            timerProgressEl.style.width = `${progressPercent}%`;
        }
        if (timerPanel) {
            timerPanel.hidden = false;
            timerPanel.style.display = 'flex';
        }
        guessMap?.setTimerDisplay(formattedValue);
    }

    function formatCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function formatDuration(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
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
