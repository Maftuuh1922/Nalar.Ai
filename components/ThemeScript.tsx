/**
 * ThemeScript - Initializes theme from localStorage before React hydration
 * This prevents the flash of wrong theme on page load.
 *
 * Rendered as a plain <script> inside <head>: next/script's
 * "beforeInteractive" strategy is Pages-Router-only and throws a React
 * client error in the App Router, so a raw script tag (which App Router
 * renders server-side into <head> before hydration) is the supported way.
 */
export default function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        let stored = localStorage.getItem('nalar-ai-theme');
        const styleVersion = localStorage.getItem('nalar-ai-theme-style-version');

        if (styleVersion !== 'ascii-v1') {
          stored = 'ascii';
          localStorage.setItem('nalar-ai-theme', 'ascii');
          localStorage.setItem('nalar-ai-theme-style-version', 'ascii-v1');
        }

        document.documentElement.classList.remove('dark', 'theme-glass', 'theme-snow', 'theme-ascii');

        if (stored === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (stored === 'glass') {
          document.documentElement.classList.add('dark', 'theme-glass');
        } else if (stored === 'snow') {
          document.documentElement.classList.add('theme-snow');
        } else if (stored === 'light') {
          // already clean
        } else if (stored === 'ascii') {
          document.documentElement.classList.add('theme-ascii');
        } else {
          document.documentElement.classList.add('theme-ascii');
          localStorage.setItem('nalar-ai-theme', 'ascii');
        }
      } catch (e) {
        /* localStorage may be disabled */
      }
    })();
  `

  return <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeScript }} />
}
