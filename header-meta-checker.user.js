// ==UserScript==
// @name         Header/Meta Checker
// @namespace    http://tampermonkey.net/
// @version      2025.07.18.2
// @description  For funnels, checks robots.txt and header. For other pages, checks meta and header. No console output.
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

    const robotsTxtUrl = ''; // <-- add robotxt path
    // -----------------

    /**
     * The main function that orchestrates all checks.
     */
    async function runChecks() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        const isFunnel = hostname === 'get-honey.ai' && funnelPaths.includes(pathname);

        let leftPanelResult;
        if (isFunnel) {
            // For funnels, the left panel shows the robots.txt check result.
            leftPanelResult = await checkRobotsTxtForPath(pathname);
        } else {
            // For all other pages, the left panel shows the meta tag check result.
            leftPanelResult = checkMetaTag();
        }

        // The right panel ALWAYS shows the header check result.
        const rightPanelResult = await checkHeaderTag();

        displaySplitBanner(leftPanelResult, rightPanelResult);
    }

    /**
     * Determines which color logic to apply.
     * @returns {boolean} - True for standard logic, false for inverted logic.
     */
    function shouldUseStandardLogic() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        if (hostname === 'get-honey.ai') {
            // Standard logic applies if it's on get-honey.ai AND it's NOT a funnel.
            return !funnelPaths.includes(pathname);
        }
        // Inverted logic for all other websites.
        return false;
    }

    /**
     * Checks robots.txt to see if a given path is disallowed.
     * @param {string} pathToCheck - The URL pathname to check.
     * @returns {Promise<{message: string, status: string}>}
     */
    function checkRobotsTxtForPath(pathToCheck) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "GET",
                url: robotsTxtUrl,
                onload: function(response) {
                    const robotsTxtContent = response.responseText;
                    const disallowPattern = new RegExp(`^Disallow:\\s*${pathToCheck}(/)?\\s*$`, "im");

                    if (disallowPattern.test(robotsTxtContent)) {
                        // Correct for a funnel: it IS disallowed.
                        resolve({
                            message: `robots.txt: Disallowed`,
                            status: 'ok'
                        });
                    } else {
                        // Incorrect for a funnel: it is NOT disallowed.
                        resolve({
                            message: `robots.txt: NOT Disallowed`,
                            status: 'bad'
                        });
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
     * TRIES to check the X-Robots-Tag header by making a new HEAD request.
     * @returns {Promise<{message: string, status: string}>}
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
                    resolve({ message: 'Header: Request error', status: 'not-found' });
                }
            });
        });
    }

    // --- Display and Helper Functions ---

    function displaySplitBanner(left, right) {
        const container = document.createElement('div');
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

    function createCloseButton(container) {
        const closeButton = document.createElement('span');
        closeButton.textContent = '✖';
        closeButton.style.cssText = "padding:10px 12px; cursor:pointer; font-weight:bold; background-color:#616161; color:white;";
        closeButton.onclick = () => container.remove();
        return closeButton;
    }

    function getStatusColor(status) {
        switch (status) {
            case 'ok': return '#388E3C'; // Green
            case 'bad': return '#D32F2F'; // Red
            case 'not-found': return '#F57C00'; // Orange
            default: return '#616161';
        }
    }

    window.addEventListener('load', runChecks);

})();
