import bpy
from mathutils import Vector
for n in ["Curtain_Left","Interactive_Corkboard","Room_Wall_Left","Desk_Lamp","Interactive_Laptop"]:
    o=bpy.data.objects[n]
    bb=[o.matrix_world @ Vector(c) for c in o.bound_box]
    mn=[round(min(v[i] for v in bb),3) for i in range(3)]; mx=[round(max(v[i] for v in bb),3) for i in range(3)]
    print(n, "min", mn, "max", mx, "rot", [round(r,2) for r in o.rotation_euler])
