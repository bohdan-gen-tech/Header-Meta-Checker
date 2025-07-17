// ==UserScript==
// @name         Experimental Header/Meta Checker
// @namespace    http://tampermonkey.net/
// @version      2025.07.17.1
// @description  Checks meta tag reliably and TRIES to parse header content via re-fetch (unreliable method).
// @author       Bohdan S.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    // A list of "funnel" paths on get-honey.ai that should use inverted logic.
    const funnelPaths = [
     '' // add funnels links without domain get-honey.ai. Only the second part after / 
    ];
    // -----------------

    /**
     * Determines which color logic to apply based on the current URL.
     * "Standard" logic means index/follow is good (green).
     * "Inverted" logic means noindex/nofollow is good (green).
     * @returns {boolean} - True for standard logic, false for inverted logic.
     */
    function shouldUseStandardLogic() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        if (hostname === 'get-honey.ai') {
            // If on get-honey.ai, check if it's NOT a funnel path.
            // If it's not a funnel, standard logic applies.
            return !funnelPaths.includes(pathname);
        }

        // For all other websites, inverted logic applies by default.
        return false;
    }

    /**
     * Main function that runs all checks after the page loads.
     * It orchestrates the meta tag check, the header check, and the display of the results.
     */
    async function runChecks() {
        const metaResult = checkMetaTag();
        const headerResult = await checkHeaderTag();

        displaySplitBanner(metaResult, headerResult);
        logToConsole(metaResult.message, metaResult.status);
        logToConsole(headerResult.message, headerResult.status);
    }

    /**
     * Checks the document's <head> for a <meta name="robots"> tag.
     * Determines the message and status based on the tag's content and the site's logic.
     * @returns {{message: string, status: string}} An object containing the display message and the status ('ok', 'bad', 'not-found').
     */
    function checkMetaTag() {
        const metaTag = document.querySelector('meta[name="robots"]');
        let message, status;

        if (metaTag) {
            const content = metaTag.getAttribute('content');
            message = `Meta tag: content="${content}"`;
            const isRestrictive = content.toLowerCase().includes('noindex') || content.toLowerCase().includes('nofollow');

            status = shouldUseStandardLogic() ?
                (isRestrictive ? 'bad' : 'ok') :
                (isRestrictive ? 'ok' : 'bad');
        } else {
            message = 'Meta tag: not found';
            status = 'not-found';
        }
        return { message, status };
    }

    /**
     * TRIES to check the X-Robots-Tag header by making a new HEAD request to the current URL.
     * This is an experimental/unreliable method.
     * @returns {Promise<{message: string, status: string}>} A promise that resolves with an object containing the display message and the status.
     */
    function checkHeaderTag() {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "HEAD",
                url: window.location.href,
                onload: function(response) {
                    let message, status;

                    const headerMatch = response.responseHeaders.match(/x-robots-tag:\s*(.*)/i);
                    const isStandard = shouldUseStandardLogic();

                    if (headerMatch) {
                        const headerValue = headerMatch[1].trim();
                        message = `Header: x-robots-tag: ${headerValue}`;

                        const isRestrictive = headerValue.toLowerCase().includes('noindex') || headerValue.toLowerCase().includes('nofollow');
                        status = isStandard ? (isRestrictive ? 'bad' : 'ok') : (isRestrictive ? 'ok' : 'bad');
                    } else {
                        message = 'Header: not found';
                        status = isStandard ? 'ok' : 'bad';
                    }
                    resolve({ message, status });
                },
                onerror: function(response) {
                    resolve({ message: 'Header: request error', status: 'not-found' });
                }
            });
        });
    }

    /**
     * Creates and displays a two-part banner on the screen with the results.
     * @param {{message: string, status: string}} meta - The result object from the meta tag check.
     * @param {{message: string, status: string}} header - The result object from the header check.
     */
    function displaySplitBanner(meta, header) {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '20px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.fontSize = '12px';

        const metaDiv = document.createElement('div');
        metaDiv.textContent = meta.message;
        metaDiv.style.padding = '10px 12px';
        metaDiv.style.color = 'white';
        metaDiv.style.backgroundColor = getStatusColor(meta.status);

        const headerDiv = document.createElement('div');
        headerDiv.textContent = header.message;
        headerDiv.style.padding = '10px 12px';
        headerDiv.style.color = 'white';
        headerDiv.style.backgroundColor = getStatusColor(header.status);
        headerDiv.style.borderLeft = '2px solid rgba(255, 255, 255, 0.5)';

        const closeButton = document.createElement('span');
        closeButton.textContent = '✖';
        closeButton.style.padding = '10px 12px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontWeight = 'bold';
        closeButton.style.backgroundColor = '#616161';
        closeButton.style.color = 'white';
        closeButton.onclick = () => container.remove();

        container.appendChild(metaDiv);
        container.appendChild(headerDiv);
        container.appendChild(closeButton);
        document.body.appendChild(container);
    }

    /**
     * Returns a hex color code based on a given status string.
     * @param {string} status - The status string ('ok', 'bad', 'not-found').
     * @returns {string} A hex color code.
     */
    function getStatusColor(status) {
        switch (status) {
            case 'ok': return '#388E3C'; // Green
            case 'bad': return '#D32F2F'; // Red
            case 'not-found': return '#F57C00'; // Orange
            default: return '#616161';
        }
    }

    /**
     * Logs a styled message to the developer console.
     * @param {string} message - The message to log.
     * @param {string} status - The status string, used for coloring.
     */
    function logToConsole(message, status) {
        let style = 'font-weight: bold; padding: 2px 5px; border-radius: 3px; color: white;';
        style += `background-color: ${getStatusColor(status)};`;
        const icon = status === 'ok' ? '✅' : (status === 'bad' ? '❌' : '⚠️');
        console.log(`%c${icon} ${message}`, style);
    }

    // Run the checks after the page is fully loaded.
    window.addEventListener('load', runChecks);

})();