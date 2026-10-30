import numpy as np, os
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.expanduser('~/Desktop/SHAKE-App-Store-Screenshots')
OUT = os.path.expanduser('~/Desktop/SHAKE-App-Store-Screenshots-v2')
SIZES = {
    'iPhone-6.9in-1320x2868': dict(old=(699, 2610.5, 85), border=2500, ppt=2.59),
    'iPhone-6.5in-1284x2778': dict(old=(679.5, 2528.5, 82.5), border=2421, ppt=2.52),
}

def recolor(img, pink_box=None):
    """Purple hues (about 245-315 degrees) become the app's blue; pink, orange, teal, blue are untouched."""
    hsv = np.asarray(img.convert('HSV')).astype(np.float32)
    h, s = hsv[..., 0], hsv[..., 1]
    deg = h * 360 / 256
    w = np.clip((deg - 222) / 12, 0, 1) * np.clip((322 - deg) / 12, 0, 1)   # ramp in 235-250, out 310-322
    w *= np.clip((s - 8) / 20, 0, 1)                                          # leave greys alone
    target = np.full_like(h, 208 * 256 / 360)
    if pink_box:
        x0, y0, x1, y1 = pink_box
        target[y0:y1, x0:x1] = 348 * 256 / 360
    hsv[..., 0] = h + w * (target - h)
    return Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')

def bubble(diam_px, ss=4):
    """The frosted glass plus bubble (supersampled), with its soft shadow. Returns an RGBA image with padding."""
    pad = int(diam_px * 0.45)
    S = (int(diam_px) + 2 * pad) * ss
    d = int(diam_px) * ss
    c = S // 2
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # shadow: wide soft + tight
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse([c - d / 2, c - d / 2 + 0.16 * d, c + d / 2, c + d / 2 + 0.16 * d], fill=(0, 0, 0, 80))
    sh = sh.filter(ImageFilter.GaussianBlur(0.13 * d))
    tight = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tight)
    td.ellipse([c - d / 2, c - d / 2 + 0.035 * d, c + d / 2, c + d / 2 + 0.035 * d], fill=(0, 0, 0, 36))
    tight = tight.filter(ImageFilter.GaussianBlur(0.03 * d))
    img = Image.alpha_composite(img, sh)
    img = Image.alpha_composite(img, tight)
    # body: radial gradient, bright at the top-left
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    cx0, cy0 = c - 0.18 * d, c - 0.26 * d
    r = np.sqrt((xx - cx0) ** 2 + (yy - cy0) ** 2) / (0.95 * d)
    t = np.clip(r, 0, 1)
    body = np.zeros((S, S, 4), np.float32)
    inner = np.array([255, 255, 255], np.float32)
    outer = np.array([236, 239, 246], np.float32)
    body[..., :3] = inner * (1 - t[..., None]) + outer * t[..., None]
    # a gentle darkening along the bottom, like the inset shadow
    dy = np.clip((yy - c) / (d / 2), 0, 1)
    body[..., :3] *= (1 - 0.045 * dy[..., None] ** 2)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse([c - d / 2, c - d / 2, c + d / 2, c + d / 2], fill=255)
    body[..., 3] = np.asarray(mask)
    body_img = Image.fromarray(body.astype(np.uint8), 'RGBA')
    # glint: a slanted band with cool and warm edges, caught about a third of the way across
    gl = np.zeros((S, S, 4), np.float32)
    ang = np.tan(np.radians(20))
    pos = (xx - c) + (yy - c) * ang                   # position across the band
    centre = 0.12 * d
    u = (pos - centre) / (0.20 * d)                   # -1..1 across the band
    core = np.clip(1 - np.abs(u), 0, 1) ** 1.2
    blue = np.clip(1 - np.abs(u + 0.55), 0, 1) ** 1.5
    warm = np.clip(1 - np.abs(u - 0.55), 0, 1) ** 1.5
    gl[..., 0] = 255 * core + 70 * blue + 255 * warm
    gl[..., 1] = 255 * core + 165 * blue + 165 * warm
    gl[..., 2] = 255 * core + 255 * blue + 105 * warm
    gl[..., 3] = np.clip(0.75 * core + 0.30 * blue + 0.30 * warm, 0, 1) * 255
    gl = np.clip(gl, 0, 255)
    gl_img = Image.fromarray(gl.astype(np.uint8), 'RGBA')
    gl_img.putalpha(Image.fromarray((np.asarray(gl_img.getchannel('A')).astype(np.float32) * (np.asarray(mask) / 255.0)).astype(np.uint8)))
    body_img = Image.alpha_composite(body_img, gl_img)
    img = Image.alpha_composite(img, body_img)
    # bright rim
    rim = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(rim).ellipse([c - d / 2, c - d / 2, c + d / 2, c + d / 2], outline=(255, 255, 255, 235), width=int(1.4 * ss))
    img = Image.alpha_composite(img, rim)
    # the plus, dark with round caps
    arm = int(0.30 * d)              # half-length
    wth = int(0.0485 * d)
    dk = (17, 24, 39, 255)
    pl = ImageDraw.Draw(img)
    pl.line([c - arm, c, c + arm, c], fill=dk, width=wth)
    pl.line([c, c - arm, c, c + arm], fill=dk, width=wth)
    for ex, ey in ((c - arm, c), (c + arm, c), (c, c - arm), (c, c + arm)):
        pl.ellipse([ex - wth / 2, ey - wth / 2, ex + wth / 2, ey + wth / 2], fill=dk)
    return img.resize((S // ss, S // ss), Image.LANCZOS), pad

def erase_old(img, old, rows):
    """Paint over the old circle with the bar's own background, row by row so any gradient is kept."""
    a = np.asarray(img).copy()
    cx, cy, r = old
    y0, y1 = int(cy - r - 40), int(cy + r + 70)
    x0, x1 = int(cx - r - 38), int(cx + r + 50)
    ramp = np.clip(np.arange(x1 - x0) / 14.0, 0, 1)[:, None]          # feather the left edge into the original
    for y in range(y0, y1):
        fill = a[y, x1 + 10:x1 + 40].mean(axis=0)     # the bar's own colour, from the clear side to the right
        a[y, x0:x1] = a[y, x0:x1] * (1 - ramp) + fill * ramp
    return Image.fromarray(a.astype(np.uint8))

def process(folder, cfg, name, blurred_bg):
    img = Image.open(f'{SRC}/{folder}/{name}.png').convert('RGB')
    box = None
    if name == '03':
        sc = cfg['ppt'] / 2.59
        box = (int(190 * sc), int(2150 * sc), int(1130 * sc), int(2315 * sc))
    img = recolor(img, box)
    if name in ('01', '02', '03', '04', '05'):
        cx, cy, r = cfg['old']
        img = erase_old(img, cfg['old'], None)
        diam = 76 * cfg['ppt']
        b = Image.open(f"/private/tmp/claude-501/shots/bubble-{cfg['ppt']}.png").convert('RGBA')   # the app's own PlusBubble, rendered in Chrome
        centre_y = cfg['border'] + 4 * cfg['ppt']
        if blurred_bg:
            # The screen is dimmed and blurred under the modal: render the bubble on the dimmed backdrop's own tone,
            # blur it, and paste it as a patch, so it reads as a soft pale disc rather than a dark ring.
            bgc = np.asarray(img)[int(centre_y + diam * 0.9), int(cx) - 120:int(cx) - 60].mean(axis=(0, 1))
            f = float(bgc.mean() / 255.0)
            patch = Image.new('RGBA', b.size, (255, 255, 255, 255))
            patch.alpha_composite(b)
            patch = patch.convert('RGB').filter(ImageFilter.GaussianBlur(9))
            patch = Image.fromarray((np.asarray(patch).astype(np.float32) * f).astype(np.uint8))
            mask = Image.new('L', b.size, 0)
            rr = 0.60 * diam
            ImageDraw.Draw(mask).ellipse([b.width / 2 - rr, b.height / 2 - rr * 0.92, b.width / 2 + rr, b.height / 2 + rr * 1.12], fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(14))
            img.paste(patch, (int(round(cx - b.width / 2)), int(round(centre_y - b.height / 2))), mask)
            return img
        img = img.convert('RGBA')
        img.alpha_composite(b, (int(round(cx - b.width / 2)), int(round(centre_y - b.height / 2))))
        img = img.convert('RGB')
    return img

for folder, cfg in SIZES.items():
    os.makedirs(f'{OUT}/{folder}', exist_ok=True)
    for n in ('01', '02', '03', '04', '05', '06', '07'):
        process(folder, cfg, n, blurred_bg=(n == '05')).save(f'{OUT}/{folder}/{n}.png')
        print(folder, n, 'ok')
