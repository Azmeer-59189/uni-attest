# UniAttest — Blockchain-Based Degree Attestation System

<div align="center">

![UniAttest Banner](https://img.shields.io/badge/UniAttest-Degree%20Attestation-0D1B2A?style=for-the-badge&logoColor=C9A84C)

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=flat-square&logo=solidity&logoColor=white)](https://soliditylang.org)
[![Polygon](https://img.shields.io/badge/Polygon-Amoy%20Testnet-8247E5?style=flat-square&logo=polygon&logoColor=white)](https://polygon.technology)
[![License](https://img.shields.io/badge/License-MIT-C9A84C?style=flat-square)](LICENSE)

**A full-stack web application that digitizes and secures the university degree attestation process using blockchain technology.**

[Features](#features) · [Demo Flow](#demo-flow) · [Tech Stack](#tech-stack) · [Setup](#setup) · [API](#api-endpoints) · [Smart Contract](#smart-contract)

</div>

---

## What is UniAttest?

UniAttest solves a real-world problem — **degree fraud and slow manual attestation processes**. Universities issue thousands of degrees every year, and verifying their authenticity is slow, expensive, and often unreliable.

UniAttest provides:
- 🎓 An online portal for students to request degree attestation
- 🏛️ A secure admin dashboard for university staff to review and approve
- 🔐 SHA-256 cryptographic hashing of every issued degree
- ⛓️ Permanent hash storage on the Polygon Amoy blockchain
- ✅ Instant public verification — anyone, anywhere, anytime
- 📄 Downloadable PDF certificates with embedded QR codes

---

## Features

### 👨‍🎓 Student Portal
- Register and login with JWT authentication
- 3-step application form with document upload
- Real-time status tracking (Pending → Under Review → Approved → Issued)
- View rejection reasons and resubmit
- Download blockchain-verified PDF certificate
- Copy hash to share with employers

### 🏛️ Admin Portal
- Secure login — admin and super admin roles
- Dashboard with application statistics
- Review queue with search and status filters
- One-click Start Review, Approve, Reject, Issue Degree
- Approve with comments — reject with required reason
- Hash and PDF auto-generated on degree issuance

### 🔐 Super Admin
- Create and manage admin accounts
- Deactivate/reactivate admins instantly
- Full audit trail of all actions

### 🌐 Public Verifier
- Anyone can verify at `/verify/:hash`
- No login required
- Returns student name, program, university, issue date
- Shows blockchain transaction ID

---

## Demo Flow

```
1. Student registers at /register
         ↓
2. Student fills application form + uploads documents
         ↓
3. Admin logs in → reviews documents
         ↓
4. Admin: Start Review → Approve → Issue Degree
         ↓
5. SHA-256 hash generated from degree data
         ↓
6. Hash stored permanently on Polygon Amoy blockchain
         ↓
7. PDF certificate generated with QR code
         ↓
8. Student downloads certificate + copies hash
         ↓
9. Employer visits /verify/:hash → instant verification ✅
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React.js + Vite + Tailwind CSS | React 18 |
| Backend | Node.js + Express.js | Node 18+ |
| Database | MongoDB + Mongoose | MongoDB 7 |
| Blockchain | Solidity + Hardhat + ethers.js | Solidity 0.8.19 |
| Network | Polygon Amoy Testnet | Chain ID 80002 |
| Auth | JSON Web Tokens (JWT) | 24h access + 7d refresh |
| Files | Multer + PDFKit + QRCode | — |
| Security | bcryptjs + Helmet + rate-limit | — |

---

## Project Structure

```
uni-attest/
├── client/                          # React frontend
│   └── src/
│       ├── App.jsx                  # Routes with lazy loading
│       ├── context/
│       │   └── AuthContext.jsx      # Auth state + axios api instance
│       ├── components/
│       │   ├── Navbar.jsx
│       │   └── ProtectedRoute.jsx
│       └── pages/
│           ├── Home.jsx             # Landing page with portal selector
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── VerifyDegree.jsx     # Public hash verifier
│           ├── student/
│           │   ├── Dashboard.jsx
│           │   └── NewApplication.jsx
│           └── admin/
│               ├── Dashboard.jsx
│               └── AdminManagement.jsx
│
├── server/                          # Node.js backend
│   └── src/
│       ├── app.js
│       ├── models/                  # User, Application, Document, Degree
│       ├── controllers/             # auth, student, admin, verify
│       ├── routes/                  # auth, student, admin, verify
│       ├── middleware/              # authenticate, authorize, upload
│       └── services/
│           ├── hash.js              # SHA-256 hashing
│           ├── blockchain.js        # Polygon Amoy integration
│           └── pdf.js               # Certificate generation
│
├── blockchain/                      # Smart contract
│   ├── contracts/
│   │   └── DegreeAttestation.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
│
└── uploads/                         # Uploaded documents + certificates
```

---

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally
- MetaMask wallet (for blockchain deployment)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/uni-attest.git
cd uni-attest
```

### 2. Install dependencies
```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install

# Blockchain (optional)
cd ../blockchain && npm install
```

### 3. Configure environment variables

Create `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/degree_attestation
JWT_SECRET=your-super-secret-jwt-key
REFRESH_TOKEN_SECRET=your-refresh-token-secret
CLIENT_URL=http://localhost:5173
UNIVERSITY_NAME=Your University Name

# Blockchain (optional — app works without these)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=your-wallet-private-key
CONTRACT_ADDRESS=your-deployed-contract-address
```

### 4. Create super admin account
```bash
cd server
node setup-admin.js
```
This creates:
- **Email:** admin@university.edu
- **Password:** Admin@1234

### 5. Run the application

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

### 6. Open the app
Navigate to **http://localhost:5173**

---

## Blockchain Deployment

### Deploy to Polygon Amoy Testnet

1. Get free test MATIC from [Polygon Faucet](https://faucet.polygon.technology/)
2. Create `blockchain/.env`:
```env
PRIVATE_KEY=your-wallet-private-key
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
UNIVERSITY_NAME=Your University Name
```

3. Compile and deploy:
```bash
cd blockchain
npm run compile
npm run deploy:amoy
```

4. Copy the contract address to `server/.env` as `CONTRACT_ADDRESS`

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register student |
| POST | `/api/auth/login` | Login any role |
| GET | `/api/auth/me` | Get current user |

### Student (JWT required)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/student/applications` | My applications |
| POST | `/api/student/applications` | Submit application |
| POST | `/api/student/applications/:id/documents` | Upload documents |
| GET | `/api/student/degrees` | My issued degrees |

### Admin (Admin JWT required)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Stats |
| GET | `/api/admin/applications` | All applications |
| PATCH | `/api/admin/applications/:id/review` | Start review |
| PATCH | `/api/admin/applications/:id/approve` | Approve |
| PATCH | `/api/admin/applications/:id/reject` | Reject |
| POST | `/api/admin/applications/:id/issue` | Issue + blockchain |

### Public
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/verify/:hash` | Verify degree hash |

---

## Smart Contract

The `DegreeAttestation` contract stores degree hashes on-chain:

```solidity
function issueDegree(bytes32 _degreeHash) external onlyAuthorized
function verifyDegree(bytes32 _degreeHash) external view returns (bool, uint256, address, string)
```

Each hash is stored with:
- ✅ Issuer wallet address
- ✅ Block timestamp
- ✅ University name
- ✅ Immutable — cannot be modified or deleted

---

## Security

- 🔐 Passwords hashed with bcryptjs (12 salt rounds)
- 🎫 JWT tokens — 24h expiry with refresh token rotation
- 🛡️ Role-based access control on every route
- 🚫 Rate limiting — 100 requests per 15 minutes
- ⛑️ Helmet.js secure HTTP headers
- 🔒 Admin accounts only creatable by super admin
- ⛓️ Blockchain hashes are immutable

---

## User Roles

| Role | Access | Created By |
|---|---|---|
| `student` | Student portal | Public registration |
| `admin` | Admin portal | Super admin only |
| `super_admin` | Everything + admin management | setup-admin.js script |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `REFRESH_TOKEN_SECRET` | ✅ | Refresh token secret |
| `CLIENT_URL` | ✅ | Frontend URL for CORS |
| `UNIVERSITY_NAME` | ✅ | Shown on certificates |
| `AMOY_RPC_URL` | Optional | Polygon Amoy RPC |
| `PRIVATE_KEY` | Optional | Wallet private key |
| `CONTRACT_ADDRESS` | Optional | Deployed contract address |

> ⚠️ Never commit `.env` files to version control

---

## Future Enhancements

- [ ] Email notifications on status changes
- [ ] Admin document preview and download
- [ ] IPFS decentralized document storage
- [ ] Mobile app (React Native)
- [ ] Production deployment (Render + Vercel)
- [ ] Polygon mainnet deployment
- [ ] Multi-university support
- [ ] HEC (Higher Education Commission) integration

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Syed Azmeer**
- Student ID: 59189
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)

---

<div align="center">
Built with ❤️ as a university blockchain project
</div>