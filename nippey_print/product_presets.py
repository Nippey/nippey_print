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
            param("post_depth","Pfostentiefe","Decimal","40",1,unit="mm"),*common],
            "Individuelle Pfostenabmessungen; Abdeckung und Folie prüfen")
    ]:
        if not frappe.db.exists("Print Product",{"visualizer_key":key}):
            frappe.get_doc(dict(doctype="Print Product",product_name=title,visualizer_key=key,
                description=description,parameters=params)).insert()
