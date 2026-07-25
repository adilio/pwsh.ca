import { getLink } from "../lib/store";
import { RESERVED_CODES, validateCode } from "../lib/validator";

/** GET /:code catch-all, 302 to the target, or a branded 404 page. */
export default async function handler(req: Request): Promise<Response> {
  const pathname = new URL(req.url).pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Only unreserved single-segment paths can be short codes.
  if (segments.length === 1 && !RESERVED_CODES.has(segments[0].toLowerCase())) {
    let code: string | null = null;
    try {
      code = decodeURIComponent(segments[0]);
    } catch {
      // Malformed percent-encoding, fall through to the 404 page.
    }
    if (code && validateCode(code).ok) {
      const record = await getLink(code);
      if (record) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: record.url,
            "Cache-Control": "no-store, max-age=0",
          },
        });
      }
    }
  }

  return new Response(notFoundPage(), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function notFoundPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · pwsh.ca</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;
    background:#0b1220;color:#eef1f8;
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  main{text-align:center;padding:2rem}
  svg{width:72px;height:72px;margin-bottom:1.25rem}
  h1{font-size:1.5rem;margin:0 0 .5rem;letter-spacing:-.02em}
  p{margin:0 0 1.5rem;color:#8f99ad}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#8f99ad}
  a{color:#5391fe;text-decoration:none;font-weight:600}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
<main>
  <svg viewBox="0 0 64 64" role="img" aria-label="pwsh.ca logo">
    <rect width="64" height="64" rx="14" fill="#131c2e"/>
    <g fill="none" stroke="#5391fe" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21 L33 32 L20 43"/>
      <path d="M37 44 H46"/>
    </g>
  </svg>
  <h1>That link doesn&rsquo;t exist</h1>
  <p><code>ObjectNotFound</code> &mdash; the short link was removed, or never created.</p>
  <a href="/">Go to pwsh.ca &rarr;</a>
</main>
</body>
</html>`;
}
