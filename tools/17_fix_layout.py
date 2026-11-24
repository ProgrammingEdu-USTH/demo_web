"""Small layout fixes on top of the user's own arrangement (their unsaved state is backed up first)."""
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

D = bpy.data
bpy.ops.wm.save_as_mainfile(filepath="D:/EDU/PE-3d/blender/pe_room_before_layout_fix.blend", copy=True)
print("backup of the current state saved")
dg = bpy.context.evaluated_depsgraph_get()


def bvh(o):
    oe = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = oe.to_mesh(); me.transform(o.matrix_world)
    t = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
    oe.to_mesh_clear()
    return t


# 1) chair: slide right until it clears the desk's left legs (keep it tucked under the desk, same depth)
chair, desk = D.objects["Desk_Chair"], D.objects["Desk"]
x0 = chair.location.x
tdesk = bvh(desk)
for i in range(60):
    chair.location.x = x0 + i * 0.01
    bpy.context.view_layer.update()
    if not tdesk.overlap(bvh(chair)):
        break
chair.location.x += 0.02          # a little air
bpy.context.view_layer.update()
print("chair x %.3f -> %.3f, still touching desk: %s" % (x0, chair.location.x, bool(tdesk.overlap(bvh(chair)))))

# 2) the two yellow notes modelled on the desk's back edge poke into the sill; the interactive notes replace them
if desk.data.users > 1:
    desk.data = desk.data.copy()
bm = bmesh.new(); bm.from_mesh(desk.data)
idx = {i for i, s in enumerate(desk.material_slots) if s.material and s.material.name == "Mat_Note_Yellow"}
faces = [f for f in bm.faces if f.material_index in idx]
bmesh.ops.delete(bm, geom=faces, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(desk.data); bm.free()
print("removed %d note faces from the desk" % len(faces))
bpy.context.view_layer.update()
print("desk x sill still intersect:", bool(bvh(desk).overlap(bvh(D.objects["Window_Sill"]))))
