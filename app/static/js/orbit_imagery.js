/**
 * Orbit imagery API client.
 * Fetches random NASA satellite images from the FastAPI backend.
 */
(function initOrbitImagery(global) {
    const RANDOM_IMAGE_ENDPOINT = '/api/orbit/random';

    /**
     * @typedef {Object} OrbitMetadata
     * @property {number} latitude
     * @property {number} longitude
     * @property {string} layer
     * @property {string} date
     * @property {string} bbox
     */

    /**
     * @typedef {Object} OrbitImagePayload
     * @property {OrbitMetadata} metadata
     * @property {string} image_base64
     */

    /**
     * Request a random orbit image with metadata from the backend.
     * @returns {Promise<OrbitImagePayload>}
     */
    async function fetchRandomImage() {
        const response = await fetch(`${RANDOM_IMAGE_ENDPOINT}?format=json`);

        if (!response.ok) {
            let message = `Failed to fetch orbit image (${response.status})`;
            try {
                const errorBody = await response.json();
                if (errorBody.detail) {
                    message = typeof errorBody.detail === 'string'
                        ? errorBody.detail
                        : message;
                }
            } catch {
                // Response body is not JSON — keep the default message.
            }
            throw new Error(message);
        }

        return response.json();
    }

    /**
     * Convert a base64 JPEG string into a blob object URL for <img src>.
     * Caller should revoke the URL when replacing the image.
     * @param {string} base64
     * @returns {string}
     */
    function base64ToObjectUrl(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'image/jpeg' });
        return URL.createObjectURL(blob);
    }

    global.OrbitImagery = {
        fetchRandomImage,
        base64ToObjectUrl,
    };
})(window);
