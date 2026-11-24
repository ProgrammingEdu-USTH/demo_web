"""Prep the PE room for web export: opening sashes, glass, plant decimation, LED bulb data, atlas UVs."""
import bpy, bmesh, json, math
from mathutils import Vector

D = bpy.data
sc = bpy.context.scene
OUT = "D:/EDU/PE-3d/web/public/assets/"
import os
os.makedirs(OUT, exist_ok=True)


def view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return dict(window=win, area=area, region=region)
    raise RuntimeError("no 3D view")


OV = view3d_override()


def coll(name, hidden=False):
    c = D.collections.get(name)
    if not c:
        c = D.collections.new(name)
        sc.collection.children.link(c)
    c.hide_render = hidden
    c.hide_viewport = hidden
    return c


def move_to(o, c):
    for uc in list(o.users_collection):
        uc.objects.unlink(o)
    c.objects.link(o)


# ---- 1. park the pieces replaced by web-side 2D layers / new sashes -----------------
unused = coll("PE_Unused", hidden=True)
for n in ["Window_Mullion_Center", "Window_Transom_Lower", "Window_Transom_Upper", "Window_Handle_L", "Window_Handle_R",
          "Sky_Backdrop", "City_Background", "City_Background_Windows"]:
    o = D.objects.get(n)
    if o and unused not in o.users_collection:
        move_to(o, unused)

# ---- 2. opening sashes ---------------------------------------------------------------
webc = coll("PE_Web")
wood = D.materials["Mat_Wood_Trim"]
dark = D.materials["Mat_LED_Wire"]
glass = D.materials.get("Mat_Glass") or D.materials.new("Mat_Glass")

X0, X1 = 0.0, 0.828          # sash local x: hinge -> meeting stile
Z0, Z1 = 0.857, 2.618
Y = 0.02
BW, BD = 0.05, 0.045         # bar width / depth


def box(bm, lo, hi, mat_index):
    v = [bm.verts.new((x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
    idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in idx:
        face = bm.faces.new([v[i] for i in f])
        face.material_index = mat_index


def make_sash(name, side):
    old = D.objects.get(name)
    if old:
        D.objects.remove(old, do_unlink=True)
    bm = bmesh.new()
    d0, d1 = -BD / 2, BD / 2
    box(bm, (X0, d0, Z0), (X0 + BW, d1, Z1), 0)                 # hinge stile
    box(bm, (X1 - BW, d0, Z0), (X1, d1, Z1), 0)                 # meeting stile
    box(bm, (X0 + BW, d0, Z0), (X1 - BW, d1, Z0 + BW), 0)       # bottom rail
    box(bm, (X0 + BW, d0, Z1 - BW), (X1 - BW, d1, Z1), 0)       # top rail
    for zc in (1.42, 2.04):                                     # transoms
        box(bm, (X0 + BW, d0 * .8, zc - 0.018), (X1 - BW, d1 * .8, zc + 0.018), 0)
    hx = X1 - BW / 2                                            # handle on the room side (-y)
    box(bm, (hx - 0.008, d0 - 0.022, 1.60), (hx + 0.008, d0, 1.70), 1)
    if side < 0:
        bmesh.ops.scale(bm, vec=(1, 1, 1), verts=bm.verts)
    else:
        bmesh.ops.scale(bm, vec=(-1, 1, 1), verts=bm.verts)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = D.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(wood)
    me.materials.append(dark)
    o = D.objects.new(name, me)
    o.location = (-0.828 if side < 0 else 0.828, Y, 0)
    webc.objects.link(o)
    # glass pane (web only; not baked)
    gname = name.replace("Sash", "Glass")
    og = D.objects.get(gname)
    if og:
        D.objects.remove(og, do_unlink=True)
    gm = D.meshes.new(gname)
    s = 1 if side < 0 else -1
    xs = sorted([s * (X0 + BW), s * (X1 - BW)])
    verts = [(xs[0], 0, Z0 + BW), (xs[1], 0, Z0 + BW), (xs[1], 0, Z1 - BW), (xs[0], 0, Z1 - BW)]
    gm.from_pydata(verts, [], [(0, 1, 2, 3)])
    uv = gm.uv_layers.new(name="UVMap")
    for li, co in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[li].uv = co
    gm.materials.append(glass)
    g = D.objects.new(gname, gm)
    g.parent = o
    g.hide_render = True
    webc.objects.link(g)
    return o


make_sash("Window_Sash_L", -1)
make_sash("Window_Sash_R", +1)

# ---- 3. foreground plant: Poly Haven model is 96k tris -> decimate for web -------------
fp = D.objects["Foreground_Plant_Left"]
tris = sum(len(p.vertices) - 2 for p in fp.data.polygons)
if tris > 12000:
    for m in list(fp.modifiers):
        fp.modifiers.remove(m)
    if fp.data.users > 1:
        fp.data = fp.data.copy()
    with bpy.context.temp_override(**OV, active_object=fp, object=fp, selected_objects=[fp], selected_editable_objects=[fp]):
        m = fp.modifiers.new("WebDecimate", 'DECIMATE')
        m.ratio = 9000 / tris
        m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
print("plant tris", sum(len(p.vertices) - 2 for p in fp.data.polygons))

# ---- 4. LED bulbs -> positions for a single Points draw call on the web ----------------
led = D.objects["Window_LED_Lights"]
bm = bmesh.new()
bm.from_mesh(led.data)
bm.verts.ensure_lookup_table()
seen, bulbs = set(), []
for v in bm.verts:
    if v.index in seen:
        continue
    stack, comp = [v], []
    seen.add(v.index)
    while stack:
        a = stack.pop()
        comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index)
                stack.append(b)
    c = sum((led.matrix_world @ x.co for x in comp), Vector()) / len(comp)
    r = max(((led.matrix_world @ x.co) - c).length for x in comp)
    bulbs.append([round(c.x, 4), round(c.y, 4), round(c.z, 4), round(r, 4)])
bm.free()
print("bulbs", len(bulbs), bulbs[:3])

cam = D.objects["Camera"]
data = {
    "bulbs": bulbs,
    "camera": {"pos": list(cam.location), "lens": cam.data.lens, "sensor": cam.data.sensor_width},
    "lamp": list(D.objects["Light_Desk_Lamp"].location),
}
for n in ["Coffee_Mug", "Desk_Lamp", "Interactive_Laptop", "Laptop_Screen"]:
    o = D.objects[n]
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    data[n] = {"min": [min(v[i] for v in bb) for i in range(3)], "max": [max(v[i] for v in bb) for i in range(3)]}
json.dump(data, open(OUT + "scene-data.json", "w"), indent=1)
print(json.dumps({k: v for k, v in data.items() if k != "bulbs"}))
