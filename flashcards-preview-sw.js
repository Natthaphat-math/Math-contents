/* The flashcards preview has been merged into the live app (flashcards.html).
   This replaces the preview's offline helper: it deletes the preview's saved copy,
   unregisters itself and sends any open preview window to the live app. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('flashcards-preview-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach(w => w.navigate('flashcards.html'));
  })());
});
