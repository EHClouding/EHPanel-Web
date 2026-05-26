import type { HostingDnsRecord } from "@/api/hosting"

type ZoneExportDomain = {
  domain: string
}

const fqdnRecordTypes = new Set(["CNAME", "DNAME", "MX", "NS", "PTR", "SRV"])

export function buildCloudflareZoneFile(domain: ZoneExportDomain, records: HostingDnsRecord[]) {
  const zoneName = domain.domain.trim()
  const origin = ensureTrailingDot(zoneName)
  const defaultTtl = pickDefaultTtl(records)
  const body = records
    .slice()
    .sort(sortRecords)
    .map((record) => formatBindRecord(zoneName, record))
    .filter(Boolean)

  return [
    `; EHPanel Web DNS zone export`,
    `; Cloudflare-compatible BIND zone file`,
    `; Zone: ${zoneName}`,
    `; Generated: ${new Date().toISOString()}`,
    `$ORIGIN ${origin}`,
    `$TTL ${defaultTtl}`,
    "",
    ...(body.length ? body : [`; No DNS records found for ${zoneName}`]),
    "",
  ].join("\n")
}

export function downloadCloudflareZoneFile(domainName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${sanitizeFilename(domainName)}-cloudflare-zone.txt`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function formatBindRecord(zoneName: string, record: HostingDnsRecord) {
  const name = formatRecordName(record.name)
  const ttl = Number(record.ttl) || 300
  const type = record.type.toUpperCase()
  const content = formatRecordContent(zoneName, record)
  const priority = type === "MX" && record.priority !== null && record.priority !== undefined ? `${record.priority}\t` : ""

  if (!content) return ""
  return `${name}\t${ttl}\tIN\t${type}\t${priority}${content}`
}

function formatRecordName(name: string) {
  const normalized = name.trim()
  if (!normalized || normalized === "@") return "@"
  return normalized
}

function formatRecordContent(zoneName: string, record: HostingDnsRecord) {
  const type = record.type.toUpperCase()
  const raw = record.content.trim()

  if (type === "TXT") return quoteTxt(raw)
  if (type === "SRV") return formatSrvContent(zoneName, raw)
  if (fqdnRecordTypes.has(type)) return raw.split(/\s+/).map((part) => formatFqdnValue(zoneName, part)).join(" ")

  return raw
}

function formatSrvContent(zoneName: string, value: string) {
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length < 4) return parts.map((part, index) => index === parts.length - 1 ? formatFqdnValue(zoneName, part) : part).join(" ")

  const [priority, weight, port, ...targetParts] = parts
  return [priority, weight, port, formatFqdnValue(zoneName, targetParts.join(" "))].join(" ")
}

function formatFqdnValue(zoneName: string, value: string) {
  const normalized = value.trim()
  if (!normalized || normalized === "@") return ensureTrailingDot(zoneName)
  if (normalized.endsWith(".")) return normalized
  if (normalized.includes(".")) return `${normalized}.`
  return `${normalized}.${zoneName}.`
}

function quoteTxt(value: string) {
  const normalized = value.trim()
  if (normalized.startsWith('"') && normalized.endsWith('"')) return normalized
  return `"${normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function ensureTrailingDot(value: string) {
  return value.endsWith(".") ? value : `${value}.`
}

function pickDefaultTtl(records: HostingDnsRecord[]) {
  const ttl = records.find((record) => Number(record.ttl) > 0)?.ttl
  return Number(ttl) || 300
}

function sortRecords(a: HostingDnsRecord, b: HostingDnsRecord) {
  return `${a.name}:${a.type}:${a.content}`.localeCompare(`${b.name}:${b.type}:${b.content}`)
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "") || "dns-zone"
}
