use std::collections::HashMap;
use std::fmt;
use std::process;
use serde_json;
use serde_yaml;
use quick_xml::de::from_str as xml_from_str;
use crate::rune_parser::parse_rune;

#[derive(Debug, Clone)]
pub struct RuneDocument {
    pub sections: Vec<Section>,
}

impl RuneDocument {
    /// Corrected from_json to handle the nested path structure created by to_json
    pub fn from_json(p0: &serde_json::Value) -> RuneDocument {
        let mut sections = Vec::new();

        fn json_to_ast_value(v: &serde_json::Value) -> Value {
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

        fn walk_json(current_val: &serde_json::Value, current_path: Vec<String>, sections: &mut Vec<Section>) {
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

                // If this level has data (kv, series, or records), it's a section
                if !kv.is_empty() || !series.is_empty() || !records.is_empty() {
                    sections.push(Section {
                        path: current_path.clone(),
                        kv,
                        series,
                        records,
                    });
                }

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

    pub(crate) fn from_xml(s: &str) -> Result<RuneDocument, String> {
        let json_val: serde_json::Value = xml_from_str(s)
            .map_err(|e| format!("XML parse error: {}", e))?;

        // Remove the root tag wrapper often created by quick-xml
        let processed = if let Some(obj) = json_val.as_object() {
            if obj.len() == 1 {
                obj.values().next().unwrap().clone()
            } else {
                json_val
            }
        } else {
            json_val
        };

        Ok(Self::from_json(&processed))
    }

    pub fn from_yaml(s: &str) -> Result<RuneDocument, String> {
        let yaml_val: serde_yaml::Value = serde_yaml::from_str(s)
            .map_err(|e| format!("YAML parse error: {}", e))?;

        let json_val = serde_json::to_value(yaml_val)
            .map_err(|e| format!("YAML to JSON conversion error: {}", e))?;

        Ok(Self::from_json(&json_val))
    }
}

impl RuneDocument {
    pub(crate) fn update_from(&mut self, p0: &RuneDocument) {
        self.sections = p0.sections.clone();
    }

    pub(crate) fn from_str(s: &str) -> Result<RuneDocument, String> {
        match parse_rune(s) {
            Ok(doc) => Ok(doc),
            Err(err) => {
                eprintln!("Error parsing Vectrune script: {}", err);
                process::exit(1);
            }
        }
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

            let mut current = &mut obj;
            for (i, part) in section.path.iter().enumerate() {
                if i == section.path.len() - 1 {
                    current.insert(part.clone(), serde_json::Value::Object(section_obj.clone()));
                } else {
                    current = current
                        .entry(part.clone())
                        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
                        .as_object_mut()
                        .unwrap();
                }
            }
        }

        serde_json::Value::Object(obj)
    }
}

#[derive(Debug, Clone)]
pub struct Section {
    pub path: Vec<String>,
    pub kv: HashMap<String, Value>,
    pub series: HashMap<String, Vec<Value>>,
    pub records: Vec<Record>,
}

#[derive(Debug, Clone)]
pub struct Record {
    pub kv: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
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

    pub fn as_map(&self) -> Option<HashMap<String, Value>> {
        if let Value::Map(map) = self {
            Some(map.clone())
        } else if let Value::List(list) = self {
            let mut map = HashMap::new();
            for (i, v) in list.iter().enumerate() {
                map.insert(i.to_string(), v.clone());
            }
            Some(map)
        } else {
            None
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        if let Value::Number(n) = self { Some(*n as u64) } else { None }
    }

    pub fn as_i64(&self) -> Option<i64> {
        if let Value::Number(n) = self { Some(*n as i64) } else { None }
    }

    pub fn as_str(&self) -> Option<&str> {
        if let Value::String(s) = self { Some(s) } else { None }
    }

    pub fn as_f64(&self) -> Option<f64> {
        if let Value::Number(n) = self { Some(*n) } else { None }
    }

    pub fn as_bool(&self) -> Option<bool> {
        if let Value::Bool(b) = self { Some(*b) } else { None }
    }

    pub fn as_list(&self) -> Option<&[Value]> {
        if let Value::List(list) = self { Some(list) } else { None }
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