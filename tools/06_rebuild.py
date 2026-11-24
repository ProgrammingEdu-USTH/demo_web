"""Rebuild the PE room props in detail:
 - LED bar desk lamp (reference photo) + soft area light under the LED strip
 - detailed interactive props: laptop (+ separate screen), notebook, phone, mug, 5 trophies/medals, 28 books (3 courses)
 - office chair with rounded cushions
 - bevel + weighted normals on furniture so nothing reads razor sharp
 - foreground plant removed
Old objects are deleted; the untouched original is in blender/pe_room_backup_original.blend.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Euler

D = bpy.data
sc = bpy.context.scene
MAIN = D.collections["Collection"]


# ------------------------------------------------------------------ helpers
def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, lighten=0.0):
    v = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    v = [c + (0.92 - c) * lighten for c in v]
    return tuple(srgb2lin(c) for c in v)


def mat(name, col, rough=0.6, metal=0.0, emis=None, estr=0.0):
    m = D.materials.get(name) or D.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emis:
        b.inputs['Emission Color'].default_value = (*emis, 1)
        b.inputs['Emission Strength'].default_value = estr
    return m


def kill(name):
    o = D.objects.get(name)
    if o:
        me = o.data if o.type == 'MESH' else None
        D.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            D.meshes.remove(me)


def T(x, y=None, z=None):
    return Matrix.Translation(Vector(x) if y is None else Vector((x, y, z)))


def R(x=0, y=0, z=0):
    return Euler((x, y, z)).to_matrix().to_4x4()


def basis(X, Y, Z, origin):
    m = Matrix((X, Y, Z)).transposed().to_4x4()
    m.translation = origin
    return m


def bevel_bm(bm, width, seg, min_angle=0.0, min_len=0.0):
    edges = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > min_angle and e.calc_length() > min_len]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type='OFFSET', segments=seg, profile=0.5,
                        affect='EDGES', clamp_overlap=True)


def bm_box(sx, sy, sz, bev=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bev > 0:
        bevel_bm(bm, bev, seg)
    return bm


def bm_lathe(prof, seg=32):
    """profile [(r, z)] traced so that the solid is on the left (bottom-out, up the outside, back in on top)"""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r < 1e-7:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)])
    for A, B in zip(rings, rings[1:]):
        if len(A) == 1 and len(B) == 1:
            continue
        for k in range(seg):
            k1 = (k + 1) % seg
            if len(A) == 1:
                bm.faces.new((A[0], B[k1], B[k]))
            elif len(B) == 1:
                bm.faces.new((A[k], A[k1], B[0]))
            else:
                bm.faces.new((A[k], A[k1], B[k1], B[k]))
    return bm


def bm_torus(R0, r0, seg=24, rseg=8):
    prof = [(R0 + r0 * math.cos(-2 * math.pi * i / rseg + math.pi), r0 * math.sin(-2 * math.pi * i / rseg + math.pi)) for i in range(rseg + 1)]
    bm = bm_lathe(prof, seg)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    return bm


def catmull(pts, n=6):
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out


def bm_sweep(pts, prof, ref=(0, 0, 1), cap=True):
    """sweep a closed 2D profile [(u, v)] along a polyline; u follows the transported normal (starts along `ref`)"""
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    n = len(pts)
    tg = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    ref = Vector(ref)
    nrm = (ref - tg[0] * ref.dot(tg[0])).normalized()
    rings = []
    for i in range(n):
        t = tg[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bn = t.cross(nrm)
        rings.append([bm.verts.new(pts[i] + nrm * u + bn * v) for (u, v) in prof])
    m = len(prof)
    for i in range(n - 1):
        for j in range(m):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % m], rings[i + 1][(j + 1) % m], rings[i + 1][j]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def rrect(w, d, r, seg=6):
    pts = []
    for cx, cy, a0 in [(w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)]:
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(r, n=10, sx=1.0, sy=1.0):
    return [(r * sx * math.cos(2 * math.pi * k / n), r * sy * math.sin(2 * math.pi * k / n)) for k in range(n)]


def bm_prism(poly, h, bev=0.0, seg=2):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in poly]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, h), verts=nv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bev > 0:
        bevel_bm(bm, bev, seg, min_angle=1.0)
    return bm


class Builder:
    def __init__(self, M=None):
        self.bm = bmesh.new()
        self.mats = []
        self.M = M or Matrix()

    def add(self, pbm, m, M=None, smooth=True):
        bmesh.ops.transform(pbm, matrix=self.M @ (M or Matrix()), verts=pbm.verts)
        if m not in self.mats:
            self.mats.append(m)
        i = self.mats.index(m)
        for f in pbm.faces:
            f.material_index = i
            f.smooth = smooth
        tmp = D.meshes.new("_tmp")
        pbm.to_mesh(tmp)
        pbm.free()
        self.bm.from_mesh(tmp)
        D.meshes.remove(tmp)

    def build(self, name, pivot, coll=MAIN, wn=True):
        kill(name)
        pivot = Vector(pivot)
        bmesh.ops.translate(self.bm, vec=-pivot, verts=self.bm.verts)
        me = D.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        o = D.objects.new(name, me)
        o.location = pivot
        coll.objects.link(o)
        if wn:
            add_wn(o)
        return o


def add_wn(o):
    if not any(m.type == 'WEIGHTED_NORMAL' for m in o.modifiers):
        w = o.modifiers.new("WN", 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        w.weight = 50


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ------------------------------------------------------------------ materials
M_WOOD_D = D.materials["Mat_Wood_Dark"]
M_WIRE = D.materials["Mat_LED_Wire"]
M_LAMP = mat("Mat_Lamp_Body", (0.70, 0.50, 0.40), 0.5)
M_LED = mat("Mat_Lamp_LED", (1.0, 0.93, 0.82), 0.3, emis=(1.0, 0.86, 0.68), estr=22)
M_LAP = mat("Mat_Laptop_Body", (0.62, 0.64, 0.69), 0.38, 0.6)
M_KEYS = mat("Mat_Laptop_Keys", (0.035, 0.038, 0.048), 0.55)
M_PAD = mat("Mat_Laptop_Trackpad", (0.50, 0.52, 0.57), 0.3, 0.5)
M_BEZ = mat("Mat_Laptop_Bezel", (0.012, 0.013, 0.016), 0.25)
M_SCR = D.materials["Mat_Laptop_Screen"]
M_COVER = mat("Mat_Notebook_Cover", (0.16, 0.27, 0.24), 0.65)
M_SPIRAL = mat("Mat_Spiral", (0.62, 0.62, 0.65), 0.3, 1.0)
M_PEN = mat("Mat_Pen", (0.06, 0.08, 0.17), 0.35)
M_GOLD = mat("Mat_Trophy_Gold", (0.85, 0.58, 0.20), 0.3, 0.85)
M_SILV = mat("Mat_Trophy_Silver", (0.72, 0.74, 0.78), 0.28, 0.85)
M_BRON = mat("Mat_Trophy_Bronze", (0.62, 0.36, 0.20), 0.32, 0.85)
M_RIB_R = D.materials["Mat_Ribbon_Red"]
M_RIB_B = D.materials["Mat_Ribbon_Blue"]
M_PHONE = mat("Mat_Phone_Body", (0.10, 0.11, 0.14), 0.35, 0.3)
M_PSCR = mat("Mat_Phone_Screen", (0.02, 0.025, 0.04), 0.15, emis=(0.55, 0.68, 0.95), estr=1.2)
M_MUG = mat("Mat_Coffee_Mug", (0.86, 0.74, 0.64), 0.35)
M_COFFEE = mat("Mat_Coffee_Liquid", (0.12, 0.05, 0.02), 0.12)
M_PAGES = mat("Mat_Book_Pages", (0.80, 0.72, 0.58), 0.8)
M_BAND = mat("Mat_Book_Band", (0.78, 0.60, 0.30), 0.4, 0.4)
M_LABEL = D.materials["Mat_Note_White"]
M_FRAME = mat("Mat_Chair_Frame", (0.045, 0.042, 0.05), 0.45)
M_CHROME = mat("Mat_Chair_Chrome", (0.25, 0.25, 0.27), 0.25, 1.0)
M_FAB = D.materials["Mat_Chair_Fabric"]

# ruled paper: blue lines every 7.5 mm + a red margin, from object coordinates (follows the notebook when it moves)
M_PAGE = mat("Mat_Notebook_Page", (0.93, 0.89, 0.80), 0.85)
nt = M_PAGE.node_tree
for n in [n for n in nt.nodes if n.name.startswith("PG_")]:
    nt.nodes.remove(n)
bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
tc = nt.nodes.new("ShaderNodeTexCoord"); tc.name = "PG_tc"
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); sep.name = "PG_sep"
mul = nt.nodes.new("ShaderNodeMath"); mul.name = "PG_mul"; mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 1 / 0.0075
fr = nt.nodes.new("ShaderNodeMath"); fr.name = "PG_fr"; fr.operation = 'FRACT'
lt = nt.nodes.new("ShaderNodeMath"); lt.name = "PG_lt"; lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.1
ax = nt.nodes.new("ShaderNodeMath"); ax.name = "PG_ax"; ax.operation = 'ABSOLUTE'
mg = nt.nodes.new("ShaderNodeMath"); mg.name = "PG_mg"; mg.operation = 'COMPARE'; mg.inputs[1].default_value = 0.118; mg.inputs[2].default_value = 0.0007
mixl = nt.nodes.new("ShaderNodeMix"); mixl.name = "PG_mixl"; mixl.data_type = 'RGBA'
mixm = nt.nodes.new("ShaderNodeMix"); mixm.name = "PG_mixm"; mixm.data_type = 'RGBA'
mixl.inputs['A'].default_value = (0.93, 0.89, 0.80, 1); mixl.inputs['B'].default_value = (0.55, 0.64, 0.86, 1)
mixm.inputs['B'].default_value = (0.86, 0.42, 0.42, 1)
L = nt.links
L.new(tc.outputs['Object'], sep.inputs[0]); L.new(sep.outputs['Y'], mul.inputs[0]); L.new(mul.outputs[0], fr.inputs[0])
L.new(fr.outputs[0], lt.inputs[0]); L.new(lt.outputs[0], mixl.inputs['Factor'])
L.new(sep.outputs['X'], ax.inputs[0]); L.new(ax.outputs[0], mg.inputs[0]); L.new(mg.outputs[0], mixm.inputs['Factor'])
L.new(mixl.outputs['Result'], mixm.inputs['A']); L.new(mixm.outputs['Result'], bsdf.inputs['Base Color'])

# ------------------------------------------------------------------ remove what goes away
unused = D.collections["PE_Unused"]
for n in ["Foreground_Plant_Left"]:
    o = D.objects.get(n)
    if o:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        unused.objects.link(o)
pc = D.collections.get("potted_plant_01")
if pc:
    pc.hide_render = pc.hide_viewport = True
for n in ["Desk_Lamp", "Interactive_Laptop", "Laptop_Screen", "Interactive_Notebook", "Interactive_Phone", "Coffee_Mug",
          "Interactive_Trophy_1", "Interactive_Trophy_2", "Interactive_Trophy_3", "Interactive_Trophy_4",
          "Bookshelf_Books_Group", "Desk_Chair"] + ["Interactive_Book_%d" % i for i in range(1, 6)]:
    kill(n)
# the medal that hung on the upper shelf becomes its own interactive object
o = D.objects["Bookshelf_Upper"]
bm = bmesh.new(); bm.from_mesh(o.data)
drop = {i for i, s in enumerate(o.material_slots) if s.material and s.material.name in ("Mat_Trophy_Gold", "Mat_Ribbon_Blue")}
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in drop], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(o.data); bm.free()

DESK_Z = 0.743

# ------------------------------------------------------------------ LED bar desk lamp
b = Builder()
base_c = Vector((-0.80, -0.27, DESK_Z))
Rb, Hb = 0.078, 0.016
b.add(bm_lathe([(0, 0), (Rb - 0.008, 0), (Rb - 0.002, 0.0012), (Rb, 0.005), (Rb, Hb - 0.007), (Rb - 0.0015, Hb - 0.002),
                (Rb - 0.007, Hb), (0, Hb)], 56), M_LAMP, T(base_c))
a = Vector((0.97, -0.25, 0)).normalized()
up = Vector((0, 0, 1))
rise = math.radians(33)
stem0 = base_c - a * 0.048 + up * (Hb - 0.003)
P1 = stem0 + up * 0.27
Rbend = 0.04
C = P1 + a * Rbend
arc = [C - a * Rbend * math.cos(t) + up * Rbend * math.sin(t) for t in [i / 10 * (math.pi / 2 - rise) for i in range(11)]]
d = (a * math.cos(rise) + up * math.sin(rise)).normalized()
ARM = 0.31
P3 = arc[-1] + d * ARM
path = [stem0, stem0 + up * 0.15, P1] + arc[1:] + [arc[-1] + d * (ARM * 0.5), P3]
prof = [(u * 0.007, v * 0.011) for (u, v) in rrect(2, 2, 0.5, 3)]
b.add(bm_sweep(path, prof, ref=a), M_LAMP)
n_arm = (a * math.sin(rise) * -1 + up * -math.cos(rise))          # underside of the arm
n_arm = (n_arm - d * n_arm.dot(d)).normalized()
side = n_arm.cross(d)
led_len = ARM - 0.05
led_c = arc[-1] + d * (0.03 + led_len / 2) + n_arm * 0.0072
b.add(bm_box(led_len, 0.014, 0.0016, 0.0006, 1), M_LED, basis(d, side, n_arm, led_c))
# end cap of the arm: small rounded plug
b.add(bm_lathe([(0, 0), (0.0068, 0), (0.0068, 0.003), (0.004, 0.005), (0, 0.0055)], 16), M_LAMP,
      basis(side, n_arm.cross(side) * -1, d, P3 - d * 0.001) if False else basis(side.cross(d).normalized(), side, d, P3 - d * 0.001))
# touch button on the base and the cable running off behind the desk
b.add(bm_lathe([(0, 0), (0.007, 0), (0.007, 0.0012), (0, 0.0016)], 20), M_WIRE, T(base_c + a * 0.035 + up * Hb))
cab0 = base_c - a * 0.07 + up * 0.004
cable = catmull([cab0, cab0 + Vector((-0.01, 0.07, -0.002)), Vector((cab0.x - 0.03, -0.05, DESK_Z + 0.0025)),
                 Vector((cab0.x - 0.04, -0.015, DESK_Z + 0.001)), Vector((cab0.x - 0.045, -0.012, DESK_Z - 0.06)),
                 Vector((cab0.x - 0.045, -0.012, 0.35))], 6)
b.add(bm_sweep(cable, circle(0.0024, 8)), M_WIRE)
lamp = b.build("Desk_Lamp", base_c)

lt_obj = D.objects["Light_Desk_Lamp"]
lt_obj.data.type = 'AREA'
lt_obj.data.shape = 'RECTANGLE'
lt_obj.data.size = led_len
lt_obj.data.size_y = 0.014
lt_obj.data.energy = 26
lt_obj.data.color = (1.0, 0.82, 0.62)
Zl = -n_arm
lt_obj.matrix_world = basis(d, Zl.cross(d), Zl, led_c + n_arm * 0.003)
for k in ("spot_size", "spot_blend"):
    pass

# ------------------------------------------------------------------ laptop + screen
lap_c = Vector((-0.45, -0.44, DESK_Z))
b = Builder(T(lap_c) @ R(z=0.10))
BW, BD = 0.32, 0.222
for sx in (-1, 1):
    for sy in (-1, 1):
        b.add(bm_lathe([(0, 0), (0.006, 0), (0.006, 0.0015), (0, 0.0015)], 12), M_KEYS, T(sx * 0.13, sy * 0.085, 0))
b.add(bm_prism(rrect(BW, BD, 0.011, 6), 0.0125, 0.0035, 3), M_LAP, T(0, 0, 0.0015))
top = 0.014
kp, ks = 0.0186, 0.0158
rows = [(0.091, 14, 0.0085), (0.0745, 14, ks), (0.0559, 14, ks), (0.0373, 14, ks), (0.0187, 14, ks)]
for y, ncol, kh in rows:
    for i in range(ncol):
        x = (i - (ncol - 1) / 2) * kp
        b.add(bm_box(ks, kh, 0.0016, 0.0011, 1), M_KEYS, T(x, y, top + 0.0008))
bottom = [1, 1, 1, 1.25, 5.6, 1.25, 1, 1]
x = -sum(bottom) * kp / 2
for wk in bottom:
    w = wk * kp
    b.add(bm_box(w - (kp - ks), ks, 0.0016, 0.0011, 1), M_KEYS, T(x + w / 2, 0.0001, top + 0.0008))
    x += w
b.add(bm_prism(rrect(0.108, 0.066, 0.005, 4), 0.0004, 0.0, 1), M_PAD, T(0, -0.062, top - 0.0001))
hinge = Vector((0, BD / 2 - 0.006, 0.0115))
b.add(bm_lathe([(0, -0.12), (0.0058, -0.12), (0.0058, 0.12), (0, 0.12)], 16), M_BEZ, T(hinge) @ R(y=math.pi / 2))
tilt = math.radians(17)
upv = Vector((0, math.sin(tilt), math.cos(tilt)))
fwd = Vector((0, -math.cos(tilt), math.sin(tilt)))
LH = 0.214
lid_c = hinge + upv * (LH / 2 + 0.002) - fwd * 0.0036
lidM = basis(Vector((1, 0, 0)), upv, fwd, lid_c)
b.add(bm_prism(rrect(BW, LH, 0.011, 6), 0.0066, 0.0025, 2), M_LAP, lidM @ T(0, 0, -0.0033))
b.add(bm_prism(rrect(BW - 0.008, LH - 0.008, 0.008, 5), 0.0006, 0, 1), M_BEZ, lidM @ T(0, 0, 0.0031))
b.add(bm_lathe([(0, 0), (0.0016, 0), (0.0016, 0.0002), (0, 0.0003)], 10), M_KEYS, lidM @ T(0, LH / 2 - 0.0085, 0.0037))
laptop = b.build("Interactive_Laptop", lap_c)

me = D.meshes.new("Laptop_Screen")
SW, SH = 0.296, 0.184
corners = [(-SW / 2, -SH / 2 + 0.003), (SW / 2, -SH / 2 + 0.003), (SW / 2, SH / 2 + 0.003), (-SW / 2, SH / 2 + 0.003)]
W = T(lap_c) @ R(z=0.10) @ lidM
me.from_pydata([W @ Vector((x, y, 0.0039)) for x, y in corners], [], [(0, 1, 2, 3)])
uv = me.uv_layers.new(name="Atlas")
for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
    uv.data[i].uv = c
me.materials.append(M_SCR)
scr = D.objects.new("Laptop_Screen", me)
MAIN.objects.link(scr)

# ------------------------------------------------------------------ notebook (open, spiral bound) + pen + ribbon
nb_c = Vector((0.13, -0.56, DESK_Z))
b = Builder(T(nb_c) @ R(z=-0.10))
b.add(bm_prism(rrect(0.312, 0.218, 0.005, 3), 0.0024, 0.001, 1), M_COVER)


def page_block(sign):
    bm = bmesh.new()
    nx, w, dd = 14, 0.146, 0.206
    top_z = lambda t: 0.0068 - 0.0032 * t ** 0.7 + 0.0012 * (1 - t) ** 3
    ring_b, ring_t = [], []
    for i in range(nx + 1):
        t = i / nx
        x = sign * (0.006 + t * w)
        ring_b.append((bm.verts.new((x, -dd / 2, 0.0024)), bm.verts.new((x, dd / 2, 0.0024))))
        ring_t.append((bm.verts.new((x, -dd / 2, 0.0024 + top_z(t))), bm.verts.new((x, dd / 2, 0.0024 + top_z(t)))))
    for i in range(nx):
        q = [(ring_t[i][0], ring_t[i + 1][0], ring_t[i + 1][1], ring_t[i][1]),
             (ring_b[i][1], ring_b[i + 1][1], ring_b[i + 1][0], ring_b[i][0]),
             (ring_b[i][0], ring_b[i + 1][0], ring_t[i + 1][0], ring_t[i][0]),
             (ring_t[i][1], ring_t[i + 1][1], ring_b[i + 1][1], ring_b[i][1])]
        for f in q:
            bm.faces.new(f if sign > 0 else tuple(reversed(f)))
    for i in (0, nx):
        f = (ring_b[i][0], ring_t[i][0], ring_t[i][1], ring_b[i][1])
        bm.faces.new(f if (sign > 0) == (i == 0) else tuple(reversed(f)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


b.add(page_block(1), M_PAGE)
b.add(page_block(-1), M_PAGE)
for i in range(17):
    y = -0.096 + i * 0.012
    b.add(bm_torus(0.0068, 0.0008, 18, 6), M_SPIRAL, T(0, y, 0.0072) @ R(x=math.pi / 2))
pen_M = T(0.075, 0.005, 0.0105) @ R(z=0.55) @ R(y=math.pi / 2) @ T(0, 0, -0.07)
b.add(bm_lathe([(0, 0), (0.0007, 0.001), (0.0018, 0.006), (0.0034, 0.016), (0.0040, 0.020)], 16), M_SPIRAL, pen_M)
b.add(bm_lathe([(0, 0.0198), (0.0045, 0.0200), (0.0045, 0.128), (0.0040, 0.136), (0.0025, 0.140), (0, 0.1405)], 18), M_PEN, pen_M)
b.add(bm_lathe([(0, 0.098), (0.0048, 0.098), (0.0048, 0.104), (0, 0.104)], 18), M_SPIRAL, pen_M)
b.add(bm_box(0.0012, 0.0025, 0.034, 0.0005, 1), M_SPIRAL, pen_M @ T(0, 0.0052, 0.118))
rib = catmull([(-0.012, 0.09, 0.0085), (-0.016, 0.0, 0.0072), (-0.02, -0.08, 0.0068), (-0.03, -0.112, 0.0035), (-0.045, -0.13, 0.0004)], 5)
b.add(bm_sweep(rib, [(-0.0003, -0.0035), (-0.0003, 0.0035), (0.0003, 0.0035), (0.0003, -0.0035)], ref=(0, 0, 1)), M_RIB_R)
notebook = b.build("Interactive_Notebook", nb_c)

# ------------------------------------------------------------------ phone
ph_c = Vector((0.47, -0.60, DESK_Z))
b = Builder(T(ph_c) @ R(z=0.28))
b.add(bm_prism(rrect(0.074, 0.154, 0.0105, 8), 0.0078, 0.0021, 3), M_PHONE)
b.add(bm_prism(rrect(0.0685, 0.1485, 0.0085, 8), 0.0003, 0, 1), M_PSCR, T(0, 0, 0.0076))
b.add(bm_prism(rrect(0.019, 0.0055, 0.00275, 4), 0.0002, 0, 1), M_BEZ, T(0, 0.064, 0.0079))
for y0, ln in ((0.035, 0.022), (0.004, 0.012), (0.022, 0.012)):
    b.add(bm_box(0.0016, ln, 0.0026, 0.0007, 1), M_PHONE, T(0.0375 if y0 == 0.035 else -0.0375, y0, 0.0039))
phone = b.build("Interactive_Phone", ph_c)

# ------------------------------------------------------------------ mug
mug_c = Vector((-0.14, -0.47, DESK_Z))
b = Builder(T(mug_c) @ R(z=-0.65))
b.add(bm_lathe([(0, 0), (0.033, 0), (0.0365, 0.0015), (0.0385, 0.006), (0.0402, 0.03), (0.0405, 0.091), (0.0398, 0.0955),
                (0.0375, 0.0962), (0.0356, 0.093), (0.0352, 0.03), (0.032, 0.0115), (0.022, 0.0095), (0, 0.0095)], 44), M_MUG)
b.add(bm_lathe([(0.0354, 0.074), (0.02, 0.0743), (0, 0.0744)], 44), M_COFFEE)
hp = catmull([(0.0385, 0, 0.081), (0.058, 0, 0.079), (0.0665, 0, 0.058), (0.059, 0, 0.033), (0.0385, 0, 0.027)], 6)
b.add(bm_sweep(hp, circle(1, 12, 0.0045, 0.0068), ref=(1, 0, 0)), M_MUG)
mug = b.build("Coffee_Mug", mug_c)


# ------------------------------------------------------------------ trophies & medals
def cup(name, base, metal, rot=0.0):
    b = Builder(T(base) @ R(z=rot))
    b.add(bm_box(0.088, 0.075, 0.022, 0.004, 2), M_WOOD_D, T(0, 0, 0.011))
    b.add(bm_box(0.066, 0.056, 0.013, 0.003, 2), M_WOOD_D, T(0, 0, 0.0285))
    b.add(bm_box(0.044, 0.0012, 0.013, 0.0005, 1), M_GOLD, T(0, -0.0378, 0.011))
    z0 = 0.035
    b.add(bm_lathe([(0, 0), (0.026, 0), (0.026, 0.004), (0.021, 0.008), (0.009, 0.014), (0.0058, 0.026), (0.0105, 0.032),
                    (0.0105, 0.035), (0.0058, 0.040), (0.006, 0.050), (0.013, 0.056), (0.030, 0.072), (0.039, 0.098),
                    (0.0425, 0.122), (0.0418, 0.1265), (0.0392, 0.1255), (0.0372, 0.101), (0.029, 0.077), (0.012, 0.063), (0, 0.0615)], 40),
          metal, T(0, 0, z0))
    for s in (-1, 1):
        hp = catmull([(s * 0.037, 0, z0 + 0.116), (s * 0.058, 0, z0 + 0.113), (s * 0.063, 0, z0 + 0.094),
                      (s * 0.050, 0, z0 + 0.077), (s * 0.030, 0, z0 + 0.071)], 5)
        b.add(bm_sweep(hp, circle(0.0032, 8), ref=(0, 1, 0)), metal)
    return b.build(name, base)


def medal_disc(metal):
    return bm_lathe([(0, -0.0022), (0.028, -0.0022), (0.0305, -0.0008), (0.0305, 0.001), (0.0285, 0.0026), (0.025, 0.0026),
                     (0.0242, 0.0016), (0.0135, 0.0016), (0.0128, 0.0028), (0, 0.0030)], 36)


def ribbon(bld, p_top, p_bot, wdt, m, normal):
    dvec = (p_bot - p_top)
    ln = dvec.length
    dn = dvec.normalized()
    s = normal.cross(dn).normalized()
    bld.add(bm_box(wdt, ln, 0.0007, 0.0002, 1), m, basis(s, dn, normal, (p_top + p_bot) / 2))


def medal_stand(name, base, metal, rib, rot=0.0):
    b = Builder(T(base) @ R(z=rot))
    b.add(bm_box(0.078, 0.046, 0.012, 0.003, 2), M_WOOD_D, T(0, 0, 0.006))
    for s in (-1, 1):
        b.add(bm_box(0.008, 0.008, 0.152, 0.0022, 2), M_WOOD_D, T(s * 0.03, 0.006, 0.012 + 0.076))
    b.add(bm_box(0.076, 0.009, 0.009, 0.0025, 2), M_WOOD_D, T(0, 0.006, 0.166))
    fwd = Vector((0, -1, 0))
    mc = Vector((0, -0.002, 0.070))
    for s in (-1, 1):
        ribbon(b, Vector((s * 0.017, 0.0005, 0.163)), Vector((s * 0.004, -0.0005, mc.z + 0.034)), 0.016, rib, fwd)
    b.add(bm_torus(0.0052, 0.0011, 16, 6), metal, T(0, -0.0015, mc.z + 0.033) @ R(x=math.pi / 2))
    b.add(medal_disc(metal), metal, T(mc) @ R(x=math.pi / 2))
    return b.build(name, base)


cup("Interactive_Trophy_CupTop", Vector((1.16, -0.18, 1.98)), M_GOLD, 0.15)
medal_stand("Interactive_Trophy_MedalTop", Vector((1.47, -0.17, 1.98)), M_GOLD, M_RIB_R, -0.12)
cup("Interactive_Trophy_CupLow", Vector((1.17, -0.18, 1.08)), M_SILV, 0.1)
medal_stand("Interactive_Trophy_MedalLow", Vector((1.48, -0.17, 1.08)), M_BRON, M_RIB_B, -0.18)
# medal hanging on the outer side of the wall shelf, pivot = hook (it swings from there)
hook = Vector((1.004, -0.25, 1.958))
b = Builder()
b.add(bm_lathe([(0, 0), (0.0035, 0), (0.0035, 0.008), (0.0055, 0.009), (0.0055, 0.0115), (0, 0.0115)], 14), M_GOLD,
      T(1.010, hook.y, hook.z) @ R(y=-math.pi / 2))
out = Vector((-1, 0, 0))
mc = Vector((1.0045, -0.25, 1.74))
for s in (-1, 1):
    ribbon(b, Vector((1.0035, hook.y + s * 0.006, hook.z - 0.004)), Vector((1.0040, mc.y + s * 0.006, mc.z + 0.034)), 0.017, M_RIB_B, out)
b.add(bm_torus(0.0052, 0.0011, 16, 6), M_GOLD, T(1.0045, mc.y, mc.z + 0.033) @ R(z=math.pi / 2) @ R(x=math.pi / 2))
b.add(medal_disc(M_GOLD), M_GOLD, T(mc) @ R(y=-math.pi / 2))
b.build("Interactive_Trophy_MedalHang", hook)

# ------------------------------------------------------------------ books: one book = one lesson, three courses like the PE
COLS = {"book0": "#4d4e53", "book1": "#6c2d3b", "book2": "#222c24", "book3": "#534d5c", "book4": "#62202c", "book5": "#292349",
        "book6": "#51392e", "book7": "#572447", "book8": "#232d42", "pb0": "#4a3d3f", "pb1": "#4e3248", "pb2": "#6a4228",
        "pb3": "#383931", "pb4": "#342751", "pb5": "#592732", "pb6": "#302e29", "pb7": "#323548", "pb8": "#432a4d",
        "pb9": "#491824", "pb10": "#302f30", "tb0": "#312c29", "tb1": "#2f2b40", "tb2": "#3d243d", "tb3": "#451b26",
        "tb4": "#282432", "tb5": "#181a25", "tb6": "#24252f", "tb7": "#33151d"}
rng = random.Random(7)


def book(name, x, z0, t, h, colhex, band, label):
    m = mat("Mat_" + name, hexcol(colhex, 0.22), 0.62)
    dd, c = 0.205, 0.0022
    bul = min(0.0065, t * 0.2)
    arc_o = [(t / 2 * math.cos(p), -dd / 2 + bul * math.sin(p)) for p in [math.pi + math.pi * k / 10 for k in range(11)]]
    arc_i = [((t / 2 - c) * math.cos(p), -dd / 2 + (bul - c * 0.7) * math.sin(p)) for p in [2 * math.pi - math.pi * k / 10 for k in range(11)]]
    poly = [(-t / 2, dd / 2)] + arc_o + [(t / 2, dd / 2), (t / 2 - c, dd / 2)] + arc_i + [(-t / 2 + c, dd / 2)]
    b = Builder(T(x, -0.19, z0))
    b.add(bm_prism(poly, h), m)
    b.add(bm_box(t - 2 * c - 0.0004, dd - 0.003, h - 0.008, 0.0008, 1), M_PAGES, T(0, -0.0012, h / 2))
    arc_b = [Vector(((t / 2 + 0.0004) * math.cos(p), -dd / 2 + (bul + 0.0004) * math.sin(p), 0)) for p in [math.pi * 1.04 + math.pi * 0.92 * k / 10 for k in range(11)]]
    if band:
        for zb in (0.022, h - 0.022):
            b.add(bm_sweep([p + Vector((0, 0, zb)) for p in arc_b], [(-0.0028, -0.0005), (0.0028, -0.0005), (0.0028, 0.0005), (-0.0028, 0.0005)], ref=(0, 0, 1)), band)
    if label:
        b.add(bm_sweep([p + Vector((0, 0, h * 0.58)) for p in arc_b], [(-0.024, -0.0004), (0.024, -0.0004), (0.024, 0.0004), (-0.024, 0.0004)], ref=(0, 0, 1)), M_LABEL)
    return b.build(name, Vector((x, -0.19 - dd / 2, z0)))


ROWS = [("book", 9, 1.571, (0.040, 0.060), (0.27, 0.355)),
        ("pb", 11, 0.666, (0.033, 0.050), (0.28, 0.36)),
        ("tb", 8, 0.256, (0.040, 0.068), (0.29, 0.365))]
for key, n, z0, (tmin, tmax), (hmin, hmax) in ROWS:
    x = 1.047
    for i in range(n):
        t = rng.uniform(tmin, tmax)
        h = rng.uniform(hmin, hmax)
        band = [M_BAND, None, mat("Mat_Book_BandDark", (0.04, 0.035, 0.04), 0.5)][rng.randrange(3)]
        book("Interactive_Book_%s%d" % (key, i), x + t / 2, z0, t, h, COLS["%s%d" % (key, i)], band, rng.random() < 0.4)
        x += t + rng.uniform(0.0008, 0.003)
    print(key, "row ends at", round(x, 3))

# ------------------------------------------------------------------ office chair
ch_M = T(-0.56, -0.98, 0) @ R(z=-0.384)
b = Builder(ch_M)
b.add(bm_lathe([(0, 0.07), (0.04, 0.07), (0.042, 0.09), (0.036, 0.108), (0, 0.11)], 24), M_FRAME)
for k in range(5):
    Rz = R(z=k * 2 * math.pi / 5 + 0.3)
    leg = bm_box(0.27, 0.034, 0.026, 0.008, 2)
    for v in leg.verts:
        f = (v.co.x + 0.135) / 0.27
        v.co.y *= 1 - 0.3 * f
        v.co.z *= 1 - 0.25 * f
        v.co.z -= 0.012 * f
    b.add(leg, M_FRAME, Rz @ T(0.155, 0, 0.088))
    b.add(bm_box(0.018, 0.014, 0.03, 0.004, 1), M_FRAME, Rz @ T(0.282, 0, 0.06))
    b.add(bm_lathe([(0, -0.011), (0.022, -0.011), (0.0245, -0.006), (0.0245, 0.006), (0.022, 0.011), (0, 0.011)], 20), M_FRAME,
          Rz @ T(0.282, 0, 0.0245) @ R(x=math.pi / 2))
b.add(bm_lathe([(0, 0.10), (0.031, 0.10), (0.031, 0.225), (0.022, 0.232), (0.021, 0.36), (0, 0.36)], 24), M_CHROME)
b.add(bm_box(0.2, 0.22, 0.03, 0.008, 2), M_FRAME, T(0, 0, 0.375))
seat = bm_box(0.49, 0.47, 0.08, 0.034, 5)
for v in seat.verts:
    if v.co.z > 0:
        v.co.z += 0.012 * max(0, 1 - (v.co.x / 0.245) ** 2) * max(0, 1 - (v.co.y / 0.235) ** 2)
b.add(seat, M_FAB, T(0, 0.02, 0.43))
b.add(bm_box(0.06, 0.025, 0.24, 0.008, 2), M_FRAME, T(0, -0.235, 0.52) @ R(x=-0.12))
back = bm_box(0.45, 0.07, 0.52, 0.03, 5)
for v in back.verts:
    v.co.y += 0.05 * (v.co.x / 0.225) ** 2
    if v.co.y > 0.0:
        v.co.y += 0.012 * max(0, 1 - (v.co.x / 0.225) ** 2) * max(0, 1 - ((v.co.z + 0.08) / 0.26) ** 2)
b.add(back, M_FAB, T(0, -0.255, 0.83) @ R(x=-0.13))
for s in (-1, 1):
    b.add(bm_box(0.026, 0.05, 0.17, 0.006, 2), M_FRAME, T(s * 0.255, -0.02, 0.5))
    b.add(bm_box(0.065, 0.25, 0.03, 0.012, 3), M_FRAME, T(s * 0.255, 0.0, 0.6))
b.build("Desk_Chair", Vector((-0.56, -0.98, 0)))

# ------------------------------------------------------------------ soften existing furniture
def soften(name, width, seg, min_len=0.0):
    o = D.objects.get(name)
    if not o or o.get("pe_softened"):
        return
    o["pe_softened"] = 1
    if o.data.users > 1:
        o.data = o.data.copy()
    bm = bmesh.new(); bm.from_mesh(o.data)
    bevel_bm(bm, width, seg, min_angle=0.6, min_len=min_len)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(o.data); bm.free()
    add_wn(o)


for n, w, s in [("Desk", 0.005, 3), ("Bookshelf_Upper", 0.004, 2), ("Bookshelf_Lower", 0.004, 2), ("Window_Sill", 0.006, 3),
                ("Window_Frame_Left", 0.005, 2), ("Window_Frame_Right", 0.005, 2), ("Window_Frame_Top", 0.005, 2),
                ("Window_Frame_Bottom", 0.005, 2), ("Room_Cornice_Back", 0.008, 2), ("Room_Cornice_Left", 0.008, 2),
                ("Room_Cornice_Right", 0.008, 2), ("Window_Sash_L", 0.004, 2), ("Window_Sash_R", 0.004, 2),
                ("Right_Wall_Decor", 0.004, 2)]:
    soften(n, w, s)
for n in ("Interactive_Corkboard", "Interactive_Calendar"):
    soften(n, 0.0025, 1, min_len=0.03)
for n in ("Curtain_Left", "Desk_Plant"):
    o = D.objects[n]
    for p in o.data.polygons:
        p.use_smooth = True

for o in sorted([o for o in MAIN.objects if o.type == 'MESH'], key=lambda o: o.name):
    print("%-34s tris=%d" % (o.name, tris(o)))
