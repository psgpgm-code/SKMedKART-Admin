SKMedKART V5.9.3 PERMANENT LOGIN FIX

ROOT CAUSE FIXED:
The previous admin.js file had a JavaScript syntax error in the deleteBatch function:
window.deleteBatch=async(id=>{ ... })

Because of that syntax error, the browser could not load the ENTIRE admin.js module.
Therefore adminLogin(), the Login button, password error messages, dashboard opening, and all other JavaScript features could fail.

FIX:
window.deleteBatch=async (id)=>{ ... }

Additional:
- New service-worker cache name to force fresh files
- New cache-busting version for admin.js
- Existing Firebase login and password error handling retained
- Order cancel auto-restock retained
- Billing discount retained
- Customer reminder retained
- Stock/batch delete option retained
