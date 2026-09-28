import { supabase } from "@/integrations/supabase/client";

export interface ModerationResult {
  allowed: boolean;
  /** User-facing reason when blocked — safe to show directly. */
  reason?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:image/jpeg;base64,AAAA..." — strip the prefix.
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Downscales/re-encodes any image blob to a small JPEG — keeps the
 *  moderation request light regardless of the original photo's size. */
function toModerationJpeg(source: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => source.toBlob((b) => resolve(b), "image/jpeg", 0.7));
}

async function imageBlobToModerationFrame(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = async () => {
      const scale = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) { cleanup(); resolve(null); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      cleanup();
      const jpeg = await toModerationJpeg(canvas);
      resolve(jpeg ? await blobToBase64(jpeg) : null);
    };
    img.onerror = () => { cleanup(); resolve(null); };
    img.src = url;
  });
}

/** Samples a handful of frames spread across the clip — a single frame (e.g.
 *  frame 0, used elsewhere for thumbnails) is easy to dodge by putting the
 *  violating content a second or two in. */
async function videoBlobToModerationFrames(blob: Blob, maxFrames = 4): Promise<string[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;top:-9999px;";
    document.body.appendChild(video);

    const frames: string[] = [];
    let timestamps: number[] = [];
    let idx = 0;
    const cleanup = () => { URL.revokeObjectURL(url); video.remove(); };
    const finish = () => { cleanup(); resolve(frames); };
    const overallTimeout = setTimeout(finish, 12000);

    const captureCurrentFrame = async () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 768 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
        canvas.width = Math.max(1, Math.round((video.videoWidth || 720) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 1280) * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const jpeg = await toModerationJpeg(canvas);
          if (jpeg) frames.push(await blobToBase64(jpeg));
        }
      } catch { /* skip this frame, keep going */ }
    };

    const seekNext = () => {
      idx += 1;
      if (idx >= timestamps.length) { clearTimeout(overallTimeout); finish(); return; }
      video.currentTime = timestamps[idx];
    };

    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration && isFinite(video.duration) ? video.duration : 1;
      const n = Math.min(maxFrames, Math.max(1, Math.ceil(duration)));
      timestamps = Array.from({ length: n }, (_, i) => Math.min(duration - 0.05, ((i + 0.5) / n) * duration));
      video.currentTime = timestamps[0];
    });
    video.addEventListener("seeked", () => {
      captureCurrentFrame().finally(seekNext);
    });
    video.addEventListener("error", () => { clearTimeout(overallTimeout); finish(); });
    video.src = url;
  });
}

async function callModerationApi(images: string[]): Promise<ModerationResult> {
  if (images.length === 0) return { allowed: true };
  try {
    const { data, error } = await supabase.functions.invoke("moderate-media", { body: { images } });
    if (error || !data) {
      console.warn("[contentModeration] moderate-media call failed, allowing upload:", error);
      return { allowed: true };
    }
    if (data.violation) {
      const reason =
        data.category === "sexual"
          ? "This video/photo looks like it contains sexual or nude content, which isn't allowed. Please choose something else."
          : data.category === "violence"
          ? "This video/photo looks like it contains graphic violence, which isn't allowed. Please choose something else."
          : "This video/photo doesn't meet our content guidelines. Please choose something else.";
      return { allowed: false, reason };
    }
    return { allowed: true };
  } catch (err) {
    // Never let a moderation-service hiccup block a legitimate upload.
    console.warn("[contentModeration] moderation check errored, allowing upload:", err);
    return { allowed: true };
  }
}

/** Moderates an image file/blob before it's uploaded anywhere. */
export async function moderateImage(blob: Blob): Promise<ModerationResult> {
  const frame = await imageBlobToModerationFrame(blob);
  return callModerationApi(frame ? [frame] : []);
}

/** Moderates a video file/blob (sampling a few frames) before it's uploaded anywhere. */
export async function moderateVideo(blob: Blob): Promise<ModerationResult> {
  const frames = await videoBlobToModerationFrames(blob);
  return callModerationApi(frames);
}

/** Routes to the right check based on the file's MIME type. */
export async function moderateMediaFile(file: Blob & { type: string }): Promise<ModerationResult> {
  if (file.type.startsWith("video/")) return moderateVideo(file);
  if (file.type.startsWith("image/")) return moderateImage(file);
  return { allowed: true };
}
