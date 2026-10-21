function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isLocalHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host === "::1"
    || /^f[cd][0-9a-f]{2}:/i.test(host)
    || host.startsWith("fe80:")
    || isPrivateIpv4(host);
}

function resolveApiNetworkPolicy(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid absolute HTTP or HTTPS URL.");
  }
  if (url.protocol === "https:") return { usesLocalHttp: false };
  if (url.protocol === "http:" && isLocalHostname(url.hostname)) return { usesLocalHttp: true };
  throw new Error("HTTP API URLs are allowed only for localhost/private LAN development. Use HTTPS for public APIs.");
}

module.exports = { resolveApiNetworkPolicy };
