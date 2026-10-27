# UniAttest - University Degree Attestation System

UniAttest is a university degree attestation system modelled on how a registrar's attestation cell works. Graduates request attestation online and pay by bank challan. The request then passes through document scrutiny, verification against university records, and registrar approval. The output is an attestation certificate that employers can verify by attestation number, hash, or QR code. Certificate hashes can optionally be anchored on Polygon Amoy or a local test chain.

## Features

- Student accounts with name, father's name, CNIC, and registration number
- Attestation requests for a degree, a transcript, or both, with normal or urgent processing
- Application numbers (`UA-YYYY-NNNNNN`) and bank fee challans (`CH-YYYY-NNNNNN`) with a printable three-part voucher
- A document checklist per request type: degree, transcript, CNIC front and back, photograph, paid challan, and optional extras
- A declaration before submission; resumable drafts; withdrawal
- Staged review with separate staff roles: document scrutiny, records verification, registrar approval
- Objections: any stage can return a request to the applicant with a reason and flagged documents; the applicant corrects and resubmits
- Staff verification aids: OCR comparison of a degree or transcript with the declared particulars, and face comparison of the photograph with the CNIC portrait
- A full activity history recording who did what, and when
- Attestation certificates (PDF) with an attestation number, particulars table, registrar signature block, QR code, and SHA-256 verification hash
- Public verification by attestation number or hash, with the CNIC masked
- Email notifications for submission, objection, resubmission, rejection, and issuance; password reset by email
- Optional Polygon Amoy or local Hardhat anchoring of certificate hashes

## System Flow

```text
Student: choose request type and processing -> enter particulars -> upload documents
         -> print challan, pay at bank, enter payment details, upload paid challan
         -> accept declaration -> submit
                     |
Document scrutiny (scrutiny officer): accept or flag each document, verify fee
                     |                         \
Records verification (examination officer)     objection -> student corrects -> resubmits
  checks particulars against the result gazette  (from any stage)        back to scrutiny
                     |
Registrar approval: approve and issue
                     |
Attestation certificate: number + snapshot hash (+ optional blockchain), PDF with QR
                     |
Employer verifies by attestation number, hash, or QR
```

Any stage can also reject a request outright. Rejection is final; an objection is for problems the applicant can fix.

## Roles

| Role | Acts on | Created by |
|---|---|---|
| `student` | Their own requests: details, documents, payment, submission, objection responses | Public registration |
| `scrutiny` | Document scrutiny: accept or flag documents, verify the fee, run OCR and face checks, forward, object, reject | Super admin |
| `examination` | Records verification: confirm particulars against result records with a reference, forward, object, reject | Super admin |
| `registrar` | Registrar approval: approve and issue, object, reject; retry interrupted issuance | Super admin |
| `admin` | Every stage, for offices without separate staff | Super admin |
| `super_admin` | Every stage, plus staff accounts | `setup-admin.js` |

All staff can read every request and its history. Only the roles listed for a stage can act on it.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | JWT access tokens and refresh tokens |
| Blockchain | Solidity, Hardhat, Polygon Amoy |
| Certificates | PDFKit, QRCode |
| Staff verification aids | Tesseract OCR; Flask face service with DeepFace (RetinaFace detector, Facenet model) |
| File uploads | Multer |

## Project Structure

```text
uni-attest/
  client/                         React + Vite frontend
    src/
      components/                 Layout, record sections, dialogs
      pages/
        student/                  Overview, request wizard, fee challan
        admin/                    Staff console, staff accounts
        ApplicationDetail.jsx     Request record with the stage actions for each role
        VerifyDegree.jsx          Public verification
      utils/workflow.js           Shared workflow labels and helpers
  server/                         Express API
    src/
      controllers/                auth, student, admin (staff), verify
      models/                     User, Application, Document, Degree, Counter
      routes/                     /api/auth /api/student /api/admin /api/files /api/verify /api/config
      services/
        workflow.js               Request types, fees, documents, stages, and role permissions
        issuance.js               Registrar approval and certificate issuance
        migrate.js                Moves earlier records onto the staged workflow at startup
        pdf.js, hash.js, notify.js, ocrService.js, faceService.js, blockchain.js
  blockchain/                     Hardhat smart contract project
  face_service.py                 Flask face comparison service used by the scrutiny tool
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

The script creates `admin@university.edu` with a randomly generated password printed once in the terminal. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12–72 bytes) before running it. Existing accounts are left unchanged. Use **Account → Change password** after signing in; password changes invalidate existing sessions.

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

### 6. Create staff accounts

Sign in as the super admin, open **Staff**, and add a scrutiny officer, an examination officer, and a registrar. For a one-person office, create an **Administrator**, who can act at every stage.

### 7. Optional face comparison service

```bash
pip install flask flask-cors opencv-python numpy deepface tf-keras retina-face
python face_service.py
```

The scrutiny officer's **Compare photograph with CNIC** tool calls `FACE_SERVICE_URL`, defaulting to `http://127.0.0.1:5001`. The first comparison after starting downloads or loads the models and can take a minute. Without the service, everything else works; the tool reports that the service is not running.

## Local blockchain development (no faucet required)

Use this mode while Amoy faucets are unavailable or impose eligibility checks. Keep MongoDB running and keep the existing database/JWT configuration in `server/.env`. Stop your existing frontend and backend terminals with Ctrl+C, then run from the project root:

```powershell
cd C:\Projects\uni-attest
npm.cmd run dev:local
```

This one command compiles and deploys the real contract to Hardhat on `127.0.0.1:8545` (chain ID 1337), then starts Express on port 5000 and Vite on port 5173. It uses Hardhat's first pre-funded test account through the localhost RPC; no MetaMask private key, mining, or purchased tokens are needed. Dependencies must already be installed in `server`, `client`, and `blockchain`.

Open `http://localhost:5173` and use your existing accounts. Submit a request, then take it through scrutiny, records verification, and registrar approval. Verification should say **Verified on Local Test Blockchain**. These are development proofs, not public Amoy records. Local transactions do not link to Amoy Polygonscan.

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

Registrar approval issues the certificate. Issuance first saves an immutable snapshot of the attested particulars (name, father's name, CNIC, registration number, session, degree, year, CGPA, request type, and attestation number) and its canonical SHA-256 hash. The application enters `issuing` while a worker holds a ten-minute lease. A failed operation stays retryable using the same registrar action, snapshot, and hash. An abandoned lease can be reclaimed after ten minutes. Once issuance starts, the application cannot be rejected, objected to, or withdrawn.

When blockchain credentials are configured, issuance requires confirmed on-chain storage. `BLOCKCHAIN_REQUIRED=true` also enforces this when configuration is missing. For local-only issuance, remove `PRIVATE_KEY` and `CONTRACT_ADDRESS` and leave `BLOCKCHAIN_REQUIRED=false`. PDF generation must succeed before issuance completes. Retries reconcile an existing chain record and reuse any saved transaction hash.

The certificate QR opens the UniAttest verification page. Verification also accepts the attestation number (`ATT-YYYY-NNNNNN`) and masks all but the last digits of the CNIC. The page distinguishes local snapshot/hash integrity from live Amoy verification. Blockchain failure or a missing on-chain record never reports a blockchain-backed degree as verified. Historical degree records without a saved snapshot are flagged `legacy_unverified`; they require manual comparison with original issuance evidence. The application does not fabricate snapshots from current profile data or automatically rewrite historical hashes.

Issued certificates cannot be rejected; revocation requires a future explicit workflow and contract change. Certificates issued before the staged workflow keep their original snapshot and hash and still verify.

Supporting documents are private. Owners and staff can fetch them through authenticated `/api/files/documents/:id` and `/api/files/photos/:userId` routes. Only certificates with valid saved snapshots are publicly downloadable. Production hosting must proxy `/api` and `/uploads/certificates` to Express and must not expose the upload directory directly.

Face comparison and OCR are aids for the scrutiny officer, not decisions. Face comparison needs the CNIC front and photograph as images; it compares the largest face on the CNIC with the single face in the photograph using the model's default threshold. It does not establish document authenticity or provide liveness detection. OCR compares what it can read on a degree or transcript with the declared particulars and keeps the result on the record. The displayed similarity score is not a calibrated probability. The Python service binds to localhost by default; use `FACE_SERVICE_HOST` only when deployment requires a different interface.

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
| POST | `/forgot-password` | Email a single-use reset link (requires SMTP; 5 requests per 15 minutes per IP) |
| POST | `/reset-password` | Set a new password with a reset token and invalidate sessions |

### Student - `/api/student`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/applications` | Your requests |
| POST | `/applications` | Start a draft request; assigns the application and challan numbers |
| GET | `/applications/:id` | One request |
| PATCH | `/applications/:id` | Edit details while a draft or answering an objection; the fee follows the request type |
| PATCH | `/applications/:id/payment` | Record the payment date and bank reference |
| POST | `/applications/:id/documents` | Upload a document (`kind` and `document` multipart fields); a second upload of the same kind replaces it |
| DELETE | `/applications/:id/documents/:documentId` | Remove a document |
| POST | `/applications/:id/submit` | Submit or resubmit with `{ "declaration": true }`; lists anything missing |
| PATCH | `/applications/:id/withdraw` | Withdraw a draft, a request awaiting scrutiny, or one with an objection |
| GET | `/degrees` | Issued attestation certificates |

### Staff - `/api/admin`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Counts by status, your queue size, and your stages |
| GET | `/applications` | Paginated search; `view=queue` (your stages), `active`, `history`, or `all`, plus `status` and `search` (name, application no., CNIC, registration no.) |
| GET | `/applications/:id` | One request, with `canAct` for your role |
| PATCH | `/applications/:id/documents/:documentId/review` | Scrutiny: mark a document `accepted`, `flagged` (with a note), or `pending` |
| PATCH | `/applications/:id/fee` | Scrutiny: verify the fee payment |
| POST | `/applications/:id/documents/:documentId/ocr` | Scrutiny aid: read a degree or transcript and compare it with the declared particulars |
| POST | `/applications/:id/face-check` | Scrutiny aid: compare the photograph with the CNIC portrait |
| POST | `/applications/:id/forward` | Scrutiny → records verification (needs every required document accepted and the fee verified); records → registrar (needs `recordReference`) |
| POST | `/applications/:id/objection` | Return to the applicant with a `reason`; flagged documents are marked for replacement |
| POST | `/applications/:id/reject` | Reject with a `reason` |
| POST | `/applications/:id/issue` | Registrar: approve and issue the certificate (also retries interrupted issuance) |
| GET | `/degrees` | Issued certificates |
| GET / POST | `/admins` | Super admin: list or create staff with a `role` |
| PATCH | `/admins/:id/toggle` | Super admin: deactivate or reactivate staff |

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/verify/:reference` | Verify by attestation number, certificate hash, or transaction hash |
| GET | `/api/config` | Request types, fees, document kinds, stages, and bank details for the challan |

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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional | Enables student status and password reset emails; all except the port are required to turn them on. Port 465 uses TLS, others STARTTLS |
| `MAIL_FROM` | Optional | Sender address for status emails, default `SMTP_USER` |
| `FEE_BANK_NAME` / `FEE_ACCOUNT_TITLE` / `FEE_ACCOUNT_NUMBER` | Optional | Bank details printed on the fee challan |
| `FEE_CHALLAN_VALID_DAYS` | Optional | Days a challan stays payable, default 15 |
| `FEE_<TYPE>_<SPEED>` | Optional | Override a fee in PKR, e.g. `FEE_DEGREE_URGENT=5000`. Types: `DEGREE`, `TRANSCRIPT`, `DEGREE_TRANSCRIPT`; speeds: `NORMAL`, `URGENT`. Defaults: 2000/4000, 1500/3000, 3000/6000 |

## Roadmap

- [x] Student registration and login
- [x] Attestation request wizard with document checklist
- [x] Bank fee challan and payment verification
- [x] Staged review: scrutiny, records verification, registrar approval
- [x] Objections and resubmission
- [x] Staff OCR and face comparison aids
- [x] Attestation numbers and attestation certificates
- [x] SHA-256 degree hash generation
- [x] Polygon Amoy contract integration
- [x] Public verification page
- [x] PDF certificate generation
- [x] Certificate QR code with UniAttest verification lookup
- [x] Email notifications
- [x] Authenticated admin document download
- [x] Inline document preview
- [x] Password reset by email
- [ ] IPFS decentralized document storage
- [ ] Production deployment

## Attestation workflow in practice

1. **Request.** The student chooses degree, transcript, or both, and normal or urgent processing. The fee is shown before anything is saved.
2. **Details.** Father's name and CNIC prefill from the account. The degree title, session, registration number, and year must match the degree. Saving creates the draft with its application and challan numbers.
3. **Documents.** One upload per checklist item; uploading again replaces it. The photograph must be an image. Up to five optional extra documents.
4. **Fee.** The student prints the three-part challan, pays at the bank, enters the payment date and bank reference, and uploads the stamped applicant copy.
5. **Submit.** The review step lists anything missing, with links back to fix it. Submission requires the declaration and locks the request.
6. **Document scrutiny.** The scrutiny officer opens each document, accepts it or flags it with a note, verifies the fee, and can run the OCR and face aids. Forwarding needs every required document accepted, none flagged, and the fee verified.
7. **Records verification.** The examination officer compares the particulars with the result records and forwards with the reference checked, such as a gazette page.
8. **Registrar approval.** The registrar sees both earlier findings and approves, which issues the certificate.
9. **Objections.** At any stage before issuance, staff can raise an objection. The request returns to the student with the reason and flagged documents. Accepted documents stay accepted; replaced ones go back to "not checked"; a verified fee stays verified. Resubmission returns the request to scrutiny.

Drafts are invisible to staff. One open request per student is enforced by a partial unique MongoDB index (MongoDB 6+). Rejected and withdrawn requests allow a new one.

The staff console opens on **My queue**: the requests at your stages, oldest first, with how long each has waited (urgent requests turn amber sooner). **In progress** shows every open request, including those waiting on the applicant; **Completed** shows attested, rejected, and withdrawn ones. Selecting a request opens it beside the queue; on phones it replaces the list and Back returns to it. While focus is in the queue, the arrow keys or J and K move between records. Search, status, page, page size, and the open record are kept in the URL.

Every action records the actor's name, role, and time with the change. Students see their history without the staff aids.

At startup, earlier records are moved onto this workflow: `pending` and `under_review` become scrutiny, `approved` becomes registrar approval, requests get application and challan numbers, and older documents are typed as "other". Their stage findings start with the next action.

When SMTP is configured, anyone can use **Forgot password?** on the sign-in page. The emailed link works once, expires after 30 minutes, and signs out every existing session when used. The form gives the same answer whether or not an account exists. Without SMTP, the form says reset is unavailable; admins can still use `server/reset-admin-password.js`.

Documents open in a preview inside the record. Some mobile browsers can't show PDFs inline; **Download** always works.

When SMTP is configured, students are emailed when a request is submitted, when an objection is raised (with what to correct), when corrections are received, when a request is rejected (with the reason), and when the certificate is issued (with its attestation number and verification link). Emails are sent in the background: a mail failure is logged and never blocks the action.

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

For the browser walkthrough, run `npm run test:flow` from `server`. It uses a separate temporary MongoDB database and four accounts. It runs the request wizard with draft recovery, the document checklist, the challan and payment, and submission. It then covers scrutiny with a flagged document and an objection, the student's correction and resubmission, fee verification, records verification, and registrar issuance. Finally it downloads the real PDF, verifies by attestation number, and checks queue pagination and filters, rejection on mobile, password reset, and desktop/tablet/mobile layout. Chromium must be available to Puppeteer. Screenshots are written to the ignored `server/test-artifacts/` directory.

Backend tests start a disposable MongoDB instance and never use `MONGODB_URI`. The first run downloads its MongoDB binary. Blockchain tests use Hardhat's local network and do not submit Amoy transactions. Face service tests mock the model dependencies; real biometric accuracy and liveness are outside their scope. GitHub Actions runs these checks on Windows.

Access tokens last 15 minutes; refresh tokens last seven days and rotate on use. A user has one stored refresh-token chain, so signing in again replaces the previous refresh session. Logout and password changes invalidate all access tokens for that user. Tokens are stored in browser local storage; applications must continue to prevent script injection.

## License

MIT License. See [LICENSE](LICENSE).

## Author

Syed Azmeer

- GitHub: [@Azmeer-59189](https://github.com/Azmeer-59189)
- Project: [github.com/Azmeer-59189/uni-attest](https://github.com/Azmeer-59189/uni-attest)
