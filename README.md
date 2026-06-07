# UniAttest — Blockchain-Based Degree Attestation System

<div align="center">

![UniAttest Banner](https://img.shields.io/badge/UniAttest-Degree%20Attestation-0D1B2A?style=for-the-badge&logoColor=C9A84C)

[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.3-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=flat-square&logo=solidity&logoColor=white)](https://soliditylang.org)
[![Polygon](https://img.shields.io/badge/Polygon-Amoy%20Testnet-8247E5?style=flat-square&logo=polygon&logoColor=white)](https://polygon.technology)
[![License](https://img.shields.io/badge/License-MIT-C9A84C?style=flat-square)](LICENSE)

**A full-stack web application that digitizes and secures the university degree attestation process using blockchain technology.**

[Features](#features) · [Role Hierarchy](#role-hierarchy) · [Tech Stack](#tech-stack) · [Setup](#setup) · [API](#api-endpoints) · [Smart Contract](#smart-contract)

</div>

---

## What is UniAttest?

UniAttest solves a real-world problem — **degree fraud and slow manual attestation processes**. Universities issue thousands of degrees every year, and verifying their authenticity is slow, expensive, and often unreliable.

UniAttest provides:
- 🎓 An online portal for students to request degree attestation
- 🏛️ A secure multi-role admin dashboard for university staff
- 🔐 SHA-256 hash generation on every issued degree
- ⛓️ Permanent hash storage on the Polygon Amoy blockchain
- ✅ Instant public verification — anyone, anywhere, anytime, no login needed
- 📄 Downloadable PDF certificates with embedded QR codes

---

## System Flow

```
Student registers → Submits application + documents
        ↓
Admin reviews → forwards to Department
        ↓
Department approves → forwards to Registrar
        ↓
Registrar issues degree → SHA-256 hash generated → stored on blockchain
        ↓
Student gets QR code → Employer verifies via hash
```

---

## Features

### 👨‍🎓 Student Portal
- Register and login with JWT authentication
- 3-step application form with document upload
- Real-time status tracking (Pending → Under Review → Approved → Issued)
- View rejection reasons and resubmit
- Download blockchain-verified PDF certificate
- Copy hash and share with employers/institutions

### 🏛️ Admin Portal (3-tier hierarchy)
- Secure login — four role levels
- Dashboard with live application statistics
- Review queue with search and status filters
- Role-specific actions (see Role Hierarchy below)
- Approve with optional comments
- Reject with required reason (student sees it)
- SHA-256 hash auto-generated on degree issuance
- Blockchain storage (when contract is deployed)

### 🔒 Security
- JWT access tokens (24h) + refresh tokens (7d)
- Role-based access control on every API route
- Rate limiting — 100 requests per 15 minutes
- Helmet.js secure HTTP headers
- Admin accounts only creatable by super admin
- Blockchain hashes are immutable

---

## Role Hierarchy

| Role | What they can do | Created by |
|---|---|---|
| `student` | Submit applications, upload docs, track status, download certificate | Public registration |
| `admin` | Start review, forward to department | Super admin |
| `department` | Review application, approve or reject | Super admin |
| `registrar` | Final approval, issue degree + generate hash | Super admin |
| `super_admin` | Everything above + create/deactivate admin accounts | `setup-admin.js` script |

> ⚠️ Students can never access admin routes. Admin accounts can never be self-registered.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (24h access + 7d refresh token) |
| Blockchain | Solidity + Hardhat → Polygon Amoy testnet |
| Hashing | SHA-256 via Node.js crypto |
| File uploads | Multer |

---

## Project Structure

```
uni-attest/
├── client/                    ← React + Vite frontend
│   └── src/
│       ├── context/
│       │   └── AuthContext.jsx    ← Auth state + token-aware axios instance
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── ProtectedRoute.jsx
│       └── pages/
│           ├── Home.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── VerifyDegree.jsx       ← Public, no login needed
│           ├── student/
│           │   ├── Dashboard.jsx
│           │   └── NewApplication.jsx
│           └── admin/
│               ├── Dashboard.jsx
│               └── AdminManagement.jsx
│
├── server/                    ← Node.js + Express backend
│   └── src/
│       ├── models/            ← User, Application, Document, Degree
│       ├── controllers/       ← auth, student, admin, verify
│       ├── routes/            ← /api/auth /api/student /api/admin /api/verify
│       ├── middleware/        ← auth, upload, errorHandler
│       └── services/          ← hash.js, blockchain.js
│
└── blockchain/
    ├── contracts/
    │   └── DegreeAttestation.sol
    ├── scripts/
    │   └── deploy.js
    └── hardhat.config.js
```

---

## Setup

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Git

### 1. Clone the repo

```bash
git clone https://github.com/Azmeer-59189/uni-attest.git
cd uni-attest
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Open `server/.env` and fill in:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/degree_attestation
JWT_SECRET=your-strong-secret-here
REFRESH_TOKEN_SECRET=your-refresh-secret-here
CLIENT_URL=http://localhost:5173
UNIVERSITY_NAME=My University
```

### 3. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 4. Create super admin

```bash
cd server
node setup-admin.js
```

This creates the super admin account:
- Email: `admin@university.edu`
- Password: `Admin@1234`

> ⚠️ Change this password immediately after first login.

### 5. Run the project

Open two terminals:

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Open **http://localhost:5173**

---

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register student |
| POST | `/login` | Login any role |
| GET | `/me` | Get current user |

### Student — `/api/student` *(JWT required)*
| Method | Endpoint | Description |
|---|---|---|
| GET | `/applications` | My applications |
| POST | `/applications` | Submit new application |
| POST | `/applications/:id/documents` | Upload documents |
| GET | `/degrees` | My issued degrees |

### Admin — `/api/admin` *(JWT + role required)*
| Method | Endpoint | Who |
|---|---|---|
| GET | `/dashboard` | All admin roles |
| GET | `/applications` | All admin roles |
| PATCH | `/applications/:id/review` | Admin |
| PATCH | `/applications/:id/approve` | Admin, Department |
| PATCH | `/applications/:id/reject` | Any admin role |
| POST | `/applications/:id/issue` | Registrar only |
| GET | `/admins` | Super admin only |
| POST | `/admins` | Super admin only |
| PATCH | `/admins/:id/toggle` | Super admin only |

### Verify — `/api/verify` *(public, no auth)*
| Method | Endpoint | Description |
|---|---|---|
| GET | `/:hash` | Verify degree by SHA-256 hash |

---

## Smart Contract

The `DegreeAttestation.sol` contract stores degree hashes on the Polygon Amoy testnet.

```solidity
function issueDegree(bytes32 hash) external onlyOwner
function verifyDegree(bytes32 hash) external view returns (bool)
```

**Blockchain is optional** — the app works fully without it. When `CONTRACT_ADDRESS` is not set in `.env`, hashes are stored in MongoDB only. To enable blockchain:

1. Get test MATIC from the [Polygon Amoy faucet](https://faucet.polygon.technology)
2. Add your wallet `PRIVATE_KEY` and `AMOY_RPC_URL` to `.env`
3. Deploy the contract:

```bash
cd blockchain
npm install
npx hardhat run scripts/deploy.js --network amoy
```

4. Copy the deployed address into `CONTRACT_ADDRESS` in `.env`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | ✅ | Refresh token secret |
| `CLIENT_URL` | ✅ | Frontend URL for CORS |
| `UNIVERSITY_NAME` | ✅ | Shown on certificates |
| `AMOY_RPC_URL` | Optional | Polygon Amoy RPC endpoint |
| `PRIVATE_KEY` | Optional | Wallet private key (no 0x prefix) |
| `CONTRACT_ADDRESS` | Optional | Deployed contract address |

---

## Roadmap

- [x] Student registration + login
- [x] 3-step application form with document upload
- [x] Admin review workflow (Start Review → Approve → Issue)
- [x] 3-tier admin hierarchy (Admin → Department → Registrar)
- [x] SHA-256 degree hash generation
- [x] Public degree verification page
- [x] Super admin account management
- [ ] PDF certificate generation (Puppeteer)
- [ ] QR code on certificate
- [ ] Email notifications on status changes
- [ ] Blockchain deployment to Polygon Amoy
- [ ] Admin document preview and download
- [ ] IPFS decentralized document storage
- [ ] Production deployment

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Syed Azmeer**
- GitHub: [@Azmeer-59189](https://github.com/Azmeer-59189)
- Project: [github.com/Azmeer-59189/uni-attest](https://github.com/Azmeer-59189/uni-attest)

---

<div align="center">
Built as a university blockchain project
</div>
