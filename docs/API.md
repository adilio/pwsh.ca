# pwsh.ca API

Every response uses the same envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "invalid_url", "message": "..." } }
```

Write endpoints require `Authorization: Bearer <ADMIN_TOKEN>`.

## POST /api/shorten

Create a short link. Admin only.

```bash
curl -X POST https://pwsh.ca/api/shorten \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://learn.microsoft.com/powershell/","code":"docs"}'
```

`code` is optional; omit it for a random six-character Base62 code. Codes are
1–64 characters of `A-Za-z0-9_-` and may not shadow a reserved path
(`api`, `admin`, `assets`, …). Returns `201` with `{ code, url, createdAt,
shortUrl }`, or `409` if the code is taken.

## GET /api/links

List every link, newest first. Admin only.

## GET /api/links/:code

One link's record. Admin only.

## PATCH /api/links/:code

Repoint an existing code. Admin only. Body: `{"url":"https://…"}`.

## DELETE /api/links/:code

Remove a code. Admin only.

## GET /api/info/:code

Public lookup: returns `{ code, url, createdAt }` for a code, or `404`.

## GET /:code

The redirect itself. `302` to the target with `Cache-Control: no-store`, so a
repointed link takes effect immediately. Unknown codes get a branded `404`
page.
