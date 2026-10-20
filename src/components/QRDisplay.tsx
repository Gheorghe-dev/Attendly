'use client';
import { useEffect, useState } from 'react';

export function QRDisplay({
  qr, url, sessionName, courseName, onClose,
}: {
  qr: string;
  url: string;
  sessionName: string;
  courseName: string;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' || e.key === 'F') setFullscreen(f => !f);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function copyUrl() {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white flex flex-col transition-all duration-300 ${
          fullscreen
            ? 'fixed inset-0 rounded-none'
            : 'rounded-3xl shadow-2xl max-w-lg w-full'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {!fullscreen && (
          <div className="p-6 pb-0 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{courseName}</h2>
              <p className="text-gray-500 text-sm mt-0.5">{sessionName}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* QR */}
        <div className={`flex-1 flex flex-col items-center justify-center p-8 ${fullscreen ? 'min-h-0' : ''}`}>
          {fullscreen && (
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold text-gray-900">{courseName}</h1>
              <p className="text-gray-500 mt-1">{sessionName}</p>
            </div>
          )}
          <div className="bg-white p-4 rounded-3xl shadow-lg border-4 border-blue-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR Code for attendance"
              className={fullscreen ? 'w-80 h-80' : 'w-64 h-64'}
            />
          </div>
          {fullscreen && (
            <p className="text-lg text-gray-600 text-center">Scan with your phone camera to register attendance</p>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 pt-0 space-y-3 ${fullscreen ? 'bg-gray-50 border-t border-gray-100' : ''}`}>
          {!fullscreen && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
              <p className="text-sm text-gray-700 font-mono flex-1 break-all">{url}</p>
              <button onClick={copyUrl}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex-shrink-0 px-2 py-1 rounded hover:bg-blue-50">
                Copy
              </button>
            </div>
          )}
          {fullscreen && (
            <div className="mt-6 bg-white/70 rounded-2xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">URL (if camera will not scan)</p>
              <div className="flex items-center gap-2">
                <p className="text-base text-gray-900 font-mono flex-1 break-all text-center">{url}</p>
              </div>
              <button onClick={copyUrl}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl transition-all">
                Copy URL
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all"
            >
              {fullscreen ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                  Exit Full Screen
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Full Screen (Projector)
                </>
              )}
            </button>
            {!fullscreen && (
              <button onClick={onClose}
                className="flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 px-5 rounded-xl transition-all">
                Close
              </button>
            )}
          </div>
          {!fullscreen && (
            <p className="text-center text-xs text-gray-400">
              Press <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">F</kbd> for fullscreen · <kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">Esc</kbd> to close
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
