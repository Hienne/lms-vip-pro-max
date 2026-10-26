/**
 * What the upload endpoint wants to know about a file before the server checks it: a video's
 * length and a PDF's page count. Both are best effort; the server has the final word.
 */
export async function readFileFacts(
  file: File,
): Promise<{ durationSeconds?: number; pageCount?: number }> {
  if (file.type.startsWith('video/')) {
    const durationSeconds = await videoDuration(file);
    return durationSeconds ? { durationSeconds } : {};
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pageCount = await pdfPageCount(file);
    return pageCount ? { pageCount } : {};
  }
  return {};
}

function videoDuration(file: File): Promise<number | undefined> {
  if (typeof URL.createObjectURL !== 'function')
    return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      done(
        Number.isFinite(video.duration)
          ? Math.round(video.duration)
          : undefined,
      );
    video.onerror = () => done(undefined);
    video.src = url;
  });
}

/** Counts the page objects of a PDF; an encrypted or compressed index yields nothing. */
async function pdfPageCount(file: File): Promise<number | undefined> {
  try {
    const text = await file.text();
    const pages = text.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
    return pages || undefined;
  } catch {
    return undefined;
  }
}
