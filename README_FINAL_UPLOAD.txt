SKMedKART V5.8 PRO MAX - ALL FIXED

IMPORTANT: This ZIP is the complete website package.

What is fixed:
1. Install App / PWA files included: manifest, service worker and icons.
2. Install button uses the Chrome install prompt when Chrome makes it available; otherwise it shows Add to Home screen steps.
3. Service worker cache version changed, so the old cached app is replaced after GitHub Pages update and reload.
4. Online customer order has a red Cancel Order button. Cancelled orders cannot be billed or edited.
5. Shop bill copy shows Sri Krishna Medicals, Kaveri Road, Pennagaram, Dharmapuri District, Tamil Nadu, phone 8300363317, Drug Licence TN/DPI/01386/20,21 and FSSAI Licence 22422039000512.
6. Critical bill-delete bug fixed: deleteDoc is now imported from Firestore. A returned bill deleted with Delete Record is actually removed from Firebase, so it will not reappear after refresh.
7. Refresh Data now reloads the page and requests current live Firebase data.

UPLOAD:
- Delete old website files from the SAME admin repository.
- Extract this ZIP.
- Upload ALL extracted files and the icons folder to the repository root.
- Commit changes.
- Wait for GitHub Pages deployment, then open the site and do a hard reload / close and reopen Chrome.

Do not upload only index.html. All files are required.
