export function apiError(error, fallback = 'Something went wrong. Please try again.') {
  const data = error.response?.data
  if (Array.isArray(data?.errors)) return data.errors.map(item => item.msg).filter(Boolean).join(' ') || fallback
  if (Array.isArray(data?.details)) return data.details.join(' ')
  return typeof data?.error === 'string' ? data.error : fallback
}
