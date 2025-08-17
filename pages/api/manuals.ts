import type { NextApiRequest, NextApiResponse } from "next";
import { google, drive_v3 } from "googleapis";

/** ---------- Types ---------- **/

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
  envPresent: { GOOGLE_SERVICE_KEY: boolean; GOOGLE_DRIVE_FOLDER_ID: boolean };
};
type ApiErr = { error: string };

type GoogleServiceKey = {
  client_email: string;
  private_key: string;
};

/** ---------- Helpers ---------- **/

function getDebugParam(req: NextApiRequest): string | undefined {
  return Array.isArray(req.query.debug) ? req.query.debug[0] : req.query.debug;
}

function toGFiles(files: drive_v3.Schema$File[] | undefined): GFile[] {
  if (!files || files.length === 0) return [];
  return files.map((f: drive_v3.Schema$File): GFile => ({
    id: f.id ?? undefined,
    name: f.name ?? undefined,
    mimeType: f.mimeType ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
  }));
}

/** ---------- Handler ---------- **/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiDebug | ApiErr>
): Promise<void> {
  try {
    const keyRaw: string | undefined = process.env.GOOGLE_SERVICE_KEY;
    const folderId: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!keyRaw || !folderId) {
      res
        .status(500)
        .json({ error: "Missing GOOGLE_SERVICE_KEY or GOOGLE_DRIVE_FOLDER_ID" });
      return;
    }

    const key = JSON.parse(keyRaw) as GoogleServiceKey;
    const privateKey: string = (key.private_key || "").replace(/\\n/g, "\n");

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
