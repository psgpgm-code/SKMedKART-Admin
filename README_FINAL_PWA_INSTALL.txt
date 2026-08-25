SKMedKART V5.8 PRO MAX — FINAL PWA INSTALL FIX

WHAT WAS ACTUALLY WRONG
The previous package used only relative PWA paths and registered the service worker with a version query string.
That can work, but for a GitHub Pages project site it is safer to use the exact project path:
  /SKMedKART-Admin/

THIS FINAL PACKAGE FIXES
1. Explicit GitHub Pages start_url and scope
2. Explicit manifest path
3. Explicit service-worker path and scope
4. 192 and 512 icons
5. Maskable 192 and 512 icons
6. Standalone mobile-app metadata
7. New service-worker cache name
8. Install guide no longer tells the user to create a shortcut

UPLOAD METHOD — IMPORTANT
A. Open the GitHub repository: SKMedKART-Admin
B. On branch: main
C. Delete the old files in the repository root, including the old icons folder.
D. Upload ALL files and folders from this ZIP to the repository root.
E. Commit the changes.
F. Wait for GitHub Pages deployment to complete.
G. In Chrome, clear the old site data once if an old version still appears.
H. Open:
   https://psgpgm-code.github.io/SKMedKART-Admin/
I. Wait about 10 seconds after the page loads.
J. Tap Install App.

IMPORTANT TEST RESULT
- If Chrome shows a real install confirmation, proceed with Install.
- If it shows 'Create shortcut', tap Cancel. Do NOT add the shortcut.
- Then clear old site data, reopen the URL, and test once again.

DO NOT mix these files with files from an older package.
