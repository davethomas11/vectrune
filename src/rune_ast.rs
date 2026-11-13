use serde::{Deserialize, Serialize};
use serde_json;
use serde_yaml;
use std::collections::HashMap;
use std::fmt;

use crate::rune_parser::parse_rune;
use quick_xml::events::Event;
use quick_xml::Reader;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuneDocument {
    pub sections: Vec<Section>,
}

pub fn json_to_ast_value(v: &serde_json::Value) -> Value {
    match v {
        serde_json::Value::String(s) => Value::String(s.clone()),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Array(arr) => {
            Value::List(arr.iter().map(json_to_ast_value).collect())
        }
        serde_json::Value::Object(obj) => {
            let mut map = HashMap::new();
            for (k, v) in obj {
                map.insert(k.clone(), json_to_ast_value(v));
            }
            Value::Map(map)
        }
        serde_json::Value::Null => Value::String("".to_string()),
    }
}

impl RuneDocument {
    /// Corrected from_json to handle the nested path structure created by to_json
    pub fn from_json(p0: &serde_json::Value) -> RuneDocument {
        let mut sections = Vec::new();

        fn walk_json(
            current_val: &serde_json::Value,
            current_path: Vec<String>,
            sections: &mut Vec<Section>,
        ) {
            if let serde_json::Value::Object(map) = current_val {
                let mut kv = HashMap::new();
                let mut series = HashMap::new();
                let mut records = Vec::new();
                let mut sub_paths = Vec::new();

                for (key, value) in map {
                    match value {
                        // If it's a nested object, it's likely a sub-path (Section)
                        serde_json::Value::Object(_) if key != "record" => {
                            sub_paths.push((key.clone(), value));
                        }
                        // Handle the 'record' key specifically for Record types
                        serde_json::Value::Array(arr) if key == "record" => {
                            for item in arr {
                                if let serde_json::Value::Object(r_map) = item {
                                    let mut r_kv = HashMap::new();
                                    for (rk, rv) in r_map {
                                        r_kv.insert(rk.clone(), json_to_ast_value(rv));
                                    }
                                    records.push(Record { kv: r_kv });
                                }
                            }
                        }
                        // Arrays are series
                        serde_json::Value::Array(arr) => {
                            series.insert(key.clone(), arr.iter().map(json_to_ast_value).collect());
                        }
                        // Others are simple KV
                        _ => {
                            kv.insert(key.clone(), json_to_ast_value(value));
                        }
                    }
                }

                sections.push(Section {
                    path: current_path.clone(),
                    kv,
                    series,
                    records,
                    source_file: None,
                });

                // Recurse into sub-paths
                for (sub_key, sub_val) in sub_paths {
                    let mut next_path = current_path.clone();
                    next_path.push(sub_key);
                    walk_json(sub_val, next_path, sections);
                }
            }
        }

        walk_json(p0, Vec::new(), &mut sections);
        RuneDocument { sections }
    }

    pub fn from_xml(s: &str) -> Result<RuneDocument, String> {
        let mut reader = Reader::from_str(s);
        reader.config_mut().trim_text(false);
        let mut stack: Vec<XmlElement> = Vec::new();
        let mut root = None;

        loop {
            match reader
                .read_event()
                .map_err(|e| format!("XML parse error: {}", e))?
            {
                Event::Start(start) => {
                    stack.push(XmlElement::new(&start, reader.decoder())?);
                }
                Event::Empty(start) => {
                    let element = XmlElement::new(&start, reader.decoder())?;
                    append_xml_element(&mut stack, &mut root, element)?;
                }
                Event::Text(text) => {
                    let decoded = text
                        .decode()
                        .map_err(|e| format!("XML text decode error: {}", e))?;
                    let unescaped = quick_xml::escape::unescape(&decoded)
                        .map_err(|e| format!("XML text escape error: {}", e))?;
                    if let Some(element) = stack.last_mut() {
                        if !unescaped.trim().is_empty() {
                            element.text.push_str(&unescaped);
                        }
                    } else if !unescaped.trim().is_empty() {
                        return Err("XML parse error: text found outside the root element".into());
                    }
                }
                Event::GeneralRef(reference) => {
                    let name = reference
                        .decode()
                        .map_err(|e| format!("XML reference decode error: {}", e))?;
                    let value = decode_xml_reference(&name)?;
                    if let Some(element) = stack.last_mut() {
                        element.text.push_str(&value);
                    }
                }
                Event::CData(text) => {
                    let decoded = text
                        .decode()
                        .map_err(|e| format!("XML text decode error: {}", e))?;
                    if let Some(element) = stack.last_mut() {
                        element.text.push_str(&decoded);
                    }
                }
                Event::End(_) => {
                    let element = stack
                        .pop()
                        .ok_or_else(|| "XML parse error: unmatched closing element".to_string())?;
                    append_xml_element(&mut stack, &mut root, element)?;
                }
                Event::Eof => break,
                _ => {}
            }
        }

        if !stack.is_empty() {
            return Err("XML parse error: unclosed element".to_string());
        }
        let value = root
            .ok_or_else(|| "XML parse error: document has no root element".to_string())?
            .into_value();
        Ok(Self::from_json(&value))
    }

    pub fn from_yaml(s: &str) -> Result<RuneDocument, String> {
        let yaml_val: serde_yaml::Value =
            serde_yaml::from_str(s).map_err(|e| format!("YAML parse error: {}", e))?;

        let json_val = serde_json::to_value(yaml_val)
            .map_err(|e| format!("YAML to JSON conversion error: {}", e))?;

        Ok(Self::from_json(&json_val))
    }
}

fn decode_xml_reference(name: &str) -> Result<String, String> {
    let character = match name {
        "amp" => '&',
        "lt" => '<',
        "gt" => '>',
        "apos" => '\'',
        "quot" => '"',
        _ if name.starts_with("#x") => {
            let codepoint = u32::from_str_radix(&name[2..], 16)
                .map_err(|e| format!("Invalid XML character reference '{}': {}", name, e))?;
            char::from_u32(codepoint)
                .ok_or_else(|| format!("Invalid XML character reference '{}'", name))?
        }
        _ if name.starts_with('#') => {
            let codepoint = name[1..]
                .parse::<u32>()
                .map_err(|e| format!("Invalid XML character reference '{}': {}", name, e))?;
            char::from_u32(codepoint)
                .ok_or_else(|| format!("Invalid XML character reference '{}'", name))?
        }
        _ => return Err(format!("Unsupported XML entity reference '&{};'", name)),
    };
    Ok(character.to_string())
}

struct XmlElement {
    name: String,
    attributes: serde_json::Map<String, serde_json::Value>,
    children: serde_json::Map<String, serde_json::Value>,
    text: String,
}

impl XmlElement {
    fn new(
        element: &quick_xml::events::BytesStart<'_>,
        decoder: quick_xml::encoding::Decoder,
    ) -> Result<Self, String> {
        let name = decoder
            .decode(element.name().as_ref())
            .map_err(|e| format!("XML element name decode error: {}", e))?
            .into_owned();
        let mut attributes = serde_json::Map::new();
        for attribute in element.attributes() {
            let attribute = attribute.map_err(|e| format!("XML attribute parse error: {}", e))?;
            let key = decoder
                .decode(attribute.key.as_ref())
                .map_err(|e| format!("XML attribute name decode error: {}", e))?
                .into_owned();
            let value = attribute
                .decode_and_unescape_value(decoder)
                .map_err(|e| format!("XML attribute value decode error: {}", e))?;
            attributes.insert(
                format!("@{}", key),
                serde_json::Value::String(value.into_owned()),
            );
        }
        Ok(Self {
            name,
            attributes,
            children: serde_json::Map::new(),
            text: String::new(),
        })
    }

    fn into_value(self) -> serde_json::Value {
        if self.children.is_empty() && self.attributes.is_empty() {
            if self.text.is_empty() {
                serde_json::Value::Null
            } else {
                serde_json::Value::String(self.text)
            }
        } else {
            let mut object = self.attributes;
            if !self.text.is_empty() {
                object.insert("$text".to_string(), serde_json::Value::String(self.text));
            }
            object.extend(self.children);
            serde_json::Value::Object(object)
        }
    }
}

fn append_xml_element(
    stack: &mut Vec<XmlElement>,
    root: &mut Option<XmlElement>,
    element: XmlElement,
) -> Result<(), String> {
    if let Some(parent) = stack.last_mut() {
        let name = element.name.clone();
        let value = element.into_value();
        match parent.children.entry(name) {
            serde_json::map::Entry::Vacant(entry) => {
                entry.insert(value);
            }
            serde_json::map::Entry::Occupied(mut entry) => {
                let existing = entry.get_mut();
                if let Some(values) = existing.as_array_mut() {
                    values.push(value);
                } else {
                    let previous = std::mem::replace(existing, serde_json::Value::Null);
                    *existing = serde_json::Value::Array(vec![previous, value]);
                }
            }
        }
    } else if root.is_some() {
        return Err("XML parse error: multiple root elements".to_string());
    } else {
        *root = Some(element);
    }
    Ok(())
}

impl RuneDocument {
    pub fn update_from(&mut self, p0: &RuneDocument) {
        self.sections = p0.sections.clone();
    }

    pub fn merge(&mut self, other: RuneDocument) {
        for other_section in other.sections {
            if let Some(existing_section) = self
                .sections
                .iter_mut()
                .find(|s| s.path == other_section.path)
            {
                // Merge kv
                for (k, v) in other_section.kv {
                    existing_section.kv.insert(k, v);
                }
                // Merge series
                for (k, mut v) in other_section.series {
                    let existing_v = existing_section.series.entry(k).or_insert_with(Vec::new);
                    existing_v.append(&mut v);
                }
                // Merge records
                existing_section.records.extend(other_section.records);
            } else {
                self.sections.push(other_section);
            }
        }
    }

    pub(crate) fn from_str(s: &str) -> Result<RuneDocument, String> {
        parse_rune(s).map_err(|err| {
            format!("Error parsing Vectrune script: {}", err)
        })
    }

    pub fn get_section(&self, name: &str) -> Option<&Section> {
        self.sections
            .iter()
            .find(|section| section.path.iter().any(|p| p == name))
    }

    pub fn get_sections(&self, name: &str) -> Vec<&Section> {
        self.sections
            .iter()
            .filter(|section| section.path.iter().any(|p| p == name))
            .collect()
    }

    pub fn to_json(&self) -> serde_json::Value {
        let mut obj = serde_json::Map::new();

        for section in &self.sections {
            let mut section_obj = serde_json::Map::new();
            for (key, value) in &section.kv {
                section_obj.insert(key.clone(), value.to_json());
            }
            if !section.records.is_empty() {
                let mut records_array = Vec::new();
                for record in &section.records {
                    let mut record_obj = serde_json::Map::new();
                    for (k, v) in &record.kv {
                        record_obj.insert(k.clone(), v.to_json());
                    }
                    records_array.push(serde_json::Value::Object(record_obj));
                }
                section_obj.insert(
                    "record".to_string(),
                    serde_json::Value::Array(records_array),
                );
            }
            for (key, items) in &section.series {
                let mut json_items = Vec::new();
                for item in items {
                    json_items.push(item.to_json());
                }
                section_obj.insert(key.clone(), serde_json::Value::Array(json_items));
            }

            insert_json_section(&mut obj, &section.path, section_obj);
        }

        serde_json::Value::Object(obj)
    }
}

fn insert_json_section(
    target: &mut serde_json::Map<String, serde_json::Value>,
    path: &[String],
    value: serde_json::Map<String, serde_json::Value>,
) {
    let Some((head, tail)) = path.split_first() else {
        merge_json_objects(target, value);
        return;
    };

    let entry = target
        .entry(head.clone())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
    if tail.is_empty() {
        if let Some(existing) = entry.as_object_mut() {
            merge_json_objects(existing, value);
        } else {
            *entry = serde_json::Value::Object(value);
        }
    } else {
        if !entry.is_object() {
            *entry = serde_json::Value::Object(serde_json::Map::new());
        }
        if let Some(child) = entry.as_object_mut() {
            insert_json_section(child, tail, value);
        }
    }
}

fn merge_json_objects(
    target: &mut serde_json::Map<String, serde_json::Value>,
    source: serde_json::Map<String, serde_json::Value>,
) {
    for (key, value) in source {
        match (target.get_mut(&key), value) {
            (Some(serde_json::Value::Object(existing)), serde_json::Value::Object(incoming)) => {
                merge_json_objects(existing, incoming);
            }
            (slot, value) => {
                if let Some(slot) = slot {
                    *slot = value;
                } else {
                    target.insert(key, value);
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub path: Vec<String>,
    pub kv: HashMap<String, Value>,
    pub series: HashMap<String, Vec<Value>>,
    pub records: Vec<Record>,
    #[serde(skip)]
    pub source_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub kv: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    String(String),
    Number(f64),
    Bool(bool),
    List(Vec<Value>),
    Map(HashMap<String, Value>),
}

impl Value {
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            Value::String(s) => serde_json::Value::String(s.clone()),
            Value::Number(n) => serde_json::Value::Number(
                serde_json::Number::from_f64(*n).unwrap_or(serde_json::Number::from(0)),
            ),
            Value::Bool(b) => serde_json::Value::Bool(*b),
            Value::List(list) => {
                let json_list: Vec<serde_json::Value> = list.iter().map(|v| v.to_json()).collect();
                serde_json::Value::Array(json_list)
            }
            Value::Map(map) => {
                let mut json_map = serde_json::Map::new();
                for (k, v) in map {
                    json_map.insert(k.clone(), v.to_json());
                }
                serde_json::Value::Object(json_map)
            }
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        if let Value::Number(n) = self {
            Some(*n as u64)
        } else {
            None
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        if let Value::Number(n) = self {
            Some(*n as i64)
        } else {
            None
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        if let Value::String(s) = self {
            Some(s)
        } else {
            None
        }
    }
}

impl PartialEq for Value {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Number(a), Value::Number(b)) => a == b,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::List(a), Value::List(b)) => a == b,
            (Value::Map(a), Value::Map(b)) => a == b,
            _ => false,
        }
    }
}

impl Eq for Value {}

impl fmt::Display for RuneDocument {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#!RUNE\n")?;
        for section in &self.sections {
            // Sections begin with @
            write!(f, "@")?;
            for (i, p) in section.path.iter().enumerate() {
                if i > 0 {
                    write!(f, "/")?; // Hierarchical paths use /
                }
                write!(f, "{}", p)?;
            }
            writeln!(f)?;

            // Key/Value Assignments
            for (key, value) in &section.kv {
                writeln!(f, "{} = {}", key, value)?;
            }

            // Series Lists (e.g., run:)
            for (key, items) in &section.series {
                writeln!(f, "{}:", key)?;
                for item in items {
                    writeln!(f, "    {}", item)?; // Indented items
                }
            }

            // Record Lists (+ host = ...)
            for record in &section.records {
                let mut first = true;
                for (key, value) in &record.kv {
                    if first {
                        write!(f, "+ ")?; // Record items start with +
                        first = false;
                    } else {
                        write!(f, "  ")?; // Subsequent lines in a record are indented
                    }
                    writeln!(f, "{} = {}", key, value)?;
                }
            }
            writeln!(f)?;
        }
        Ok(())
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::String(s) => {
                // Check if it contains spaces or special chars to determine if quotes are needed
                if s.contains(' ') || s.is_empty() {
                    write!(f, "\"{}\"", s)
                } else {
                    write!(f, "{}", s)
                }
            }
            Value::Number(n) => write!(f, "{}", n),
            Value::Bool(b) => write!(f, "{}", b),
            Value::List(list) => {
                // Inline lists use parentheses () and space separation
                write!(f, "(")?;
                for (i, v) in list.iter().enumerate() {
                    if i > 0 {
                        write!(f, " ")?;
                    }
                    write!(f, "{}", v)?;
                }
                write!(f, ")")
            }
            Value::Map(map) => {
                // Maps aren't explicitly defined for inline use in the RFC,
                // but we keep a compact JSON-like format for internal values.
                write!(f, "{{")?;
                for (i, (k, v)) in map.iter().enumerate() {
                    if i > 0 {
                        write!(f, " ")?;
                    }
                    write!(f, "{}:{}", k, v)?;
                }
                write!(f, "}}")
            }
        }
    }
}
