SKMedKART V5.8 - REAL PWA INSTALL FIX

This package removes the hard-coded /SKMedKART-Admin/ GitHub Pages path that can break PWA installation when the repository name/path is different.

Changes made:
1. manifest.webmanifest now uses relative paths (./)
2. service worker automatically detects the current GitHub Pages repository path
3. service worker registration uses ./service-worker.js and scope ./
4. the Install App button is hidden until Chrome provides a real native PWA install prompt
5. the old fallback popup and shortcut instructions are removed
6. no Create shortcut fallback is triggered by the app

Upload ALL extracted files to the ROOT of the same GitHub repository, replacing the old files. Do not put the files inside an extra folder.
