export function isSameOriginRequest(request: Request) {
  const originHeader = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(request.url).protocol.replace(/:$/, "");

  if (!originHeader || !host || !["http", "https"].includes(protocol)) {
    return false;
  }

  try {
    return new URL(originHeader).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}
