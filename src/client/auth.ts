/** Build an HTTP Basic `Authorization` header value for WordPress Application Passwords (no Buffer; works in Node and edge). */
export function basicAuth(username: string, appPassword: string): string {
  const bytes = new TextEncoder().encode(`${username}:${appPassword}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}
