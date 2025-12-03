import { useEffect } from 'react';

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

  return null; 
}
