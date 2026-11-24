async function show_configuration_name(frm) {
    const configuration = frm.doc.configuration;
    const revision = frm.doc.name;
    frm.set_df_property("configuration", "description", "");
    if (!configuration) return;

    const { message } = await frappe.db.get_value(
        "Print Configuration", configuration, "configuration_name"
    );
    if (frm.doc.name !== revision || frm.doc.configuration !== configuration) return;

    const name = message?.configuration_name;
    if (name) {
        frm.set_df_property(
            "configuration", "description",
            __("Configuration Name") + ": " + frappe.utils.escape_html(name)
        );
    }
}

frappe.ui.form.on("Print Model Revision", {
    refresh: show_configuration_name,
    configuration: show_configuration_name,
});
