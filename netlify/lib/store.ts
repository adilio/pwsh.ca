import { getStore } from "@netlify/blobs";

export interface LinkRecord {
  url: string;
  createdAt: string;
}

/** The one Blobs store for short links. Strong consistency so that
 *  create-collision checks and immediate reads after writes are reliable. */
export function linksStore() {
  return getStore({ name: "links", consistency: "strong" });
}

export async function getLink(code: string): Promise<LinkRecord | null> {
  const record = (await linksStore().get(code, { type: "json" })) as
    | LinkRecord
    | null;
  return record;
}

export async function setLink(code: string, record: LinkRecord): Promise<void> {
  await linksStore().setJSON(code, record);
}

export async function deleteLink(code: string): Promise<void> {
  await linksStore().delete(code);
}

export async function listLinks(): Promise<
  Array<LinkRecord & { code: string }>
> {
  const store = linksStore();
  const { blobs } = await store.list();
  const links = await Promise.all(
    blobs.map(async ({ key }) => {
      const record = (await store.get(key, { type: "json" })) as
        | LinkRecord
        | null;
      return record ? { code: key, ...record } : null;
    }),
  );
  return links
    .filter((l): l is LinkRecord & { code: string } => l !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
