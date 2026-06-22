# UniAttest - Blockchain-Based Degree Attestation System

UniAttest is a full-stack degree attestation portal for students, university staff, and public verifiers. It issues tamper-evident PDF certificates, stores degree hashes on Polygon Amoy, and lets employers verify credentials without logging in.

## Features

- Student registration and JWT login
- Multi-step student application flow with OCR-assisted field extraction
- Optional ID photo + selfie face verification before document upload
- Pending application withdrawal and reapply flow
- Role-based admin workflow for review, approval, rejection, and issuance
- Canonical SHA-256 degree hash generation on issuance
- Optional Polygon Amoy smart contract storage
- Public verification by local degree hash or Amoy transaction hash
- PDF certificates generated with PDFKit
- Certificate QR codes that open Amoy Polygonscan lookup
- Super admin account management

## System Flow

```text
Student registers -> submits application details
        |
Optional OCR + face verification
        |
Student uploads supporting documents
        |
Admin reviews -> department/registrar approval
        |
Registrar issues degree
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
| Face verification | DeepFace, YOLOv8, OpenCV |
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
  yolov8n.pt                      YOLOv8 model used by the face service
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB local or Atlas
- Git
- Python 3.10+ if using face verification
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
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
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

Default account created by the script:

```text
Email: admin@university.edu
Password: Admin@1234
```

Change this password after first login.

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
pip install flask flask-cors opencv-python numpy ultralytics deepface
python face_service.py
```

The Express backend calls `FACE_SERVICE_URL`, defaulting to `http://127.0.0.1:5001`.

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

When a registrar issues a degree, UniAttest generates one canonical SHA-256 degree hash, stores that same hash in MongoDB, and submits it to the Amoy smart contract. The PDF certificate prints the degree hash and the Amoy transaction hash. Its QR code opens Amoy Polygonscan search using the transaction hash when available, with the degree hash as fallback.

## API Endpoints

### Auth - `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register student |
| POST | `/login` | Login |
| GET | `/me` | Get current user |

### Student - `/api/student`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/applications` | Get current student's applications |
| POST | `/applications` | Submit new application |
| GET | `/applications/:id` | Get one application |
| POST | `/applications/:id/documents` | Upload application documents |
| PATCH | `/applications/:id/withdraw` | Withdraw a pending application |
| GET | `/degrees` | Get issued degrees |

### Admin - `/api/admin`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Dashboard statistics |
| GET | `/applications` | List applications |
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
- [x] Certificate QR code with Amoy Polygonscan lookup
- [ ] Email notifications
- [ ] Admin document preview and download
- [ ] IPFS decentralized document storage
- [ ] Production deployment

## License

MIT License. See [LICENSE](LICENSE).

## Author

Syed Azmeer

- GitHub: [@Azmeer-59189](https://github.com/Azmeer-59189)
- Project: [github.com/Azmeer-59189/uni-attest](https://github.com/Azmeer-59189/uni-attest)
