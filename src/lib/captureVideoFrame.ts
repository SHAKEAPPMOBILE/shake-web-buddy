/** Grabs a single frame from a video clip as a JPEG blob — the only way a
 *  video plan gets a real (non-avatar, non-generic) image for the
 *  WhatsApp/social share preview, since there's no server-side video
 *  processing step to pull a frame from the uploaded video itself. */
export function captureVideoFrame(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };
    const fail = () => { cleanup(); resolve(null); };
    const timeout = setTimeout(fail, 6000);

    video.addEventListener("loadedmetadata", () => {
      // A touch past the very first frame — frame 0 is sometimes black/blank.
      video.currentTime = Math.min(0.3, (video.duration || 1) / 2);
    });
    video.addEventListener("seeked", () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) { fail(); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((thumbBlob) => { cleanup(); resolve(thumbBlob); }, "image/jpeg", 0.85);
      } catch {
        fail();
      }
    });
    video.addEventListener("error", fail);
    video.src = url;
  });
}
