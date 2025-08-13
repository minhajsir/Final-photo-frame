# QR OTP Photo Composite — Split Deploy (Vercel + Render)

## Structure
- `client/` — React (Vite). Deploy to **Vercel**. Output dir: `dist`.
- `server/` — Express + Twilio Verify + sharp. Deploy to **Render**.

## Deploy Backend on Render
1. New **Web Service** → point to `server/` folder.
2. Build Command: `npm install`
3. Start Command: `node index.js`
4. Environment Variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`
   - `FRONTEND_ORIGIN` = your Vercel URL (e.g., `https://yourapp.vercel.app`)
   - `PORT` = 5000 (optional)
5. Deploy → copy the service URL (e.g., `https://your-backend.onrender.com`).

## Deploy Frontend on Vercel
1. New Project → point to `client/` folder.
2. Environment Variable: `VITE_API_URL` = your Render backend URL.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Deploy.

## Local Dev
- Backend:
  ```bash
  cd server
  cp .env.example .env  # fill values
  npm install
  node index.js
  ```
- Frontend:
  ```bash
  cd client
  cp .env.example .env  # set VITE_API_URL=http://localhost:5000
  npm install
  npm run dev
  ```
