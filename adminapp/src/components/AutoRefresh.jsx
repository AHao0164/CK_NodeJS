import { useEffect } from 'react';

/**
 * AutoRefresh component - automatically refreshes the page at specified intervals
 * Useful for admin dashboards that need to stay updated 24/7
 * 
 * @param {number} intervalMinutes - Refresh interval in minutes (default: 60)
 * @param {boolean} enabled - Enable/disable auto-refresh (default: true)
 */
export default function AutoRefresh({ intervalMinutes = 60, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`[AutoRefresh] Enabled with interval: ${intervalMinutes} minutes`);
    
    const intervalId = setInterval(() => {
      console.log(`[AutoRefresh] Refreshing page at ${new Date().toLocaleString('vi-VN')}`);
      window.location.reload();
    }, intervalMs);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
      console.log('[AutoRefresh] Disabled');
    };
  }, [intervalMinutes, enabled]);

  return null; // This component doesn't render anything
}
