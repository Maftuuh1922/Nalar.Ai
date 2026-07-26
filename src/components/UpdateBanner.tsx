'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function UpdateBanner() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Current version injected by CLI into .env.local
    const cv = process.env.NEXT_PUBLIC_CLI_VERSION;
    if (cv) setCurrentVersion(cv);

    // Fetch latest version from NPM registry
    const checkVersion = async () => {
      try {
        const res = await fetch('https://registry.npmjs.org/nalar-ai-cli/latest');
        const data = await res.json();
        if (data && data.version) {
          setLatestVersion(data.version);
        }
      } catch (e) {
        console.error('Failed to check for updates', e);
      }
    };

    checkVersion();
    // Poll every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed) return null;
  if (!latestVersion || !currentVersion) return null;
  if (latestVersion === currentVersion) return null;

  return (
    <>
      <div 
        onClick={() => setShowPopup(true)}
        className="w-full bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 px-4 py-2 text-sm font-mono flex items-center justify-center gap-4 cursor-pointer hover:bg-yellow-500/20 transition-colors z-50 relative"
      >
        <span>
          <span className="font-bold">UPDATE AVAILABLE:</span> Nalar AI CLI v{latestVersion} is out! (You are on v{currentVersion}). Click to see how to update.
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 hover:bg-yellow-500/20 rounded-full ml-4"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0f0f13] border border-white/10 p-6 max-w-md w-full relative">
            <button 
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-4">Update Available</h3>
            <p className="text-white/70 mb-4 text-sm leading-relaxed">
              A new version of Nalar AI CLI is available (<strong>v{latestVersion}</strong>). Please update to get the latest features and bug fixes.
            </p>
            <div className="bg-black/50 p-4 border border-white/5 rounded-none font-mono text-sm text-blue-400">
              npm install -g nalar-ai-cli@latest
            </div>
            <p className="text-white/50 mt-4 text-xs">
              Run this command in your terminal/CMD, then restart your Nalar AI server.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
