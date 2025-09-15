/**
 * Assignment system initialization hook
 * Import this file to automatically initialize the assignment system on server startup
 */

// Only run on server side
if (typeof window === 'undefined') {
  // Import the server startup service
  import('./server-startup').then(({ initializeServer }) => {
    // Small delay to ensure other systems are ready
    setTimeout(async () => {
      try {
        console.log("🔄 Auto-initializing assignment system...");
        await initializeServer();
        console.log("✅ Assignment system auto-initialization completed");
      } catch (error) {
        console.error("❌ Assignment system auto-initialization failed:", error);
        console.log("⚠️ Assignment system will need to be manually initialized via API");
      }
    }, 2000); // 2 second delay to ensure database and other services are ready
  }).catch(error => {
    console.error("❌ Failed to import server startup service:", error);
  });
}

// Export a function that can be called manually if needed
export async function initializeAssignmentSystem(): Promise<void> {
  const { initializeServer } = await import('./server-startup');
  return initializeServer();
}

// Export status checking function
export async function getAssignmentSystemStatus(): Promise<any> {
  const { getServerStatus } = await import('./server-startup');
  return getServerStatus();
}