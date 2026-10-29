# Replacing the previous version (this version takes over)

Every file in this package has the **same name and folder** as in the previous version, so merging simply overwrites the old files. Nothing is renamed or removed, and your Netlify settings and environment variables are not touched.

## Files in this package
```
index.html                                  <- the app (replaces the old one)
404.html
netlify.toml                                <- replaces the old one (adds no-cache headers and the /api/training-assistant route)
netlify/functions/customer-response.js      <- same name, unchanged logic
netlify/functions/customer.js
netlify/functions/transcribe.js
netlify/functions/training-assistant.js
netlify/functions/lib/common.js
README.md, CHANGELOG.md, MERGE-INSTRUCTIONS.md, .env.example
```

## Option A — GitHub website (simplest)
1. Unzip `airline-call-simulator.zip` on your computer.
2. Open your repository on github.com (the one Netlify deploys from), on the branch Netlify publishes (usually `main`).
3. Main folder: **Add file → Upload files**, drag in `index.html`, `404.html`, `netlify.toml`, `README.md`, `CHANGELOG.md`, `MERGE-INSTRUCTIONS.md`, `.env.example` → **Commit changes**. Same names = the old files are replaced.
4. Open `netlify/functions`: **Add file → Upload files**, drag in the four `.js` files → commit. Do the same for `netlify/functions/lib/common.js`.
5. Netlify redeploys automatically; wait for **Published** under Deploys.

## Option B — Git
Copy the contents of the unzipped folder over your local clone, then `git add -A`, `git commit -m "v11.0 Booking Verification Workspace"`, `git push`.

## Option C — Pull request (to review first)
Create a branch, add the files as above, open a pull request, and merge it into the production branch. Netlify publishes when the merge lands. The deploy preview shows the new version before you merge.

## What is NOT replaced or deleted
- Files that exist only in your repo (for example `netlify/functions/simsimi.js`, if you have it) stay as they are. Do not delete them.
- Your Netlify environment variables (GEMINI_API_KEY, GROQ_API_KEY and so on) stay as they are.
- Stray copies such as `Test_5_index.html` or older `*.html` files are not used by the site; you may delete them to avoid confusion, but it is not required.

## Check that the new version took over
1. Press **Ctrl+Shift+R** on your site. The header shows the tag **v11.0** next to the title.
2. The start screen has a new card **Booking Verification Workspace**.
3. Start a call: a **📋 Booking Verification** button appears.
4. `https://YOUR-SITE.netlify.app/api/training-assistant` and `/.netlify/functions/customer-response` still show `"configured":true` for the services you had working.

## Data from the previous version
Saved settings in the browser (Training Mode, scripts, practice history and so on) keep working. The new feature stores its own records under separate `acs_ws_` keys, so nothing from the old version is overwritten.

## Rolling back
In GitHub open the merge commit and press **Revert**, or restore the previous commit. Netlify redeploys the old version.
