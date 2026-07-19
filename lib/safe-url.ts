import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const blockedAddresses = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6')
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
}

function isPublicAddress(address: string, family?: number): boolean {
  const detectedFamily = family ?? isIP(address)
  if (detectedFamily === 4) return !blockedAddresses.check(address, 'ipv4')
  if (detectedFamily === 6) {
    const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1]
    if (mappedIpv4) return isPublicAddress(mappedIpv4, 4)
    return !blockedAddresses.check(address, 'ipv6')
  }
  return false
}

export function isSafeBarkUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (url.username || url.password) return false

    const hostname = normalizeHostname(url.hostname.toLowerCase())
    if (!hostname) return false
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      return false
    }

    const family = isIP(hostname)
    return !family || isPublicAddress(hostname, family)
  } catch {
    return false
  }
}

export async function isSafeBarkTarget(value: string): Promise<boolean> {
  if (!isSafeBarkUrl(value)) return false

  try {
    const hostname = normalizeHostname(new URL(value).hostname)
    const family = isIP(hostname)
    if (family) return isPublicAddress(hostname, family)

    const addresses = await lookup(hostname, { all: true, verbatim: true })
    return addresses.length > 0 && addresses.every(({ address, family }) =>
      isPublicAddress(address, family))
  } catch {
    return false
  }
}
