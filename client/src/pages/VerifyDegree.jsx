import { useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Search, Shield, AlertCircle, CheckCircle } from 'lucide-react'

const VerifyDegree = () => {
  const { hash: urlHash } = useParams()
  const [hash, setHash] = useState(urlHash || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!hash || hash.length !== 64) {
      setError('Please enter a valid 64-character hash.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await axios.get(`/api/verify/${hash}`)
      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <Shield className="h-16 w-16 text-navy mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-navy">Verify Degree</h1>
        <p className="text-gray-600 mt-2">Enter the degree hash to verify its authenticity on the blockchain.</p>
      </div>

      <form onSubmit={handleVerify} className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Enter 64-character degree hash..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-navy font-mono text-sm"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            maxLength={64}
          />
          <button type="submit" disabled={loading}
            className="bg-navy text-white px-6 py-2 rounded-lg hover:bg-navy-light disabled:opacity-50 flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span>{loading ? 'Verifying...' : 'Verify'}</span>
          </button>
        </div>
        {error && <div className="flex items-center space-x-2 mt-3 text-red-600 text-sm"><AlertCircle className="h-4 w-4" /><span>{error}</span></div>}
      </form>

      {result?.verified && (
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-semibold text-green-700">Degree Verified Successfully</h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Student Name</p>
                <p className="font-medium">{result.degree.studentName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Student ID</p>
                <p className="font-medium">{result.degree.studentId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Program</p>
                <p className="font-medium">{result.degree.program}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Department</p>
                <p className="font-medium">{result.degree.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Graduation Year</p>
                <p className="font-medium">{result.degree.graduationYear}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Issued Date</p>
                <p className="font-medium">{new Date(result.degree.issuedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">Blockchain Transaction</p>
              <p className="font-mono text-xs break-all text-navy">{result.degree.blockchainTx || 'Not stored on blockchain'}</p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">Verification Hash</p>
              <p className="font-mono text-xs break-all">{result.degree.hash}</p>
            </div>
          </div>
        </div>
      )}

      {result && !result.verified && (
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-red-700">Degree Not Found</h2>
          <p className="text-red-600">The provided hash does not match any issued degree.</p>
        </div>
      )}
    </div>
  )
}

export default VerifyDegree