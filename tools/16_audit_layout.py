"""Layout audit: which props interpenetrate, float, hang off their support, and how their scales compare."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

D = bpy.data
dg = bpy.context.evaluated_depsgraph_get()
unused = D.collections["PE_Unused"]
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get() and unused not in o.users_collection
        and not o.name.startswith(("Room_", "_", "Window_Glass", "Window_LED", "Laptop_Screen"))]


def wbb(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def bvh(o):
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    me.transform(o.matrix_world)
    t = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    oe.to_mesh_clear()
    return t


B = {o.name: wbb(o) for o in objs}
T = {o.name: bvh(o) for o in objs}
names = sorted(B)
print("== interpenetrating pairs (surface intersections)")
skip = {frozenset(p) for p in [("Desk", "Interactive_Laptop"), ("Desk", "Coffee_Mug"), ("Desk", "Interactive_Phone"), ("Desk", "Interactive_Notebook"),
                               ("Desk", "Desk_Plant"), ("Desk", "Desk_Lamp")]}
for i, a in enumerate(names):
    for b in names[i + 1:]:
        (amn, amx), (bmn, bmx) = B[a], B[b]
        if any(amx[k] < bmn[k] - 1e-3 or bmx[k] < amn[k] - 1e-3 for k in range(3)):
            continue
        hits = T[a].overlap(T[b])
        if hits and frozenset((a, b)) not in skip:
            print("  %-30s x %-30s %4d face pairs" % (a, b, len(hits)))
print("== desk props: footprint vs desk top, and scale")
desk_mn, desk_mx = B["Desk"]
for n in ["Interactive_Laptop", "Coffee_Mug", "Interactive_Phone", "Interactive_Notebook", "Desk_Plant", "Desk_Lamp"]:
    mn, mx = B[n]; o = D.objects[n]
    print("  %-22s scale %.2f  x %.2f..%.2f  y %.2f..%.2f  z %.3f..%.3f  size %.2fx%.2fx%.2f m" % (
        n, o.scale.x, mn.x, mx.x, mn.y, mx.y, mn.z, mx.z, *(mx - mn)))
print("  desk top x %.2f..%.2f y %.2f..%.2f z %.3f" % (desk_mn.x, desk_mx.x, desk_mn.y, desk_mx.y, desk_mx.z))
print("== shelf props")
for n in [x for x in names if x.startswith("Interactive_Trophy")]:
    mn, mx = B[n]; o = D.objects[n]
    print("  %-30s scale %.2f  x %.2f..%.2f  y %.2f..%.2f  z %.3f..%.3f" % (n, o.scale.x, mn.x, mx.x, mn.y, mx.y, mn.z, mx.z))
for n in ["Bookshelf_Upper", "Bookshelf_Lower", "Interactive_Corkboard", "Interactive_Calendar", "Curtain_Left", "Desk_Chair"]:
    mn, mx = B[n]
    print("  %-30s x %.2f..%.2f  y %.2f..%.2f  z %.3f..%.3f" % (n, mn.x, mx.x, mn.y, mx.y, mn.z, mx.z))
