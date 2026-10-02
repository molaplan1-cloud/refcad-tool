# RefCAD and a SupaCAD-style workflow

SupaCAD (supacad.com, earlier supaload.com) is a third-party product. This note uses only its public feature list as a checklist. Nothing here is copied from that product: wording, calculations, and drawings in RefCAD are original.

The comparison is against RefCAD as it stood before this change: a Finnish cold-room app with a public canvas (`app/page.jsx`) and a saved-project canvas (`app/projects/[id]/DesignerClient.jsx`). Both could drop rectangular rooms, show a simplified heat total, place equipment, switch a 2D plan and an isometric view, and export a text PDF. Projects and the demo login still save in the browser.

## Before this change

| Capability | What RefCAD already did | Gap |
| --- | --- | --- |
| Draw and resize, live update | Rooms were added from a type button or a wizard at a fixed size. The project canvas had corner handles, but every room was drawn at the origin, so positions and sizes did not read as a layout. Dimensions did not drive a full recalculation of each room. | No sketch-style drawing. SI/IP was millimetres, centimetres, and metres, not feet and Fahrenheit. |
| Partitions | Extra rooms were separate boxes. Collision rules kept them apart, so a room inside a room was not a supported model. | No auto labels, no detected internal clear size. |
| Non-rectangular footprint | Rectangles only. | No polygon tool. |
| Heat load | One project total: transmission, a flat lighting and people allowance, and on the public canvas a partial product and door term. The project canvas left infiltration and product at zero. Evaporator cooling capacity was treated as a heat gain. | Not per room, not editable, and not auditable line by line. No slab pull-down or safety factor as inputs. |
| Doors and evaporators | A small catalogue could be dropped into a room. Doors tried to snap to a wall on the public canvas. | Templates were not a placement mode on a real plan, and the 3D view did not use room position. |
| Discovery sizing | Product rows existed in code. The screen did not turn kg/day, SKU count, and pack height into racking and ceiling height. | Missing. |
| 2D and 3D | Both views existed, as SVG. | They did not share a positioned model, so a multi-room plan was not trustworthy. |
| PDF | A dark cover and a wattage breakdown. | No scaled plan and no isometric page. |
| DXF | None. | Missing. |
| Share link | None. Auth is a single demo user. Projects live in `localStorage`, with an unused server API beside them. | Missing. |
| Enquiry to proposal | Possible only by clicking through the wizard and reading one total. | Not a few-minute layout. |

## Done in this change

The public page and the project page now use one designer. An old browser save still opens: rooms are kept, and missing load inputs are filled with defaults. Project create, rename, delete, and auto-save are unchanged. Logout is still on the project canvas.

| Capability | Status |
| --- | --- |
| Draw and resize, live update | **Done.** Drag a rectangle, or drag an edge or corner. The opposite corner stays put. External dimensions, internal clear size, and the heat load update while the pointer moves. SI (m, °C, W) and IP (ft-in on the plan, °F, BTU/h) switch without converting the stored model. |
| Partitions | **Done** for rectangles. The Väliseinä tool draws inside a room, assigns the next label (`J1`, `P1`, `S1`, `B1`, `T1`), and shows internal size as external size minus the panels. A full-height partition that sits on the outer shell takes that strip of envelope; heat that crosses the internal face is added to the colder room and subtracted from the parent. |
| Polygon footprints | **Done** for orthogonal rooms. The Monikulmio tool places straight wall segments, so an L-shape or a jog is a closed outline rather than a bounding box. Floor area, wall length, the plan, the 3D shell, and the DXF follow that outline. Curves and non-orthogonal edges are not in the tool. |
| Drawing surface | **Done.** Paper canvas, major and minor grid, scale bar, zoom-to-cursor, trackpad pan, middle-mouse and space-drag pan, snap to grid, endpoints, midpoints and walls, live dimensions, typed sizes while drawing, marquee multi-select, undo and redo, and fit-to-view. |
| Heat load | **Done**, per room, with every line written as a formula. Transmission `U·A·ΔT` on internal surfaces, product sensible load, respiration, door air, optional air changes, people, lighting, evaporator fan heat, other equipment, slab pull-down, then a safety factor. The method is in `lib/heatLoad.js`. |
| Door and evaporator templates | **Done.** Pick a template and click the room. Doors snap to the nearest wall. Evaporators stay inside and hang from the ceiling in 3D. Condensers, condensing units, and a rack template are still placeable. |
| 2D and 3D | **Done.** The plan shows panel thickness, door swings, and evaporator airflow. The 3D view is a lit model with orbit controls: panel shells, floors, translucent ceilings, doors, and evaporators. |
| PDF | **Done.** Cover, scaled plan, isometric line drawing, per-room breakdown, and a door and equipment schedule. |
| DXF | **Done.** R12 ASCII, 1 unit = 1 mm. Layers `WALLS`, `PARTITIONS`, `DOORS`, `EVAPORATORS`, `EQUIPMENT`, `DIMS`, `TEXT`, `TITLE`, `SCHEDULE`, plus a title block and a schedule. |
| Worked example | **Done.** “Esimerkki 8×12×6” builds a 12 m × 8 m × 6 m vegetable chiller with a corner freezer, a door, and an evaporator in each room. |

## Still open

These are not started. They are larger than a coherent slice of the drawing and load workflow, and a half-built version would be worse than a clear list.

1. **Discovery sizing.** Daily kilograms are an input to the product load. SKU count and pack height do not yet produce storage capacity, a rack layout, or a suggested ceiling height, and racks are not checked against aisles.
2. **View-only share link.** There is no tokenised read-only URL. Projects are still per browser. The server project API is not what the designer saves to, and login is the demo user in `lib/auth.js`.
3. **Finer equipment and export fit.** No manufacturer catalogue, no door-swing clearance check, and no imperial U-values (U stays in W/m²K). The PDF isometric is still a line drawing. Non-orthogonal walls (angled jogs that are not horizontal or vertical) are not supported.

## Where the numbers come from

Stored geometry is metres and degrees Celsius. Internal width and depth are the external size minus two wall panels. Internal height subtracts the ceiling and floor panels. Areas in the load are those internal surfaces. A shared wall uses the lower U-value of the two rooms and the overlap of the internal faces. Door air is `openings × seconds × opening area × velocity`, then `V · ρ · cp · ΔT / 24 h` with ρ = 1.2 kg/m³ and cp = 1005 J/kg·K. Product heat is `m · cp · ΔT / 24 h` with cp in kJ/kg·K. Slab pull-down is the average power to cool the floor mass over the chosen hours. The safety factor multiplies the room net, including credits, so two rooms with the same factor still cancel an internal transfer. Condenser heat is left outside the room. This is a checkable estimate for a proposal, not a substitute for a signed calculation.
