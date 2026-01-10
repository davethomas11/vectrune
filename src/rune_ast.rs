use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct RuneDocument {
    pub sections: Vec<Section>,
}

#[derive(Debug, Clone)]
pub struct Section {
    pub path: Vec<String>,                    // e.g. ["Route", "GET /health"]
    pub kv: HashMap<String, Value>,           // simple key/value
    pub series: HashMap<String, Vec<Value>>, // key: [items]
    pub records: Vec<Record>,                 // for + items
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
    pub fn as_map(&self) -> Option<HashMap<String, Value>> {
        if let Value::List(list) = self {
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
        if let Value::Number(n) = self {
            Some(*n as u64)
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

    pub fn as_f64(&self) -> Option<f64> {
        if let Value::Number(n) = self {
            Some(*n)
        } else {
            None
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        if let Value::Bool(b) = self {
            Some(*b)
        } else {
            None
        }
    }

    pub fn as_list(&self) -> Option<&[Value]> {
        if let Value::List(list) = self {
            Some(list)
        } else {
            None
        }
    }
}

impl RuneDocument {
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
                for item in items {
                    if let Value::Map(map) = item {
                        let mut record_obj = serde_json::Map::new();
                        for (k, v) in map {
                            record_obj.insert(k.clone(), v.to_json());
                        }
                        section_obj
                            .entry(key.clone())
                            .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                            .as_array_mut()
                            .unwrap()
                            .push(serde_json::Value::Object(record_obj));
                    }
                    if let Value::String(s) = item {
                        section_obj
                            .entry(key.clone())
                            .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                            .as_array_mut()
                            .unwrap()
                            .push(serde_json::Value::String(s.clone()));
                    }
                    if let Value::List(s) = item {
                        // Recursively convert nested lists to JSON arrays
                        section_obj
                            .entry(key.clone())
                            .or_insert_with(|| serde_json::Value::Array(Vec::new()))
                            .as_array_mut()
                            .unwrap()
                            .push(item.to_json());
                    }
                }
            }

            // Insert section_obj into nested structure based on path
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
}

impl PartialEq for Value {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Number(a), Value::Number(b)) => a == b,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::List(a), Value::List(b)) => a == b,
            _ => false,
        }
    }
}

impl Eq for Value {}

use std::fmt;

impl fmt::Display for RuneDocument {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for section in &self.sections {
            write!(f, "[")?;
            for (i, p) in section.path.iter().enumerate() {
                if i > 0 {
                    write!(f, "/")?;
                }
                write!(f, "{}", p)?;
            }
            writeln!(f, "]")?;

            for (key, value) in &section.kv {
                writeln!(f, "{} = {}", key, value)?;
            }

            for (key, items) in &section.series {
                writeln!(f, "{}:", key)?;
                for item in items {
                    writeln!(f, "  {}", item)?;
                }
            }

            for record in &section.records {
                writeln!(f, "+")?;
                for (key, value) in &record.kv {
                    writeln!(f, "  {} = {}", key, value)?;
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
            Value::String(s) => write!(f, "\"{}\"", s),
            Value::Number(n) => write!(f, "{}", n),
            Value::Bool(b) => write!(f, "{}", b),
            Value::List(list) => {
                write!(f, "[")?;
                for (i, v) in list.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", v)?;
                }
                write!(f, "]")
            }
            Value::Map(map) => {
                write!(f, "{{")?;
                for (i, (k, v)) in map.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}: {}", k, v)?;
                }
                write!(f, "}}")
            }
        }
    }
}
