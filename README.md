# UniAttest - Blockchain-Based Degree Attestation System

UniAttest is a full-stack degree attestation portal for students, university staff, and public verifiers. It issues PDF certificates with verifiable issuance details, stores degree hashes on Polygon Amoy, and lets employers verify credentials without logging in.

## Features

- Student registration and JWT login
- Multi-step student application flow with OCR-assisted field extraction
- Optional ID photo + selfie face verification before document upload
- Resumable application drafts, explicit submission, and withdrawal/reapply flow
- Role-based admin workflow for review, approval, rejection, and issuance
- Canonical SHA-256 degree hash generation on issuance
- Optional Polygon Amoy smart contract storage
- Public verification by local degree hash or Amoy transaction hash
- PDF certificates generated with PDFKit
- Certificate QR codes that open the UniAttest verification page
- Super admin account management

## System Flow

```text
Student registers -> saves application draft
        |
Optional OCR + face verification
        |
Student uploads documents -> explicitly submits for review
        |
Admin reviews -> approval
        |
Admin issues degree
        |
One canonical SHA-256 hash is generated and submitted to Polygon Amoy
        |
Student downloads PDF certificate with hash, transaction hash, and QR code
        |
Employer verifies using local hash or Amoy transaction hash
```

## Roles

| Role | What they can do | Created by |
|---|---|---|
| `student` | Submit applications, upload documents, track status, download certificates | Public registration |
| `admin` | Review applications and manage workflow actions allowed by routes | Super admin |
| `super_admin` | Manage admins and all admin-level actions | `setup-admin.js` |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT access tokens and refresh tokens |
| Blockchain | Solidity, Hardhat, Polygon Amoy |
| Certificates | PDFKit, QRCode |
| OCR and AI support | Tesseract/OCR routes, Flask face service |
| Face verification | DeepFace, OpenCV |
| File uploads | Multer |

## Project Structure

```text
uni-attest/
  client/                         React + Vite frontend
    src/
      components/
        FaceVerification.jsx
        Navbar.jsx
        ProtectedRoute.jsx
      pages/
        VerifyDegree.jsx
        student/
        admin/
  server/                         Express API
    src/
      controllers/                auth, student, admin, verify, face
      middleware/
      models/                     User, Application, Document, Degree
      routes/                     /api/auth /api/student /api/admin /api/verify /api/face
      services/                   hash, blockchain, pdf
  blockchain/                     Hardhat smart contract project
    contracts/DegreeAttestation.sol
    scripts/deploy.js
  face_service.py                 Optional Flask face verification service
  yolov8n.pt                      Legacy model asset (unused by current verification)
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB local or Atlas
- Git
- Python 3.10+ if using face verification
- Windows or macOS for PDF OCR (`pdf-poppler` does not support Linux)
- Polygon Amoy test MATIC if using blockchain storage

### 1. Clone

```bash
git clone https://github.com/Azmeer-59189/uni-attest.git
cd uni-attest
```

### 2. Configure backend environment

```bash
cd server
cp .env.example .env
```

Minimum local config:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/degree_attestation
JWT_SECRET=your-strong-secret-here
REFRESH_TOKEN_SECRET=your-refresh-secret-here
CLIENT_URL=http://localhost:5173
UNIVERSITY_NAME=My University
```

Optional blockchain config:

```env
AMOY_RPC_URL=https://polygon-amoy.drpc.org
PRIVATE_KEY=your-wallet-private-key-without-0x
CONTRACT_ADDRESS=0x...
```

Optional face service config:

```env
FACE_SERVICE_URL=http://127.0.0.1:5001
```

### 3. Install dependencies

```bash
cd server
npm install

cd ../client
npm install

cd ../blockchain
npm install
```

### 4. Create the first super admin

```bash
cd server
node setup-admin.js
```

The script creates `admin@university.edu` with a randomly generated password printed once in the terminal. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12?72 bytes) before running it. Existing accounts are left unchanged. Use **Account ? Change password** after signing in; password changes invalidate existing sessions.

### 5. Run the app

Open two terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

### 6. Optional face verification service

```bash
pip install flask flask-cors opencv-python numpy deepface
python face_service.py
```

The Express backend calls `FACE_SERVICE_URL`, defaulting to `http://127.0.0.1:5001`.

## Local blockchain development (no faucet required)

Use this mode while Amoy faucets are unavailable or impose eligibility checks. Keep MongoDB running and keep the existing database/JWT configuration in `server/.env`. Stop your existing frontend and backend terminals with Ctrl+C, then run from the project root:

```powershell
cd C:\Projects\uni-attest
npm.cmd run dev:local
```

This one command compiles and deploys the real contract to Hardhat on `127.0.0.1:8545` (chain ID 1337), then starts Express on port 5000 and Vite on port 5173. It uses Hardhat's first pre-funded test account through the localhost RPC; no MetaMask private key, mining, or purchased tokens are needed. Dependencies must already be installed in `server`, `client`, and `blockchain`.

Open `http://localhost:5173` and use your existing accounts. Create a new application, upload documents, submit, review, approve, and issue. Verification should say **Verified on Local Test Blockchain**. These are development proofs, not public Amoy records. Local transactions do not link to Amoy Polygonscan.

Keep the terminal running. Ctrl+C stops all three development processes. Restarting creates a new empty local chain; old local-chain records remain in MongoDB but their blockchain proof will no longer be found. Local records store their chain ID and contract address and cannot be silently verified against another network or contract. Use a fresh application for a new test run.

Your `server/.env` and Amoy wallet are not changed by this command. To return to Amoy, stop the local stack, configure Amoy in `server/.env`, and use the normal backend/frontend startup commands. A pending issuance must be retried on its original network and contract.

Run `npm run test:local` from `server` to exercise the full local stack against a disposable MongoDB database on alternate ports, without touching your existing accounts.

## Blockchain

The smart contract stores degree hashes on Polygon Amoy.

```solidity
function issueDegree(bytes32 _degreeHash) external
function verifyDegree(bytes32 _degreeHash) external view returns (bool, uint256, address, string)
```

Deploy to Amoy:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network amoy
```

Copy the deployed contract address into `server/.env` as `CONTRACT_ADDRESS`.

Issuance first saves an immutable snapshot of the certificate details and its canonical SHA-256 hash. The application enters `issuing` while a worker holds a ten-minute lease. A failed operation stays retryable using the same admin issue action, snapshot, and hash. An abandoned lease can be reclaimed after ten minutes. Once issuance starts, the application cannot be rejected or withdrawn.

When blockchain credentials are configured, issuance requires confirmed on-chain storage. `BLOCKCHAIN_REQUIRED=true` also enforces this when configuration is missing. For local-only issuance, remove `PRIVATE_KEY` and `CONTRACT_ADDRESS` and leave `BLOCKCHAIN_REQUIRED=false`. PDF generation must succeed before issuance completes. Retries reconcile an existing chain record and reuse any saved transaction hash.

The certificate QR opens the UniAttest verification page. The page distinguishes local snapshot/hash integrity from live Amoy verification. Blockchain failure or a missing on-chain record never reports a blockchain-backed degree as verified. Historical degree records without a saved snapshot are flagged `legacy_unverified`; they require manual comparison with original issuance evidence. The application does not fabricate snapshots from current profile data or automatically rewrite historical hashes.

Both `admin` and `super_admin` can review, approve, and issue. Department and registrar roles are not currently separate permissions. Issued degrees cannot be rejected; revocation requires a future explicit workflow and contract change.

Supporting documents and selfies are private. Owners and admins can fetch them through authenticated `/api/files/documents/:id` and `/api/files/photos/:userId` routes. Only certificates with valid saved snapshots are publicly downloadable. Production hosting must proxy `/api` and `/uploads/certificates` to Express and must not expose the upload directory directly.

Face verification requires exactly one detected face in each image and uses the model's default comparison threshold. It compares two supplied images; it does not establish document authenticity or provide liveness detection. The displayed similarity score is not a calibrated probability. The Python service binds to localhost by default; use `FACE_SERVICE_HOST` only when deployment requires a different interface.

## API Endpoints

### Auth - `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register student |
| POST | `/login` | Login |
| GET | `/me` | Get current user |
| POST | `/refresh` | Rotate a refresh token |
| POST | `/logout` | Invalidate access and refresh tokens |
| POST | `/change-password` | Change password and invalidate sessions |

### Student - `/api/student`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/applications` | Get current student's applications |
| POST | `/applications` | Save a new draft |
| PATCH | `/applications/:id` | Edit your draft details |
| POST | `/applications/:id/submit` | Submit a draft with documents for review |
| GET | `/applications/:id` | Get one application |
| POST | `/applications/:id/documents` | Upload application documents |
| PUT | `/applications/:id/documents/:documentId` | Replace a draft document (`document` multipart field) |
| DELETE | `/applications/:id/documents/:documentId` | Remove a draft document |
| PATCH | `/applications/:id/withdraw` | Withdraw a draft or pending application |
| GET | `/degrees` | Get issued degrees |

### Admin - `/api/admin`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Dashboard statistics |
| GET | `/applications` | Paginated search; `view=active`, `history`, or `all`, plus optional `status` |
| GET | `/applications/:id` | Get one application |
| PATCH | `/applications/:id/review` | Start review |
| PATCH | `/applications/:id/approve` | Approve application |
| PATCH | `/applications/:id/reject` | Reject application |
| POST | `/applications/:id/issue` | Issue degree and certificate |
| GET | `/degrees` | List issued degrees |
| GET | `/admins` | List admins |
| POST | `/admins` | Create admin |
| PATCH | `/admins/:id/toggle` | Activate/deactivate admin |

### Verify - `/api/verify`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/:hash` | Verify by degree hash or Amoy transaction hash |

### Face Verification - `/api/face`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/verify` | Verify ID photo and selfie |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | API port, default `5000` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `REFRESH_TOKEN_SECRET` | Yes | Refresh token secret |
| `CLIENT_URL` | Yes | Frontend URL for CORS and certificate links |
| `UNIVERSITY_NAME` | Yes | University name shown on certificates |
| `FACE_SERVICE_URL` | Optional | Face service URL, default `http://127.0.0.1:5001` |
| `AMOY_RPC_URL` | Optional | Polygon Amoy RPC endpoint |
| `PRIVATE_KEY` | Optional | Issuer wallet private key |
| `CONTRACT_ADDRESS` | Optional | Deployed DegreeAttestation contract |
| `BLOCKCHAIN_REQUIRED` | Optional | Require blockchain-backed issuance even without credentials |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional | First super-admin setup overrides |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional | Enables student status emails; all except the port are required to turn them on. Port 465 uses TLS, others STARTTLS |
| `MAIL_FROM` | Optional | Sender address for status emails, default `SMTP_USER` |

## Roadmap

- [x] Student registration and login
- [x] Student application workflow
- [x] OCR-assisted application details
- [x] Face verification integration
- [x] Pending application withdrawal
- [x] Admin review and issuance workflow
- [x] SHA-256 degree hash generation
- [x] Polygon Amoy contract integration
- [x] Public verification page
- [x] PDF certificate generation
- [x] Certificate QR code with UniAttest verification lookup
- [x] Email notifications
- [x] Authenticated admin document download
- [ ] Inline admin document preview
- [ ] IPFS decentralized document storage
- [ ] Production deployment

## Basic application flow

1. Save application details as a draft. CGPA can be left blank.
2. Complete or skip the optional photo comparison.
3. Upload at least one supporting document and check the saved details. Draft files can be replaced or removed before submission.
4. Click **Submit application for review**. Details and documents are then locked.
5. An admin starts review, approves or rejects with a reason, and issues approved degrees.
6. Students see status and feedback on their dashboard and can download issued certificates.
7. Certificate QR links open verification automatically.

Refreshing or leaving the application page preserves saved drafts and uploaded documents. Drafts are excluded from the admin review queue. One active application per student is enforced by a partial unique MongoDB index (MongoDB 6+). Existing pending records without documents remain completable but cannot enter review until documents are attached. Submitted applications can be withdrawn while pending; rejected or withdrawn applications allow a new application.

The admin queue opens on **Needs attention**, showing pending, in-review, approved, and interrupted issuance records, oldest submissions first, with how long each has waited. **Completed** contains issued, rejected, and withdrawn applications; **All** includes both groups. Selecting an application opens it beside the queue with all review actions; on phones the record replaces the list and the browser's Back button returns to it. While focus is in the queue, the arrow keys or J and K move between records. Search, status, page, page size, and the open record are kept in the URL. The default page size is twenty.

Each application has a separate detail page for its academic record, private documents, review actions, certificate, and activity history. Students open **View details & history** from their dashboard. New actions record the actor's name, role, timestamp, and relevant comments or file names atomically with the application change. Existing applications start recording with their next action; earlier history is not reconstructed. Replacing or removing files is allowed only while the application is a draft. Detached files lose download access immediately, including if disk cleanup is deferred.

When SMTP is configured, students are emailed when their application is submitted, approved, or rejected (with the reason), and when their certificate is issued (with its public verification link). Emails are sent in the background: a mail failure is logged and never blocks or fails the action. Without SMTP settings no email is sent, and students see changes on their overview. The application does not promise a review completion date.

## Checks

Use Node.js 20.19+ for development checks (the isolated MongoDB test dependency requires it). Install dependencies in each subproject first.

```bash
cd client
npm run build
cd ../server
npm test -- --runInBand
cd ../blockchain
npm test
cd ..
python -m unittest test_face_service.py
```

For the browser walkthrough, run `npm run test:flow` from `server`. It uses a separate temporary MongoDB database, checks draft recovery and document replacement/removal, skips the optional photo service, tests a populated inbox with pagination and retained filters, checks activity history, performs admin review and issuance, downloads a real PDF, and checks automatic verification and desktop/tablet/mobile layout. Chromium must be available to Puppeteer. Screenshots are written to the ignored `server/test-artifacts/` directory.

Backend tests start a disposable MongoDB instance and never use `MONGODB_URI`. The first run downloads its MongoDB binary. Blockchain tests use Hardhat's local network and do not submit Amoy transactions. Face validation tests mock the model dependencies; real biometric accuracy and liveness are outside their scope. GitHub Actions runs these checks on Windows.

Access tokens last 15 minutes; refresh tokens last seven days and rotate on use. A user has one stored refresh-token chain, so signing in again replaces the previous refresh session. Logout and password changes invalidate all access tokens for that user. Tokens are stored in browser local storage; applications must continue to prevent script injection.

## License

MIT License. See [LICENSE](LICENSE).

## Author

Syed Azmeer

- GitHub: [@Azmeer-59189](https://github.com/Azmeer-59189)
- Project: [github.com/Azmeer-59189/uni-attest](https://github.com/Azmeer-59189/uni-attest)
