app_name = "nippey_print"
app_title = "Nippey Print"
app_publisher = "Nippey"
app_description = "3D printing management for ERPNext"
app_email = "opensource@nippey.de"
app_license = "GPL-3.0"
required_apps = ["erpnext"]

after_install = ["nippey_print.label_presets.execute", "nippey_print.setup_consumption.execute", "nippey_print.product_presets.execute"]
after_migrate = ["nippey_print.label_presets.execute", "nippey_print.setup_consumption.execute", "nippey_print.product_presets.execute"]


add_to_apps_screen = [{
    "name": "nippey_print", "logo": "/assets/nippey_print/nippey-print.svg",
    "title": "nippey.print", "route": "/nippey-print-home",
    "has_permission": "nippey_print.setup_consumption.can_open"
}]
