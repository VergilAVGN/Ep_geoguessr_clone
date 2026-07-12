/**
 * Orbit Game page controller.
 * Owns page-specific setup; the guessing map itself lives in guess_map.js.
 */

(function initOrbitGame() {
    /** @type {GuessMap|null} */
    let guessMap = null;

    /** @type {string|null} Reserved for future POST /api/games session id */
    let activeGameId = null;

    /** @type {object|null} Metadata for the currently displayed orbit image */
    let currentImageMetadata = null;

    /** @type {string|null} Object URL for the current JPEG blob */
    let currentImageObjectUrl = null;

    /** @type {boolean} */
    let isLoadingImage = false;

    document.addEventListener('DOMContentLoaded', () => {
        setupGuessMap();
        setupSatelliteViewport();
        setupNewImageButton();
    });

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
            loadRandomImage();
        });
    }

    /**
     * Fetch and display a random satellite image from the backend.
     */
    async function loadRandomImage() {
        if (isLoadingImage) {
            return;
        }

        const imageEl = document.getElementById('orbit-satellite-image');
        const newImageBtn = document.getElementById('orbit-new-image-btn');

        if (!imageEl) {
            return;
        }

        isLoadingImage = true;
        if (newImageBtn) {
            newImageBtn.disabled = true;
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
            await startOrbitRound(payload.metadata);
        } catch (error) {
            console.error('[Orbit] Failed to load satellite image:', error);
        } finally {
            isLoadingImage = false;
            if (newImageBtn) {
                newImageBtn.disabled = false;
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
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to start orbit round (${response.status})`);
            }

            const payload = await response.json();
            activeGameId = payload.id;
        } catch (error) {
            console.error('[Orbit] Failed to start round:', error);
        }
    }

    /**
     * Submit the selected guess to the backend and visualize the round result.
     * @param {{ lat: number, lon: number }} coords
     */
    async function handleGuess(coords) {
        console.info('[Orbit] Guess submitted:', coords);

        if (!activeGameId) {
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
            guessMap?.showRoundResult(result);
            guessMap?.setScorePanel({
                score: result.score,
                distanceKm: result.distance,
                label: 'Round result',
            });
        } catch (error) {
            console.error('[Orbit] Guess API error:', error);
        }
    }

    window.orbitGame = {
        getGuessMap() {
            return guessMap;
        },
        getCurrentImageMetadata() {
            return currentImageMetadata;
        },
        loadRandomImage,
        setGameId(gameId) {
            activeGameId = gameId;
        },
        getGameId() {
            return activeGameId;
        },
    };
})();
