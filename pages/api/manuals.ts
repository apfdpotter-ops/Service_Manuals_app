import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

type Manual = {
  id: string;
  title: string;
  url: string;
  path: string[];
  brand?: string;
  category?: string;
  tags?: string[];
};

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const key = JSON.parse(process.env.GOOGLE_SERVICE_KEY as string);
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID as string;
    if (!key?.client_email || !key?.private_key || !folderId) {
      throw new Error("Missing GOOGLE_SERVICE_KEY or GOOGLE_DRIVE_FOLDER_ID");
    }

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );
    const drive = google.drive({ version: "v3", auth });

    const listChildren = async (parentId: string) => {
      const out: any[] = [];
      let pageToken: string | undefined;
      do {
        const resp = await drive.files.list({
          q: `'${parentId}' in parents and trashed=false`,
          fields: "nextPageToken, files(id,name,mimeType,webViewLink)",
          pageSize: 1000,
          pageToken,
        });
        out.push(...(resp.data.files ?? []));
        pageToken = resp.data.nextPageToken ?? undefined;
      } while (pageToken);
      return out;
    };

    const manuals: Manual[] = [];
    const walk = async (id: string, path: string[]) => {
      const children = await listChildren(id);

      const folders = children.filter(f => f.mimeType === "application/vnd.google-apps.folder");
      for (const f of folders) {
        await walk(f.id!, [...path, f.name!]);
      }

      const pdfs = children.filter(f => f.mimeType === "application/pdf");
      for (const f of pdfs) {
        manuals.push({
          id: f.id!,
          title: f.name || "Untitled",
          url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          path,
          category: path[0],
          brand: path[1],
          tags: [],
        });
      }
    };

    await walk(folderId, []);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(manuals);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to read Drive" });
  }
}
