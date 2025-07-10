// Enhanced cleanup handlers for Electron main process
import { app } from 'electron';
import { BlackmagicSender } from './blackmagic/BlackmagicSender';

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, performing graceful shutdown...`);
  
  try {
    // Stop all Blackmagic operations first
    BlackmagicSender.shutdown();
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Graceful shutdown complete');
    
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
  } finally {
    process.exit(0);
  }
}

// Enhanced memory monitoring
function startMemoryMonitoring() {
  const monitorInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const bmUsage = BlackmagicSender.getMemoryUsage();
    
    // Log if memory usage is high
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
      console.warn('High memory usage detected:', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        blackmagic: bmUsage
      });
      
      // Force cleanup if memory is very high
      if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB threshold
        console.warn('Forcing Blackmagic cleanup due to high memory usage');
        BlackmagicSender.performGlobalCleanup();
        
        if (global.gc) {
          global.gc();
        }
      }
    }
  }, 30000); // Check every 30 seconds
  
  // Clear monitoring on app quit
  app.on('before-quit', () => {
    clearInterval(monitorInterval);
  });
}

// Setup all handlers
export function setupCleanupHandlers() {
  // Handle various exit signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle segmentation faults more gracefully
  process.on('SIGSEGV', async () => {
    console.error('Segmentation fault detected!');
    
    try {
      // Quick cleanup without waiting
      BlackmagicSender.stopAll();
    } catch (err) {
      console.error('Error during SIGSEGV cleanup:', err);
    }
    
    process.exit(1);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    
    // Try to cleanup Blackmagic resources
    try {
      BlackmagicSender.stopAll();
    } catch (cleanupErr) {
      console.error('Error during cleanup after uncaught exception:', cleanupErr);
    }
    
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection at:', promise, 'reason:', reason);
    
    // If it's related to Blackmagic, try cleanup
    if (reason && typeof reason === 'object' && 
        (reason.toString().includes('macadam') || reason.toString().includes('decklink'))) {
      console.warn('Blackmagic-related promise rejection, performing cleanup');
      BlackmagicSender.performGlobalCleanup();
    }
  });
  
  // Electron app handlers
  app.on('before-quit', async (event) => {
    console.log('App about to quit, cleaning up...');
    
    // Prevent immediate quit to allow cleanup
    event.preventDefault();
    
    try {
      BlackmagicSender.shutdown();
      
      // Allow some time for cleanup
      setTimeout(() => {
        app.exit(0);
      }, 1500);
      
    } catch (err) {
      console.error('Error during app quit cleanup:', err);
      app.exit(1);
    }
  });
  
  app.on('window-all-closed', () => {
    // Clean up before app closes
    BlackmagicSender.stopAll();
    
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  // Start memory monitoring
  startMemoryMonitoring();
  
  console.log('Cleanup handlers initialized');
}

// Call this in your main electron file
setupCleanupHandlers();