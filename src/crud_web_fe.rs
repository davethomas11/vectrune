use crate::core::AppState;
use axum::response::Html;
use std::fmt::Write;

pub async fn create_web_fe_handler(app_state: AppState, title: String) -> Html<String> {
    let doc = &app_state.doc;
    let mut html = String::new();

    // Find CSS reference from the Rune document (look for @Frontend section with css or stylesheet key)
    let css_href = doc.sections.iter()
        .find(|s| s.path.first().map(|p| p.as_str()) == Some("Frontend"))
        .and_then(|s| s.kv.get("css").and_then(|v| v.as_str()))
        .map(|css| {
            if css.starts_with('/') {
                css.to_string()
            } else {
                format!("/assets/{}", css)
            }
        })
        .unwrap_or("https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css".to_string());
    writeln!(html, "<html><head><title>{}</title>", title).unwrap();
    writeln!(html, "<link rel=\"stylesheet\" href=\"{}\">\n", css_href).unwrap();
    writeln!(html, "</head><body>").unwrap();
    writeln!(html, "<h1>{}</h1>", title).unwrap();

    // Find all CRUD routes
    let mut crud_entities = Vec::new();
    for section in &doc.sections {
        if section.path.len() >= 2 && section.path[0] == "Route" && section.path[1] == "CRUD" {
            // Get schema name
            let schema_name = section.kv.get("schema").and_then(|v| v.as_str()).unwrap_or("");
            let entity = section.path.get(2).map(|s| s.as_str()).unwrap_or("Unknown");
            crud_entities.push(entity.to_lowercase());
            writeln!(html, "<h2>{}</h2>", entity).unwrap();

            // Find schema section
            let schema_section = doc.sections.iter().find(|s| s.path.len() == 2 && s.path[0] == "Schema" && s.path[1] == schema_name);
            if let Some(schema) = schema_section {
                // Table header
                let mut field_order: Vec<String> = Vec::new();
                writeln!(html, "<table id='{}_table' border=1><thead><tr>", entity.to_lowercase()).unwrap();
                writeln!(html, "<th>ID</th>").unwrap();
                for (field, _) in &schema.kv {
                    writeln!(html, "<th>{}</th>", field).unwrap();
                    field_order.push(field.clone());
                }
                writeln!(html, "<th>Actions</th></tr></thead><tbody></tbody></table>").unwrap();
                // Table body (empty, placeholder for JS or future server-side rendering)
                writeln!(html, "<tr><td colspan='{}'><em>Data loads here</em></td></tr>", schema.kv.len() + 2).unwrap();
                writeln!(html, "</table>").unwrap();

                // Create form
                writeln!(html, "<h3>Create New {}</h3>", entity).unwrap();
                writeln!(html, "<form onsubmit='return createRow(\"{}\", this)' method='POST' action='/{}'>", entity.to_lowercase(), entity.to_lowercase()).unwrap();
                for (field, typ) in &schema.kv {
                    let input_type = match typ.as_str().unwrap_or("") {
                        "string" => "text",
                        "number" => "number\" step=\"any",
                        "bool" => "checkbox",
                        _ => "text",
                    };
                    writeln!(html, "{}: <input name='{}' type='{}'/><br/>", field, field, input_type).unwrap();
                }
                writeln!(html, "<input type='submit' value='Create'/></form>").unwrap();
                // Output JS array for this entity's field order
                writeln!(html, "<script>window.{}_FIELDS = {};</script>", entity.to_lowercase(), serde_json::to_string(&field_order).unwrap()).unwrap();
                // Output JS object for this entity's field types
                let field_types: std::collections::HashMap<_, _> = schema.kv.iter().map(|(k, v)| (k, v.as_str().unwrap_or(""))).collect();
                writeln!(html, "<script>window.{}_FIELD_TYPES = {};</script>", entity.to_lowercase(), serde_json::to_string(&field_types).unwrap()).unwrap();
            }
        }
    }
    writeln!(html, r#"
<script>
function fetchTable(entity) {{
    fetch('/' + entity)
        .then(r => r.json())
        .then(rows => {{
            const table = document.getElementById(entity + '_table');
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = '';
            const fieldOrder = window[entity + '_FIELDS'] || [];
            for (const row of rows) {{
                let tr = document.createElement('tr');
                tr.innerHTML = `<td>${{row.id ?? ''}}</td>`;
                for (const key of fieldOrder) {{
                    tr.innerHTML += `<td>${{row[key] ?? ''}}</td>`;
                }}
                tr.innerHTML += `<td>
                    <button onclick=\"editRow('${{entity}}',${{row.id}})\">Edit</button>
                    <button onclick=\"deleteRow('${{entity}}',${{row.id}})\">Delete</button>
                </td>`;
                tbody.appendChild(tr);
            }}
        }});
}}
function createRow(entity, form) {{
    const data = {{}};
    var fieldTypes = window[entity.toLowerCase() + '_FIELD_TYPES'];
    if (!fieldTypes) fieldTypes = {{}};
    for (const el of form.elements) {{
        if (el.name) {{
            if (el.type === 'checkbox') {{
                data[el.name] = el.checked;
            }} else if (fieldTypes[el.name] === 'number') {{
                data[el.name] = el.value === '' ? null : Number(el.value);
            }} else {{
                data[el.name] = el.value;
            }}
        }}
    }}
    fetch('/' + entity, {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(data)
    }}).then(() => {{ fetchTable(entity); form.reset(); }});
    return false;
}}
function deleteRow(entity, id) {{
    fetch(`/${{entity}}/${{id}}`, {{ method: 'DELETE' }})
        .then(() => fetchTable(entity));
}}
function editRow(entity, id) {{
    fetch(`/${{entity}}/${{id}}`)
        .then(r => r.json())
        .then(row => {{
            const table = document.getElementById(entity + '_table');
            const tbody = table.querySelector('tbody');
            // Find the row to edit
            for (const tr of tbody.children) {{
                if (tr.firstChild && tr.firstChild.textContent == id) {{
                    // Replace cells with input fields for editing
                    const fieldOrder = window[entity + '_FIELDS'] || [];
                    const fieldTypes = window[entity.toLowerCase() + '_FIELD_TYPES'] || {{}};
                    let idx = 1;
                    for (const key of fieldOrder) {{
                        const td = tr.children[idx];
                        if (fieldTypes[key] === 'bool') {{
                            const checked = row[key] ? 'checked' : '';
                            td.innerHTML = `<input type='checkbox' name='${{key}}' ${{
checked}}/>`;
                        }} else {{
                            td.innerHTML = `<input value='${{row[key] ?? ''}}' name='${{key}}' />`;
                        }}
                        idx++;
                    }}
                    // Replace actions with Save/Cancel
                    const actionsTd = tr.lastChild;
                    actionsTd.innerHTML = `
                        <button onclick=\"saveEditRow('${{entity}}', ${{id}}, this)\">Save</button>
                        <button onclick=\"cancelEditRow('${{entity}}', ${{id}})\">Cancel</button>
                    `;
                    break;
                }}
            }}
        }});
}}
function saveEditRow(entity, id, btn) {{
    const tr = btn.closest('tr');
    const fieldOrder = window[entity + '_FIELDS'] || [];
    const fieldTypes = window[entity.toLowerCase() + '_FIELD_TYPES'] || {{}};
    let updates = {{}};
    let idx = 1;
    for (const key of fieldOrder) {{
        const input = tr.children[idx].querySelector('input');
        if (input) {{
            if (fieldTypes[key] === 'bool') {{
                updates[key] = input.checked;
            }} else if (fieldTypes[key] === 'number') {{
                updates[key] = input.value === '' ? null : Number(input.value);
            }} else {{
                updates[key] = input.value;
            }}
        }}
        idx++;
    }}
    fetch(`/${{entity}}/${{id}}`, {{
        method: 'PUT',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(updates)
    }}).then(() => fetchTable(entity));
}}
function cancelEditRow(entity, id) {{
    fetchTable(entity);
}}
document.addEventListener('DOMContentLoaded', function() {{
    for (const entity of window.CRUD_ENTITIES) fetchTable(entity);
}});
</script>
"#).unwrap();
    writeln!(html, r#"<script>window.CRUD_ENTITIES = {};</script>"#, serde_json::to_string(&crud_entities).unwrap()).unwrap();
    writeln!(html, "</body></html>").unwrap();
    Html(html)
}