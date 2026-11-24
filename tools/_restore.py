import bpy
D=bpy.data
for n,e in [("Light_Desk_Lamp",44),("Light_Room_Fill",38),("Light_Sunset_Outside",35),("Light_Window_Warm",45)]:
    D.objects[n].hide_render=False; D.objects[n].data.energy=e
bpy.context.scene.world.node_tree.nodes["Background"].inputs[1].default_value=0.6
bpy.context.scene.render.engine='BLENDER_EEVEE'
print("restored")
