// ==UserScript==
// @name         Header/Meta Checker
// @namespace    http://tampermonkey.net/
// @version      2025.07.23.3
// @description  Added new funnels. Fix color funnel logic on panel. For funnels, checks robots.txt and header. For other pages, checks meta and header. With fallback logic for misconfigured funnels.
// @author       Bohdan S.
// @match        *://*/*
// @exclude      https://form-v2.charge-auth.com/*
// @exclude      https://pay.google.com/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @updateURL    https://raw.githubusercontent.com/bohdan-gen-tech/Header-Meta-Checker/main/header-meta-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/bohdan-gen-tech/Header-Meta-Checker/main/header-meta-checker.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    // A list of "funnel" paths on get-honey.ai that should use inverted logic.
    const funnelPaths = [
     '' // add funnels links without domain get-honey.ai. Only the second part after / 
    ];

    const robotsTxtUrl = ''; // <-- add robotxt path
    // -----------------

    /**
     * Normalizes the current URL's path by removing a trailing slash if it exists.
     * This ensures '/path/' and '/path' are treated as the same.
     * @returns {string} The normalized path.
     */
    function getNormalizedPathname() {
        let pathname = window.location.pathname;
        if (pathname.length > 1 && pathname.endsWith('/')) {
            return pathname.slice(0, -1);
        }
        return pathname;
    }

    /**
     * The main function that orchestrates all checks.
     * It determines if the current page is a funnel and calls the appropriate checking functions.
     */
    async function runChecks() {
        const hostname = window.location.hostname;
        const pathname = getNormalizedPathname();
        const isFunnel = hostname === 'get-honey.ai' && funnelPaths.includes(pathname);

        let leftPanelResult;
        if (isFunnel) {
            // For funnel pages, the first check is against robots.txt.
            const robotsResult = await checkRobotsTxtForPath(pathname);
            if (robotsResult.status === 'ok') {
                // If the funnel is correctly disallowed in robots.txt, we show that result.
                leftPanelResult = robotsResult;
            } else {
                // If the funnel is NOT in robots.txt (a misconfiguration),
                // we fall back to checking its meta tag instead.
                leftPanelResult = checkMetaTag();
            }
        } else {
            // For all non-funnel pages, we check the meta tag.
            leftPanelResult = checkMetaTag();
        }

        // The right panel of the banner ALWAYS shows the header check result, regardless of page type.
        const rightPanelResult = await checkHeaderTag();

        // Display the results in the on-screen banner.
        displaySplitBanner(leftPanelResult, rightPanelResult);
    }

    /**
     * Determines which color logic to apply (Standard or Inverted).
     * @returns {boolean} - True for standard logic, false for inverted logic.
     */
    function shouldUseStandardLogic() {
        const hostname = window.location.hostname;
        const pathname = getNormalizedPathname();

        if (hostname === 'get-honey.ai') {
            // Standard logic applies if it's on get-honey.ai AND it's NOT a funnel.
            return !funnelPaths.includes(pathname);
        }
        // Inverted logic (noindex is good) applies to all other websites.
        return false;
    }

    /**
     * Checks robots.txt to see if a given path is disallowed by any rule.
     * @param {string} currentPath - The URL pathname to check (already normalized).
     * @returns {Promise<{message: string, status: string}>}
     */
    function checkRobotsTxtForPath(currentPath) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "GET",
                url: robotsTxtUrl,
                onload: function(response) {
                    const robotsTxtContent = response.responseText;

                    // 1. Get a list of all disallowed paths from the file content.
                    const disallowedPaths = robotsTxtContent.split('\n')
                        .map(line => line.trim().toLowerCase())
                        .filter(line => line.startsWith('disallow:'))
                        .map(line => line.substring('disallow:'.length).trim());

                    // 2. Check if the current page path starts with any of the disallowed paths.
                    const isDisallowed = disallowedPaths.some(disallowedPath => {
                        // Normalize the path from robots.txt to handle trailing slashes consistently.
                        let normalizedDisallowedPath = disallowedPath;
                        if (normalizedDisallowedPath.length > 1 && normalizedDisallowedPath.endsWith('/')) {
                             normalizedDisallowedPath = normalizedDisallowedPath.slice(0, -1);
                        }
                        // Ignore empty rules like "Disallow:".
                        if (normalizedDisallowedPath === '') return false;
                        // Check for an exact match (e.g., /path) or a sub-path match (e.g., /path/sub).
                        return currentPath === normalizedDisallowedPath || currentPath.startsWith(normalizedDisallowedPath + '/');
                    });

                    if (isDisallowed) {
                        // Correct for a funnel: it IS disallowed in robots.txt.
                        resolve({ message: `robots.txt: Disallowed`, status: 'ok' });
                    } else {
                        // Incorrect for a funnel: it is NOT disallowed in robots.txt.
                        resolve({ message: `robots.txt: NOT Disallowed`, status: 'bad' });
                    }
                },
                onerror: function() {
                    resolve({ message: 'robots.txt: Fetch Error', status: 'not-found' });
                }
            });
        });
    }

    /**
     * Checks the document's <head> for a <meta name="robots"> tag.
     * @returns {{message: string, status: string}}
     */
    function checkMetaTag() {
        const metaTag = document.querySelector('meta[name="robots"]');
        let message, status;

        if (metaTag) {
            const content = metaTag.getAttribute('content');
            message = `Meta: content="${content}"`;
            const isRestrictive = content.toLowerCase().includes('noindex') || content.toLowerCase().includes('nofollow');
            // Determine status ('ok' or 'bad') based on whether standard or inverted logic applies.
            status = shouldUseStandardLogic() ?
                (isRestrictive ? 'bad' : 'ok') :
                (isRestrictive ? 'ok' : 'bad');
        } else {
            message = 'Meta: tag not found';
            status = 'not-found';
        }
        return { message, status };
    }

    /**
     * TRIES to check the X-Robots-Tag header by making a new HEAD request to the current URL.
     * @returns {Promise<{message: string, status: string}>}
     */
    function checkHeaderTag() {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "HEAD",
                url: window.location.href,
                onload: function(response) {
                    let message, status;
                    // Use regex to find the x-robots-tag and its value in the response headers string.
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
                    resolve({ message: 'Header: Request error', status: 'not-found' });
                }
            });
        });
    }

    // --- Display and Helper Functions ---

    /**
     * Creates and displays a two-part banner on the screen with the results.
     * @param {{message: string, status: string}} left - The result object for the left panel.
     * @param {{message: string, status: string}} right - The result object for the right panel.
     */
    function displaySplitBanner(left, right) {
        // Remove any existing banner to prevent duplicates if the script runs again.
        const existingBanner = document.getElementById('robots-checker-banner');
        if (existingBanner) {
            existingBanner.remove();
        }

        const container = document.createElement('div');
        container.id = 'robots-checker-banner';
        container.style.cssText = "position:fixed; bottom:20px; left:20px; z-index:99999; display:flex; box-shadow:0 4px 12px rgba(0,0,0,0.4); border-radius:8px; overflow:hidden; font-family:Arial, sans-serif; font-size:12px;";

        const leftDiv = document.createElement('div');
        leftDiv.textContent = left.message;
        leftDiv.style.cssText = `padding:10px 12px; color:white; background-color:${getStatusColor(left.status)};`;

        const rightDiv = document.createElement('div');
        rightDiv.textContent = right.message;
        rightDiv.style.cssText = `padding:10px 12px; color:white; background-color:${getStatusColor(right.status)}; border-left:2px solid rgba(255,255,255,0.5);`;

        const closeButton = createCloseButton(container);
        container.appendChild(leftDiv);
        container.appendChild(rightDiv);
        container.appendChild(closeButton);
        document.body.appendChild(container);
    }

    /**
     * Creates a close button for the banner.
     * @param {HTMLElement} container - The banner element to be removed on click.
     * @returns {HTMLElement} The close button element.
     */
    function createCloseButton(container) {
        const closeButton = document.createElement('span');
        closeButton.textContent = '✖';
        closeButton.style.cssText = "padding:10px 12px; cursor:pointer; font-weight:bold; background-color:#616161; color:white;";
        closeButton.onclick = () => container.remove();
        return closeButton;
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

    // Run all checks after the page is fully loaded.
    window.addEventListener('load', runChecks);

})();
