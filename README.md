# Header-Meta-Checker

Tampermonkey userscript to check <meta name="robots"> and X-Robots-Tag on any webpage, with conditional coloring logic for specific domains and paths.

This tool is designed for developers and QA to quickly diagnose the SEO indexing rules of a live webpage. It displays a color-coded, on-screen panel with the status of both the HTML meta tag and the X-Robots-Tag HTTP header.

## ✅ Features

🔎 Dual Check:

Reliably checks the page's HTML for a <meta name="robots"> tag and displays its content.

Experimentally tries to check the X-Robots-Tag by making a new background request. Note: This method is not 100% reliable and may differ from the initial page load.

🎨 Conditional Coloring:

The definition of a "good" (✅ Green) vs. "bad" (❌ Red) state changes based on the URL.

Standard Logic: For sites like the get-honey.ai homepage, index, follow is considered good.

Inverted Logic: For all other sites and specific "funnel" pages on get-honey.ai, noindex, nofollow is considered good.

🖥️ On-Screen Panel:

Displays a compact, two-part panel at the bottom-left of the screen.

Provides a clear, at-a-glance summary of the indexing rules.

The panel can be dismissed by clicking the "✖" button.

## 🔗 Installation

1. Install [Tampermonkey extension](https://www.tampermonkey.net/).
2. Enable [Developer mode](https://www.tampermonkey.net/faq.php?locale=en#Q209) and allow userscripts.
3. [Install](https://raw.githubusercontent.com/bohdan-gen-tech/Header-Meta-Checker/main/header-meta-checker.user.js) userscript
4. Configure Funnel Paths (Important)
The script's core logic depends on a list of "funnel" paths where indexing rules are different. For security, the public version of this script on GitHub may contain an empty or incomplete list. You must configure it manually.

   - Click the Tampermonkey icon in your browser, then select **Dashboard**.
   - Find **"Experimental Header/Meta Checker"** in the list and click the **edit** icon.
   - Scroll to the `// --- CONFIGURATION ---` section.
   - Update the `funnelPaths` array with the correct paths from your internal documentation (e.g., your Confluence page).

    ```javascript
    // --- CONFIGURATION ---
    // A list of "funnel" paths on get-honey.ai that should use inverted logic.
    const funnelPaths = [
        // ...add other funnels from your documentation here
    ];
    // -----------------
    ```

   - Press **Ctrl + S** (or Cmd + S on Mac) to save the script. It is now fully configured and ready to use.
