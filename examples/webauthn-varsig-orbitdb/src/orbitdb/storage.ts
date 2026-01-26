const STORAGE_KEY_DB_LIST = 'webauthn-varsig-orbitdb-db-list'

export function loadDbList(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY_DB_LIST)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function storeDbList(list: string[]) {
  localStorage.setItem(STORAGE_KEY_DB_LIST, JSON.stringify(list))
}
