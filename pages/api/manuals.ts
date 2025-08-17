/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

// Minimal Drive file type we care about
type GFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
};

type Manual = {
  id: string;
  title: string;
  url: string;
  path: string[];     // the folder path from root -> current subfolder
  brand?: string;
  category?: string;
  tags?: string[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const keyRaw = process.env.GOOGLE_SERVICE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!keyRaw || !folderId) {
      return res.status(500).json({
        error: "Missing GOOGLE_SERVICE_KEY or GOOGLE_DRIVE_FOLDER_ID",
      });
    }

    const key = JSON.parse(keyRaw as string);

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    const drive = google.drive({ version: "v3", auth });

    // List children (files & folders) of a folder
    const listChildren = async (parentId: string): Promise<GFile[]> => {
      const out: GFile[] = [];
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

    // DFS: recurse subfolders and collect PDFs
    const manuals: Manual[] = [];

    const walk = async (id: string, path: string[]): Promise<void> => {
      const children = await listChildren(id);

      // Recurse into subfolders
      const folders = children.filter(
        (f) => f.mimeType === "application/vnd.google-apps.folder"
      );
      for (const f of folders) {
        if (f.id && f.name) {
          await walk(f.id, [...path, f.name]);
        }
      }

      // Collect PDFs at this level
      const pdfs = children.filter((f) => f.mimeType === "application/pdf");
      for (const f of pdfs) {
        if (!f.id) continue;
        manuals.push({
          id: f.id,
          title: f.name ?? "Untitled",
          url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
          path,
          category: path[0],
          brand: path[1],
          tags: [],
        });
      }
    };

    await walk(folderId, []);

    // optional debug
    if (req.query.debug === "1") {
      return res.status(200).json({
        count: manuals.length,
        sample: manuals.slice(0, 3),
        envPresent: {
          GOOGLE_SERVICE_KEY: Boolean(keyRaw),
          GOOGLE_DRIVE_FOLDER_ID: Boolean(folderId),
        },
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(manuals);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: "Unknown error" });
  }
}
