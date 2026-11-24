"""Fit a pinhole camera so the 3D room lines up with the 2D PE illustration (2752x1536).
Landmarks: Blender world point -> pixel in room.webp, with a weight. Pure Python Nelder-Mead (no numpy needed)."""
import math, json

W, H = 2752, 1536
CX, CY = W / 2, H / 2
PTS = [  # (x, y, z) Blender, (u, v) px, weight
    ((-0.828, 0.02, 2.618), (1036, 158), 3), ((0.828, 0.02, 2.618), (1842, 158), 3),   # window sashes (from the PE layout code)
    ((-0.828, 0.02, 0.857), (1036, 1088), 3), ((0.828, 0.02, 0.857), (1842, 1088), 3),
    ((0.95, -0.88, 0.743), (2025, 1403), 2),                                            # desk, front-right top corner
    ((1.01, -0.32, 1.08), (1947, 943), 1), ((1.69, -0.32, 1.08), (2375, 948), 1),       # bookcase top, front edge
    ((1.69, -0.32, 1.98), (2337, 488), 1), ((1.69, -0.32, 1.54), (2337, 738), 1),       # wall shelf, right front edge
]


def project(p, P):
    cx, cy, cz, yaw, pitch, f = P
    dx, dy, dz = p[0] - cx, p[1] - cy, p[2] - cz
    # camera looks along +Y (Blender), yaw about Z, pitch about the camera's X
    cyw, syw = math.cos(yaw), math.sin(yaw)
    x1 = dx * cyw + dy * syw          # right
    y1 = -dx * syw + dy * cyw         # forward (before pitch)
    cp, sp = math.cos(pitch), math.sin(pitch)
    fw = y1 * cp + dz * sp
    upc = -y1 * sp + dz * cp
    return CX + f * x1 / fw, CY - f * upc / fw


def err(P):
    e = 0
    for p, (u, v), w in PTS:
        a, b = project(p, P)
        e += w * ((a - u) ** 2 + (b - v) ** 2)
    return e


def nelder(f, x0, step, iters=6000):
    n = len(x0)
    S = [x0] + [[x0[j] + (step[j] if j == i else 0) for j in range(n)] for i in range(n)]
    F = [f(s) for s in S]
    for _ in range(iters):
        o = sorted(range(n + 1), key=lambda i: F[i]); S = [S[i] for i in o]; F = [F[i] for i in o]
        c = [sum(S[i][j] for i in range(n)) / n for j in range(n)]
        r = [c[j] + (c[j] - S[-1][j]) for j in range(n)]; fr = f(r)
        if fr < F[0]:
            e = [c[j] + 2 * (c[j] - S[-1][j]) for j in range(n)]; fe = f(e)
            S[-1], F[-1] = (e, fe) if fe < fr else (r, fr)
        elif fr < F[-2]:
            S[-1], F[-1] = r, fr
        else:
            k = [c[j] + .5 * (S[-1][j] - c[j]) for j in range(n)]; fk = f(k)
            if fk < F[-1]:
                S[-1], F[-1] = k, fk
            else:
                S = [S[0]] + [[S[0][j] + .5 * (s[j] - S[0][j]) for j in range(n)] for s in S[1:]]
                F = [F[0]] + [f(s) for s in S[1:]]
    i = min(range(n + 1), key=lambda i: F[i])
    return S[i], F[i]


best = None
for start in ([0, -3.55, 1.38, 0, 0, 1500], [0.1, -4.5, 1.5, 0, 0, 2000], [0.2, -3.0, 1.6, 0.05, -.05, 1200]):
    P, e = nelder(err, start, [.1, .3, .1, .03, .03, 150])
    P, e = nelder(err, P, [.03, .1, .03, .01, .01, 50])
    if best is None or e < best[1]:
        best = (P, e)
P, e = best
cx, cy, cz, yaw, pitch, f = P
print("camera pos", [round(v, 4) for v in (cx, cy, cz)], "yaw", round(math.degrees(yaw), 2), "pitch", round(math.degrees(pitch), 2), "f px", round(f, 1))
for p, (u, v), w in PTS:
    a, b = project(p, P)
    print("  %-22s want (%4d,%4d) got (%6.0f,%6.0f)  off %4.0f px" % (p, u, v, a, b, math.hypot(a - u, b - v)))
fwd = (-math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch))   # matches project(): forward = (-sin, cos)
out = {"pos": [cx, cy, cz], "target": [cx + fwd[0] * 3.5, cy + fwd[1] * 3.5, cz + fwd[2] * 3.5],
       "vfov": math.degrees(2 * math.atan(H / 2 / f)), "aspect": W / H}
print(json.dumps(out))
json.dump(out, open("D:/EDU/PE-3d/web/public/assets/camera-2d.json", "w"), indent=1)
