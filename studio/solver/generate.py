"""Builder CP-SAT feasibility laboratory. Uses Google's real OR-Tools (Apache-2.0).
Narrow scope: axis-aligned rectangle, a single 2-bedroom unit with one daylit frontage.
A model is solved; no hand-arranged percentage rectangles. Not a certified floor plan.
"""
import json
import sys
import os
from ortools.sat.python import cp_model

STEP = .25

def solve(spec, order):
    width = round(spec["width"]/STEP)
    height = round(spec["depth"]/STEP)
    if width < 34 or height < 41:
        return dict(status="INFEASIBLE", reason="Insufficient frontage/depth for this residential program")
    model = cp_model.CpModel()
    front_depth, corridor_depth = 15, 5  # 3.75 m rooms; 1.25 m continuous access
    front = {}
    xints, yints = [], []
    limits = {"living":(13,26,17),"bedroom_1":(11,20,12),"bedroom_2":(11,20,12)}
    for name in order:
        low, high, target = limits[name]
        x = model.NewIntVar(0,width,"x_"+name)
        w = model.NewIntVar(low,min(high,width),"w_"+name)
        xe = model.NewIntVar(0,width,"xe_"+name)
        model.Add(xe==x+w)
        xints.append(model.NewIntervalVar(x,w,xe,"xint_"+name))
        yints.append(model.NewFixedSizeIntervalVar(0,front_depth,"yint_"+name))
        front[name]=(x,w)
    model.Add(front[order[0]][0]==0)
    for left,right in zip(order,order[1:]):
        model.Add(front[right][0]==front[left][0]+front[left][1])
    model.Add(front[order[-1]][0]+front[order[-1]][1]==width)
    # A real corridor strip separates facade rooms from rear service/core.
    rear_start=front_depth+corridor_depth
    rear={}
    for name,low,high,depth in [("core",13,17,18),("kitchen",10,16,12),("bath",7,12,9)]:
        x=model.NewIntVar(0,width,"x_"+name)
        w=model.NewIntVar(low,min(high,width),"w_"+name)
        xe=model.NewIntVar(0,width,"xe_"+name)
        model.Add(xe==x+w)
        xints.append(model.NewIntervalVar(x,w,xe,"xint_"+name))
        yints.append(model.NewFixedSizeIntervalVar(rear_start,depth,"yint_"+name))
        rear[name]=(x,w,depth)
    model.AddNoOverlap2D(xints,yints)
    # A shared wall between wet rooms, not merely an optimizer reward.
    bath_left=model.NewBoolVar("bath_left")
    model.Add(rear["bath"][0]+rear["bath"][1]==rear["kitchen"][0]).OnlyEnforceIf(bath_left)
    model.Add(rear["kitchen"][0]+rear["kitchen"][1]==rear["bath"][0]).OnlyEnforceIf(bath_left.Not())
    deviations=[]
    for name,(x,w) in front.items():
        d=model.NewIntVar(0,width,"dev_"+name)
        model.AddAbsEquality(d,w-limits[name][2]);deviations.append(d)
    # Preferred alignment of living/kitchen is a *soft*, not a legal requirement.
    kitchen_distance=model.NewIntVar(0,2*width,"living_kitchen_dx")
    model.AddAbsEquality(kitchen_distance,
        2*front["living"][0]+front["living"][1]-2*rear["kitchen"][0]-rear["kitchen"][1])
    model.Minimize(sum(deviations)*10+kitchen_distance*2)
    solver=cp_model.CpSolver()
    solver.parameters.max_time_in_seconds=10
    solver.parameters.num_search_workers=1
    result=solver.Solve(model)
    if result not in (cp_model.OPTIMAL,cp_model.FEASIBLE):
        return dict(status=solver.StatusName(result),reason="No valid arrangement found under current hard constraints")
    # Convert the local facade-based coordinate frame into absolute site units.
    ox,oy=spec["origin"]; ux,uy=spec["tangent"]; vx,vy=spec["inward"]
    names={"living":("پذیرایی","living"),"bedroom_1":("خواب ۱","bedroom"),
           "bedroom_2":("خواب ۲","bedroom"),"corridor":("راهرو","corridor"),
           "core":("پله و آسانسور","core"),"kitchen":("آشپزخانه","kitchen"),
           "bath":("سرویس","bath")}
    def room(name,x,y,w,h):
        corners=[(ox+(x+dx)*STEP*ux+(y+dy)*STEP*vx,
                  oy+(x+dx)*STEP*uy+(y+dy)*STEP*vy)
                 for dx,dy in ((0,0),(w,0),(w,h),(0,h))]
        xs=[p[0] for p in corners];ys=[p[1] for p in corners]
        label,typ=names[name]
        return dict(id=name,label=label,type=typ,x=round(min(xs),3),y=round(min(ys),3),
                    w=round(max(xs)-min(xs),3),h=round(max(ys)-min(ys),3))
    rooms=[]
    for name in order:
        x,w=front[name]
        rooms.append(room(name,solver.Value(x),0,solver.Value(w),front_depth))
    rooms.append(room("corridor",0,front_depth,width,corridor_depth))
    for name,(x,w,h) in rear.items():
        rooms.append(room(name,solver.Value(x),rear_start,solver.Value(w),h))
    result=dict(status=solver.StatusName(result),rooms=rooms,
        metrics=dict(objective=solver.ObjectiveValue(),width_m=width*STEP,depth_m=height*STEP,
                     unassigned_m2=round(width*height*STEP*STEP-sum(r["w"]*r["h"] for r in rooms),2)),
        hard_constraints=["no overlap","minimum dimensions","all three living/bedroom rooms touch exposed facade",
                          "all rooms touch real corridor band","kitchen/bath share wall","core has full depth"],
        not_checked=["real entrance and doors","actual window sizes and daylight","structure","parking",
                     "local building code","fire safety","plumbing","real stair/elevator geometry"])
    verify(result,spec)
    return result

def verify(result,spec):
    rooms=result["rooms"]
    for i,r in enumerate(rooms):
        assert r["w"]>0 and r["h"]>0
        for s in rooms[:i]:
            overlap=max(0,min(r["x"]+r["w"],s["x"]+s["w"])-max(r["x"],s["x"])) * max(0,min(r["y"]+r["h"],s["y"]+s["h"])-max(r["y"],s["y"]))
            assert overlap<0.001,(r["id"],s["id"],overlap)
    assert len(rooms)==7
    assert result["metrics"]["unassigned_m2"]>=-.1

def main():
    with open(sys.argv[1],encoding="utf8") as f: sites=json.load(f)
    os.makedirs(sys.argv[2],exist_ok=True)
    successful=0
    for site in sites:
        if "unsupported" in site:
            plans=[dict(status="UNSUPPORTED",reason=site["unsupported"])]
        else:
            orders=[("living","bedroom_1","bedroom_2"),("bedroom_1","living","bedroom_2"),("bedroom_1","bedroom_2","living")]
            plans=[dict(**solve(site,order),variant="-".join(order)) for order in orders]
        successful+=sum(p["status"] in ("FEASIBLE","OPTIMAL") for p in plans)
        payload=dict(schema_version="cp-sat-v1",site_id=site["id"],engine="Google OR-Tools CP-SAT",
                     solver_dependency_license="Apache-2.0",program="one 2-bedroom apartment",
                     site=site,candidates=plans)
        with open(os.path.join(sys.argv[2],site["id"]+".json"),"w",encoding="utf8") as f:
            json.dump(payload,f,ensure_ascii=False,indent=2)
        print(site["id"],[p["status"] for p in plans])
    assert successful>=2,"The real CP-SAT solver produced fewer than two valid candidates"
if __name__=="__main__":main()
