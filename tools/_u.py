UNDO=True
"""Move/scale objects so their silhouettes line up with the PE illustration through the 2D-matched camera.
Each object slides on its support (desk / wall / shelf / floor) and may scale uniformly about its pivot.
Original transforms are stored in o["pe_orig"] so this can be undone (see UNDO)."""
import bpy, math
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, Matrix

D = bpy.data
sc = bpy.context.scene
cam = sc.camera
W, H = 2752, 1536
DESK = 0.743
UNDO = globals().get("UNDO", False)

# name: (target box x, y, w, h), free axes, scale?, support z (None = keep), weights (x, y, w, h) or "chair"
JOBS = {
    "Interactive_Laptop":   ((753, 1015, 533, 404), "xy", True, DESK, None),
    "Coffee_Mug":           ((1216, 1154, 172, 172), "xy", True, DESK, None),
    "Interactive_Phone":    ((1652, 1269, 225, 153), "xy", True, DESK, (1, 1, 1, .3)),
    "Interactive_Notebook": ((1246, 1237, 409, 180), "xy", True, DESK, (1, 1, 1, .3)),
    "Desk_Plant":           ((1705, 1050, 230, 210), "xy", True, DESK, None),
    "Desk_Lamp":            ((845, 830, 200, 430), "x", True, "pivot", (1, 1, .5, 1)),
    "Interactive_Calendar": ((732, 510, 254, 310), "xz", True, None, None),
    "Interactive_Corkboard": ((423, 339, 333, 754), "yz", True, None, None),
    "Interactive_Trophy_CupTop":   ((1925, 334, 171, 190), "x", True, "keep", None),
    "Interactive_Trophy_MedalTop": ((2040, 335, 142, 188), "x", True, "keep", None),
    "Interactive_Trophy_CupLow":   ((1952, 791, 165, 194), "x", True, "keep", None),
    "Interactive_Trophy_MedalLow": ((2050, 786, 148, 198), "x", True, "keep", None),
    "Interactive_Trophy_MedalHang": ((1875, 456, 130, 264), "y", True, None, (1, 1, 0, 1)),
    "Desk_Chair":           ((578, 1190, 482, 346), "xy", False, 0.0, "chair"),
}
FOLLOW = {"Interactive_Laptop": ["Laptop_Screen"], "Desk_Lamp": ["Light_Desk_Lamp"]}

# children follow by parenting (keeps their world transform now)
for parent, kids in FOLLOW.items():
    p = D.objects[parent]
    for k in kids:
        c = D.objects[k]
        if c.parent != p:
            mw = c.matrix_world.copy()
            c.parent = p
            c.matrix_parent_inverse = p.matrix_world.inverted()
            c.matrix_world = mw

if UNDO:
    dk = D.objects["Desk"]
    if "pe_orig" in dk:
        v = list(dk["pe_orig"]); dk.location = v[:3]; dk.scale = (1, 1, 1)
    for n in JOBS:
        o = D.objects[n]
        if "pe_orig" in o:
            v = list(o["pe_orig"])
            o.location = v[:3]; o.scale = (v[3],) * 3
    print("restored")
else:
    def nelder(f, x0, step, iters=400):
        n = len(x0)
        S = [list(x0)] + [[x0[j] + (step[j] if j == i else 0) for j in range(n)] for i in range(n)]
        F = [f(s) for s in S]
        for _ in range(iters):
            o_ = sorted(range(n + 1), key=lambda i: F[i]); S = [S[i] for i in o_]; F = [F[i] for i in o_]
            c = [sum(S[i][j] for i in range(n)) / n for j in range(n)]
            r = [c[j] + (c[j] - S[-1][j]) for j in range(n)]; fr = f(r)
            if fr < F[0]:
                e = [c[j] + 2 * (c[j] - S[-1][j]) for j in range(n)]; fe = f(e)
                S[-1], F[-1] = (e, fe) if fe < fr else (r, fr)
            elif fr < F[-2]:
                S[-1], F[-1] = r, fr
            else:
                k = [c[j] + .5 * (S[-1][j] - c[j]) for j in range(n)]; fk = f(k)
                if fk < F[-1]: S[-1], F[-1] = k, fk
                else:
                    S = [S[0]] + [[S[0][j] + .5 * (s[j] - S[0][j]) for j in range(n)] for s in S[1:]]
                    F = [F[0]] + [f(s) for s in S[1:]]
        i = min(range(n + 1), key=lambda i: F[i])
        return S[i], F[i]

    desk = D.objects["Desk"]
    if "pe_orig" not in desk:
        desk["pe_orig"] = [*desk.location, desk.scale.y]
    dl = list(desk["pe_orig"])
    desk.location = dl[:3]; desk.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    back, front0 = -0.02, -0.88
    lo, hi = -2.0, front0
    for _ in range(40):                      # bisect: which y puts the desk's front-right top corner at v = 1403 px
        mid = (lo + hi) / 2
        v = (1 - world_to_camera_view(sc, cam, Vector((0.95, mid, DESK))).y) * H
        lo, hi = (mid, hi) if v > 1403 else (lo, mid)
    front = (lo + hi) / 2
    sy = (front - back) / (front0 - back)
    desk.scale = (1, sy, 1)
    desk.location.y = back - (back - dl[1]) * sy
    DESK_X = (-1.02, 0.92)
    DESK_Y = (front + 0.03, -0.05)
    print("desk front %.3f -> %.3f (depth x%.2f)" % (front0, front, sy))
    bpy.context.view_layer.update()

    dg = bpy.context.evaluated_depsgraph_get()
    for n, (tb, axes, can_scale, support, wts) in JOBS.items():
        o = D.objects[n]
        if "pe_orig" not in o:
            o["pe_orig"] = [*o.location, o.scale.x]
        ox, oy, oz, os_ = list(o["pe_orig"])
        o.location = (ox, oy, oz); o.scale = (os_,) * 3
        bpy.context.view_layer.update()
        # sample of vertices in the object's local space (children included)
        pts = []
        for ob in [o] + list(o.children):
            if ob.type != 'MESH':
                continue
            me = ob.evaluated_get(dg).to_mesh()
            step = max(1, len(me.vertices) // 600)
            toL = o.matrix_world.inverted() @ ob.matrix_world
            pts += [toL @ me.vertices[i].co for i in range(0, len(me.vertices), step)]
            ob.evaluated_get(dg).to_mesh_clear()
        rot = o.matrix_world.to_3x3().normalized()
        minz_local = min((rot @ p).z for p in pts)        # lowest point at scale 1, relative to the pivot
        base = Vector((ox, oy, oz))

        def place(v):
            loc = base.copy()
            for a, d in zip(axes, v[:len(axes)]):
                loc["xyz".index(a)] += d
            s = v[len(axes)] if can_scale else 1.0
            s = min(4.0, max(0.4, s))
            if support == "pivot":
                loc.z = oz
            elif support is not None:          # keep the object standing on its support while it scales
                floor = (oz + minz_local * os_) if support == "keep" else support
                loc.z = floor - minz_local * s
            return loc, s

        def box(loc, s):
            M = Matrix.Translation(loc) @ rot.to_4x4() @ Matrix.Scale(s, 4)
            ps = [world_to_camera_view(sc, cam, M @ p) for p in pts]
            us = [p.x * W for p in ps]; vs = [(1 - p.y) * H for p in ps]
            return min(us), min(vs), max(us) - min(us), max(vs) - min(vs)

        def off_desk(loc, s):
            if support != DESK:
                return 0.0
            M = Matrix.Translation(loc) @ rot.to_4x4() @ Matrix.Scale(s, 4)
            ws = [M @ p for p in pts if p.z < 0.03]          # footprint = the points touching the desk
            if not ws:
                return 0.0
            over = max(0, DESK_X[0] - min(q.x for q in ws)) + max(0, max(q.x for q in ws) - DESK_X[1])                 + max(0, DESK_Y[0] - min(q.y for q in ws)) + max(0, max(q.y for q in ws) - DESK_Y[1])
            return (over * 4000) ** 2

        def err(v):
            loc, s = place(v)
            x, y, w, h = box(loc, s)
            pen = off_desk(loc, s)
            if wts == "chair":   # only the top of the chair is in frame: match centre-x, top, width
                return ((x + w / 2) - (tb[0] + tb[2] / 2)) ** 2 + (y - tb[1]) ** 2 + (w - tb[2]) ** 2 + pen
            wx, wy, ww, wh = wts or (1, 1, 1, 1)
            return (wx * ((x + w / 2) - (tb[0] + tb[2] / 2)) ** 2 + wy * ((y + h) - (tb[1] + tb[3])) ** 2
                    + ww * (w - tb[2]) ** 2 + wh * (h - tb[3]) ** 2) + pen

        x0 = [0.0] * len(axes) + ([os_] if can_scale else [])
        st = [0.08] * len(axes) + ([0.3] if can_scale else [])
        v, e = nelder(err, x0, st)
        v, e = nelder(err, v, [s_ / 4 for s_ in st])
        loc, s = place(v)
        o.location = loc
        o.scale = (s,) * 3
        bx = box(loc, s)
        print("%-30s scale %.2f  move (%+.2f %+.2f %+.2f)  box (%4.0f,%4.0f %3.0fx%3.0f) want (%4d,%4d %3dx%3d)" % (
            n, s, loc.x - ox, loc.y - oy, loc.z - oz, *bx, *tb))
    bpy.context.view_layer.update()
