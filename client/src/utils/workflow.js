import { useEffect, useState } from 'react'
import axios from 'axios'

// Request types, fees, document kinds, and stage labels come from the server so both sides agree.
let cached = null
export const loadConfig = () => {
  cached ||= axios.get('/api/config').then(response => response.data).catch(error => { cached = null; throw error })
  return cached
}
export function useConfig() {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadConfig().then(value => { if (active) setConfig(value) }).catch(() => { if (active) setError('Could not load the attestation settings. Check your connection and reload.') })
    return () => { active = false }
  }, [])
  return { config, error }
}

export const STAFF_ROLES = ['scrutiny', 'examination', 'registrar', 'admin', 'super_admin']
export const isStaff = user => STAFF_ROLES.includes(user?.role)
export const staffRoleLabels = { scrutiny: 'Scrutiny officer', examination: 'Examination officer', registrar: 'Registrar', admin: 'Administrator', super_admin: 'Super admin' }
export const homeFor = user => isStaff(user) ? '/admin/dashboard' : '/student/dashboard'

export const statusLabels = { draft: 'Draft', scrutiny: 'Document scrutiny', objection: 'Objection raised', records_verification: 'Records verification', registrar_approval: 'Registrar approval', issuing: 'Issuing', issued: 'Attested', rejected: 'Rejected', withdrawn: 'Withdrawn' }
export const OPEN_STATUSES = ['draft', 'scrutiny', 'objection', 'records_verification', 'registrar_approval', 'issuing']
export const EDITABLE_STATUSES = ['draft', 'objection']
export const requestTypeLabels = { degree: 'Degree attestation', transcript: 'Transcript attestation', degree_transcript: 'Degree and transcript attestation' }

export const formatPKR = amount => amount == null ? '—' : `PKR ${Number(amount).toLocaleString('en-PK')}`
// Formats digits as a CNIC while typing: 35202-1234567-1.
export const formatCnic = value => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 13)
  return [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12)].filter(Boolean).join('-')
}
export const requiredDocuments = (config, requestType) => [...(config?.requestTypes?.[requestType]?.documents || []), 'fee_challan']
