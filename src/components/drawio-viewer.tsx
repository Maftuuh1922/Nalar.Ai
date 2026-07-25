"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { DrawIoEmbed } from "react-drawio";
import type { DrawIoEmbedRef } from "react-drawio";

interface DrawioViewerProps {
  xml: string;
  onDiagramChange?: (xml: string) => void;
  readonly?: boolean;
}

export function DrawioViewer({ xml, onDiagramChange, readonly = false }: DrawioViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const drawioRef = useRef<DrawIoEmbedRef>(null);

  // We load the XML via the ref when Draw.io is ready or when XML changes
  useEffect(() => {
    if (isReady && drawioRef.current) {
        const emptyDiagram = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
        drawioRef.current.load({ xml: xml || emptyDiagram });
    }
  }, [xml, isReady]);

  const handleLoad = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleAutoSave = (data: { xml?: string }) => {
    if (onDiagramChange && data.xml) {
      onDiagramChange(data.xml);
    }
  };

  return (
    <div className={`border-gray-300 overflow-hidden shadow-sm bg-white ${isFullscreen ? 'fixed inset-4 z-[9999] shadow-2xl rounded-xl border' : readonly ? 'my-4 border rounded-xl h-[500px] w-full relative' : 'h-full w-full relative'}`}>
        <div className="absolute top-3 right-4 z-10 flex gap-2">
            <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="bg-white/95 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
            >
                {isFullscreen ? "Tutup Layar Penuh" : "Buka Layar Penuh"}
            </button>
        </div>
        <div className="w-full h-full relative" style={{ minHeight: '300px' }}>
            <DrawIoEmbed
                ref={drawioRef}
                autosave={!readonly}
                onAutoSave={!readonly ? handleAutoSave : undefined}
                onLoad={handleLoad}
                urlParameters={{
                    ui: "kennedy",
                    spin: true,
                    libraries: true,
                    saveAndExit: false,
                    noSaveBtn: true,
                    noExitBtn: true,
                    // If readonly, we still use the editor but maybe we could hide sidebars,
                    // but react-drawio is primarily an editor.
                }}
            />
        </div>
    </div>
  );
}
