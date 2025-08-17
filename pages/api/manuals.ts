import type { NextApiRequest, NextApiResponse } from "next";
import { google, drive_v3 } from "googleapis";

/** ---- Types ---- **/

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
  path: string[];
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
    const keyRaw: string | undefined = process.env.GOOGLE_SERVICE_KEY;
    const folderId: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!keyRaw || !folderId) {
      return res
        .status(500)
        .json({ error: "Missing GOOGLE_SERVICE_KEY or GOOGLE_DRIVE_FOLDER_ID" });
    }

    const key = JSON.parse(keyRaw) as GoogleServiceKey;
    const privateKey = (key.private_key || "").replace(/\\n/g, "\n");

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      privateKey,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    const drive: drive_v3.Drive = google.drive({ version: "v3", auth });

    // List children (files & folders) of a folder
    const listChildren = async (parentId: string): Promise<GFile[]> => {
      const out: GFile[] = [];
      let pageToken: string | undefined;

      do {
        const resp: drive_v3.Schema$FileList = (await drive.files.list({
          q: `'${parentId}' in parents and trashed=false`,
          fields: "nextPageToken, files(id,name,mimeType,webViewLink)",
          pageSize: 1000,
          pageToken,
        })).data;

        const files: drive_v3.Schema$File[] = resp.files ?? [];
        // Narrow Google type to our minimal GFile
        for (const f of files) {
          out.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            webViewLink: f.webViewLink,
          });
        }

        pageToken = resp.nextPageToken ?? undefined;
      } while (pageToken);

      return out;
    };

    // DFS: recurse subfolders and collect PDFs
    const manuals: Manual[] = [];

    const walk = async (id: string, path: string[]): Promise<void> => {
      const children: GFile[] = await listChildren(id);

      const folders: GFile[] = children.filter(
        (f: GFile) => f.mimeType === "application/vnd.google-apps.folder"
      );

      for (const f of folders) {
        if (f.id && f.name) {
          await walk(f.id, [...path, f.name]);
        }
      }

      const pdfs: GFile[] = children.filter(
        (f: GFile) => f.mimeType === "application/pdf"
      );

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

    // Optional debug view
    const debugParam = Array.isArray(req.query.debug)
      ? req.query.debug[0]
      : req.query.debug;

    if (debugParam === "1") {
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
