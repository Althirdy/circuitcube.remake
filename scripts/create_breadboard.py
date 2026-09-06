import bpy
import math

# ============================================================
# CircuitCube - Simplified 830-point Breadboard Generator
# Blender Python script
#
# Coordinate system:
#   X = breadboard length
#   Y = breadboard width
#   Z = height
#
# Notes:
# - Uses real-world metric dimensions.
# - Holes are shallow dark cylinders for appearance, NOT booleans.
# - Each hole is named and tagged with simple metadata for future use.
# - This is intended as a first CircuitCube prototype asset.
# ============================================================

# -----------------------------
# SETTINGS
# -----------------------------
CLEAR_SCENE = True

BODY_LENGTH = 0.165       # 165 mm
BODY_WIDTH = 0.055        # 55 mm
BODY_HEIGHT = 0.0085      # 8.5 mm

PITCH = 0.00254           # 2.54 mm standard breadboard spacing
TERMINAL_ROWS = 63        # 63 rows x 10 holes = 630
POWER_RAIL_HOLES = 50     # 4 rails x 50 holes = 200
TOTAL_HOLES = 830

HOLE_RADIUS = 0.00068
HOLE_DEPTH = 0.00055
HOLE_VERTICES = 8         # intentionally low-poly

CHANNEL_GAP = 0.00762     # center trench visual width
CHANNEL_WIDTH = 0.0022

RAIL_Y = [-0.0240, -0.0195, 0.0195, 0.0240]
RAIL_TYPES = ["NEG", "POS", "POS", "NEG"]

# Slightly above the top surface so the "holes" are clearly visible.
TOP_Z = BODY_HEIGHT / 2
HOLE_Z = TOP_Z + 0.00008


# -----------------------------
# HELPERS
# -----------------------------
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Remove unused mesh/material data created by repeated test runs.
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def create_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)


def create_material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)

    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness

    return mat


def add_box(name, location, dimensions, material, collection, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions

    # Apply scale so bevel behaves predictably.
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel > 0:
        modifier = obj.modifiers.new(name="SoftEdges", type='BEVEL')
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = 'ANGLE'

        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    if material:
        obj.data.materials.append(material)

    move_to_collection(obj, collection)
    return obj


def add_visual_hole(name, x, y, material, collection, hole_id, node_group):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=HOLE_VERTICES,
        radius=HOLE_RADIUS,
        depth=HOLE_DEPTH,
        location=(x, y, HOLE_Z),
    )

    obj = bpy.context.object
    obj.name = name

    if material:
        obj.data.materials.append(material)

    # Metadata that may be useful later when inspecting the .blend.
    obj["circuitcube_type"] = "breadboard_hole"
    obj["hole_id"] = hole_id
    obj["node_group"] = node_group

    move_to_collection(obj, collection)
    return obj


def add_rail_stripe(name, y, material, collection):
    # Printed line rather than geometry-heavy detail.
    return add_box(
        name=name,
        location=(0, y, TOP_Z + 0.00013),
        dimensions=(0.136, 0.00055, 0.00018),
        material=material,
        collection=collection,
        bevel=0.00005,
    )


# -----------------------------
# SCENE SETUP
# -----------------------------
if CLEAR_SCENE:
    clear_scene()

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'MILLIMETERS'
scene.unit_settings.scale_length = 1.0

collection = create_collection("CircuitCube_Breadboard")

# Materials
mat_body = create_material(
    "BB_OffWhite",
    (0.88, 0.88, 0.84),
    metallic=0.0,
    roughness=0.62,
)

mat_hole = create_material(
    "BB_HoleDark",
    (0.025, 0.025, 0.025),
    metallic=0.05,
    roughness=0.42,
)

mat_channel = create_material(
    "BB_Channel",
    (0.25, 0.25, 0.23),
    metallic=0.0,
    roughness=0.7,
)

mat_red = create_material(
    "BB_Red",
    (0.70, 0.035, 0.035),
    metallic=0.0,
    roughness=0.48,
)

mat_blue = create_material(
    "BB_Blue",
    (0.035, 0.18, 0.70),
    metallic=0.0,
    roughness=0.48,
)

# -----------------------------
# BODY
# -----------------------------
body = add_box(
    name="Breadboard_Body",
    location=(0, 0, 0),
    dimensions=(BODY_LENGTH, BODY_WIDTH, BODY_HEIGHT),
    material=mat_body,
    collection=collection,
    bevel=0.0022,
)

body["circuitcube_type"] = "breadboard"
body["terminal_rows"] = TERMINAL_ROWS
body["power_rail_holes_per_rail"] = POWER_RAIL_HOLES
body["total_holes"] = TOTAL_HOLES

# Visual center trench
add_box(
    name="Center_Trench",
    location=(0, 0, TOP_Z + 0.00009),
    dimensions=(0.158, CHANNEL_WIDTH, 0.00020),
    material=mat_channel,
    collection=collection,
    bevel=0.00008,
)

# Printed power rail stripes
# Bottom side: blue outer, red inner
add_rail_stripe("RailStripe_Bottom_Blue", -0.0240, mat_blue, collection)
add_rail_stripe("RailStripe_Bottom_Red",  -0.0195, mat_red, collection)

# Top side: red inner, blue outer
add_rail_stripe("RailStripe_Top_Red",      0.0195, mat_red, collection)
add_rail_stripe("RailStripe_Top_Blue",     0.0240, mat_blue, collection)


# -----------------------------
# TERMINAL STRIP HOLES
# 63 rows x 10 holes = 630
#
# Left bank:  A B C D E
# Right bank: F G H I J
#
# A/J are outermost, E/F are nearest the center trench.
# -----------------------------
left_letters = ["A", "B", "C", "D", "E"]
right_letters = ["F", "G", "H", "I", "J"]

x_start = -((TERMINAL_ROWS - 1) * PITCH) / 2

# Y coordinates:
# E/F are near the center, A/J are farther out.
inner_y = CHANNEL_GAP / 2

left_y_positions = {
    letter: -(inner_y + (4 - i) * PITCH)
    for i, letter in enumerate(left_letters)
}

right_y_positions = {
    letter: +(inner_y + i * PITCH)
    for i, letter in enumerate(right_letters)
}

for row in range(1, TERMINAL_ROWS + 1):
    x = x_start + (row - 1) * PITCH

    # Left bank A-E share one electrical node per row.
    left_group = f"terminal_row_{row}_left"
    for letter in left_letters:
        hole_id = f"{letter}{row}"
        add_visual_hole(
            name=f"Hole_{hole_id}",
            x=x,
            y=left_y_positions[letter],
            material=mat_hole,
            collection=collection,
            hole_id=hole_id,
            node_group=left_group,
        )

    # Right bank F-J share one electrical node per row.
    right_group = f"terminal_row_{row}_right"
    for letter in right_letters:
        hole_id = f"{letter}{row}"
        add_visual_hole(
            name=f"Hole_{hole_id}",
            x=x,
            y=right_y_positions[letter],
            material=mat_hole,
            collection=collection,
            hole_id=hole_id,
            node_group=right_group,
        )


# -----------------------------
# POWER RAIL HOLES
# 4 rails x 50 holes = 200
# -----------------------------
rail_x_start = -((POWER_RAIL_HOLES - 1) * PITCH) / 2

rail_names = [
    ("Bottom_Negative", RAIL_Y[0], "NEG"),
    ("Bottom_Positive", RAIL_Y[1], "POS"),
    ("Top_Positive",    RAIL_Y[2], "POS"),
    ("Top_Negative",    RAIL_Y[3], "NEG"),
]

for rail_name, y, polarity in rail_names:
    for index in range(1, POWER_RAIL_HOLES + 1):
        x = rail_x_start + (index - 1) * PITCH
        hole_id = f"{rail_name}_{index}"

        # For this first prototype, each whole visual rail shares one node group.
        # Later we can split rails at the physical center break if desired.
        node_group = f"power_rail_{rail_name.lower()}"

        add_visual_hole(
            name=f"Hole_{hole_id}",
            x=x,
            y=y,
            material=mat_hole,
            collection=collection,
            hole_id=hole_id,
            node_group=node_group,
        )


# -----------------------------
# ROOT EMPTY
# -----------------------------
root = bpy.data.objects.new("Breadboard_Root", None)
root["circuitcube_type"] = "breadboard_root"
root["generator"] = "CircuitCube Blender Python v0.1"
collection.objects.link(root)

for obj in list(collection.objects):
    if obj != root and obj.parent is None:
        obj.parent = root


# -----------------------------
# VIEWPORT / SELECTION
# -----------------------------
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root

# Put the 3D cursor at the breadboard center.
scene.cursor.location = (0.0, 0.0, 0.0)

print("=" * 60)
print("CircuitCube breadboard generated.")
print(f"Terminal holes: {TERMINAL_ROWS * 10}")
print(f"Power rail holes: {POWER_RAIL_HOLES * 4}")
print(f"Total holes: {(TERMINAL_ROWS * 10) + (POWER_RAIL_HOLES * 4)}")
print("Collection: CircuitCube_Breadboard")
print("=" * 60)
