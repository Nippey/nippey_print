import frappe

def execute():
    def param(key,label,kind,default=None,geometry=0,choices=None,unit=None):
        return dict(parameter_key=key,parameter_label=label,parameter_type=kind,
            default_value=default,geometry_affecting=geometry,choices=choices,unit=unit,required_value=1)
    common=[
        param("light_position","Lichtposition","Select","V",1,"V\nH\nD"),
        param("overhang","Überstand","Decimal","17",1,unit="mm"),
        param("hole_position","Bohrposition","Decimal","0",1,unit="mm"),
        param("housing_colour","ASA-Farbe","Text","RAL 7016"),
        param("warm_filter","Warmweißfilter","Check","1")
    ]
    for key,title,params,description in [
        ("fence-light-standard","Zaunleuchte Standard",common,"Pfosten 60 × 40 mm (fest)"),
        ("fence-light-special","Zaunleuchte Sonderanfertigung",[
            param("post_width","Pfostenbreite","Decimal","60",1,unit="mm"),
            param("post_depth","Pfostentiefe","Decimal","40",1,unit="mm"),
            param("outer_contour","Außenkontur","Select","Bounding Box",1,"Bounding Box\nGummiband\nKonkav\nKonvex"),
            param("led_x","LED-Mittelpunkt X","Decimal","0",1,unit="mm"),
            param("led_y","LED-Mittelpunkt Y","Decimal",None,1,unit="mm"),
            param("manual_construction","Manuelle Sonderkonstruktion","Check","0",1),
            dict(param("construction_notes","Konstruktionshinweise","Text",geometry=1),required_value=0),
            *common[-2:]],
            "Individuelle Pfostenabmessungen; Abdeckung und Folie prüfen")
    ]:
        existing=frappe.db.get_value("Print Product",{"visualizer_key":key},"name")
        if existing and key=="fence-light-special" and not frappe.db.exists("Print Configuration",{"product":existing}):
            d=frappe.get_doc("Print Product",existing)
            if "outer_contour" not in [r.parameter_key for r in d.parameters]:
                d.set("parameters",params)
                d.description=description
                d.save()
        if not existing:
            frappe.get_doc(dict(doctype="Print Product",product_name=title,visualizer_key=key,
                description=description,parameters=params)).insert()
