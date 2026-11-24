import bpy, bmesh
from mathutils import Vector
o=bpy.data.objects["Desk"]; M=o.matrix_world
bm=bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
seen=set(); kill=[]
for v in bm.verts:
    if v.index in seen: continue
    st=[v]; comp=[]; seen.add(v.index)
    while st:
        a=st.pop(); comp.append(a)
        for e in a.link_edges:
            b=e.other_vert(a)
            if b.index not in seen: seen.add(b.index); st.append(b)
    ws=[M@x.co for x in comp]
    mn=[min(p[i] for p in ws) for i in range(3)]; mx=[max(p[i] for p in ws) for i in range(3)]
    if mn[2] > 0.70 and mx[2] > 0.75 and max(mx[0]-mn[0], mx[1]-mn[1]) < 0.25:
        kill += comp; print("remove piece", [round(x,3) for x in mn], [round(x,3) for x in mx], len(comp))
bmesh.ops.delete(bm, geom=list(set(kill)), context='VERTS')
bm.to_mesh(o.data); bm.free()
