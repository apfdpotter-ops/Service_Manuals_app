import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

/** ---- Types ---- **/

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
  path: string[]; // folder path from root -> current subfolder
  brand?: string;
  category?: string;
  tags?: string[];
};

type ApiOk = Manual[];
type ApiDebug = {
  count: number;
  sample: Manual[];
  envPresent: {
    GOOGLE_SERVICE_KEY: boolean;
    GOOGLE_DRIVE_FOLDER_ID: boolean;
  };
};
type ApiErr = { error: string };

// Minimal shape of the service account key
type GoogleServiceKey = {
  client_email: string;
  private_key: string;
};

/** ---- Handler ---- **/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiDebug | ApiErr>
) {
  try {
    const keyRaw = process.env.GOOGLE_SERVICE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!keyRaw || !folderId) {
      return res
        .status(500)
        .json({ error: "Missing GOOGLE_SERVICE_KEY or GOOGLE_DRIVE_FOLDER_ID" });
    }

    // Parse the JSON service key safely
    const key = JSON.parse(keyRaw) as GoogleServiceKey;

    // Handle escaped newlines in private_key, which is common on Vercel
    const privateKey = (key.private_key || "").replace(/\\n/g, "\n");

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      privateKey,
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
          category: path[0], // e.g., "Powersports" | "Small Engines"
          brand: path[1],    // e.g., "Kawasaki", "John Deere", etc.
          tags: [],
        });
      }
    };

    await walk(folderId, []);

    // Optional debug view
    const debug = Array.isArray(req.query.debug)
      ? req.query.debug[0]
      : req.query.debug;

    if (debug === "1") {
      return res.status(200).json({
        count: manuals.length,
        sample: manuals.slice(0, 3),
        envPresent: {
          GOOGLE_SERVICE_KEY: Boolean(keyRaw),
          GOOGLE_DRIVE_FOLDER_ID: Boolean(folderId),
        },
      });
    }

    // Normal response
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(manuals);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
