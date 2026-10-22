// Just enough of the ZIP format to read the archive Spotify sends with a person's data
// (my_spotify_data.zip): the central directory, then each wanted file, stored or deflated.
import { inflateRawSync } from "node:zlib";

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
/** a history of a lifetime fits well under this; anything bigger is not Spotify's archive */
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

export interface ZipFile {
  name: string;
  data: Buffer;
}

function findEndOfDirectory(zip: Buffer): number {
  // the record is at the end, after a comment of at most 65 535 bytes
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 22 - 0xffff); offset--) {
    if (zip.readUInt32LE(offset) === END_OF_DIRECTORY) return offset;
  }
  throw new Error("Ce fichier n'est pas une archive ZIP.");
}

/** The files of the archive whose name `wanted` accepts, uncompressed. */
export function readZip(zip: Buffer, wanted: (name: string) => boolean): ZipFile[] {
  const end = findEndOfDirectory(zip);
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const files: ZipFile[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== DIRECTORY_ENTRY) throw new Error("Archive ZIP abîmée.");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const size = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/") || !wanted(name)) continue;
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error("Archive trop volumineuse.");
    if (zip.readUInt32LE(localOffset) !== LOCAL_HEADER) throw new Error("Archive ZIP abîmée.");
    const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const raw = zip.subarray(start, start + compressedSize);
    if (method === 0) files.push({ name, data: Buffer.from(raw) });
    else if (method === 8) files.push({ name, data: inflateRawSync(raw) });
    else throw new Error(`Compression ZIP non prise en charge (${method}).`);
  }
  return files;
}
