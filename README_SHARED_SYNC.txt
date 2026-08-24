SKMedKART Shared Stock System

Both ZIP files are connected to the SAME Firestore collection: products.

ONE-TIME REQUIRED SETUP:
1. Open firebase-config.js in BOTH apps.
2. Paste the EXACT SAME Firebase Web App configuration in both files.
3. Publish/redeploy both apps.
4. Use the Admin App and Billing App normally.

Result:
- Add stock in Admin -> appears in Billing App.
- Add stock or purchase in Billing -> appears in Admin.
- Update stock in Admin -> Billing sees the new quantity.
- Save bill in Billing -> shared stock is deducted.
- Both apps must use the same Firebase project.

Important: Existing old local stock is not automatically uploaded to Firebase. Add/import your current stock once into the shared database before relying on online sync.
