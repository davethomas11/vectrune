use crate::core::{execute_steps, AppState};
use crate::rune_ast::Value as RuneValue;
use crate::util::{log, LogLevel};
use async_graphql::dynamic::{
    Field, FieldFuture, FieldValue, InputValue, Object, Scalar, Schema, TypeRef,
};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{response::IntoResponse, routing::get, Router};
use std::collections::HashMap;

pub async fn build_graphql_router(state: AppState, verbose: bool) -> Router {
    // Memory initialization moved to core::initialize_memory_from_doc
    crate::core::initialize_memory_from_doc(&state.doc);

    // 2. Build Schema
    let mut query_object = Object::new("Query");
    let mut mutation_object = Object::new("Mutation");
    let mut mutation_has_fields = false;

    // Pre-calculate schemas for easy access
    let schemas = state.schemas.clone();

    // Helper to map Rune Schema to GraphQL Type
    fn map_type(rune_type: &str) -> TypeRef {
        match rune_type {
            "number" => TypeRef::named_nn(TypeRef::FLOAT),
            "string" => TypeRef::named_nn(TypeRef::STRING),
            "bool" => TypeRef::named_nn(TypeRef::BOOLEAN),
            _ => TypeRef::named_nn(rune_type),
        }
    }

    mutation_has_fields = state.doc.sections.iter().any(|s| {
        s.path.len() >= 2 && &s.path[0..2] == vec!["GraphQL", "Mutation"] && !s.series.is_empty()
    });

    let mut schema_builder = if mutation_has_fields {
        Schema::build("Query", Some("Mutation"), None)
    } else {
        Schema::build("Query", None, None)
    };

    // Register all schemas as GraphQL Objects
    for (name, section) in schemas.iter() {
        let mut obj = Object::new(name);
        for (field_name, field_type) in &section.kv {
            let type_name = field_type.as_str().unwrap_or("string").to_string();
            obj = obj.field(Field::new(field_name, map_type(&type_name), |ctx| {
                FieldFuture::new(async move {
                    let parent = ctx.parent_value.as_value().unwrap();
                    let field_name = ctx.field().name();
                    let val = match parent {
                        async_graphql::Value::Object(map) => map
                            .get(field_name)
                            .cloned()
                            .unwrap_or(async_graphql::Value::Null),
                        _ => async_graphql::Value::Null,
                    };
                    Ok(Some(FieldValue::from(val)))
                })
            }));
        }
        schema_builder = schema_builder.register(obj);
    }

    // Register Queries
    for query_section in state
        .doc
        .sections
        .iter()
        .filter(|s| s.path.len() >= 2 && &s.path[0..2] == vec!["GraphQL", "Query"])
    {
        for (field_name, field_value) in &query_section.series {
            let mut name = field_name.clone();
            let mut arg_defs = Vec::new();
            if let Some(pos) = field_name.find('(') {
                name = field_name[..pos].trim().to_string();
                let args_str = &field_name[pos + 1..field_name.len() - 1];
                for arg_part in args_str.split(',') {
                    let parts: Vec<&str> = arg_part.split(':').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        arg_defs.push((parts[0].to_string(), parts[1].to_string()));
                    }
                }
            }

            // Infer return type
            let return_type = if query_section.path.len() > 2 {
                TypeRef::named_nn(query_section.path[2].clone())
            } else if name.ends_with('s') {
                // Plural: treat as list, auto uppercase first char
                let singular = name.trim_end_matches('s');
                let type_name = format!("{}{}", singular[..1].to_uppercase(), &singular[1..]);
                TypeRef::named_nn_list_nn(&type_name)
            } else {
                let type_name = format!("{}{}", name[..1].to_uppercase(), &name[1..]);
                TypeRef::named_nn(&type_name)
            };

            let steps = field_value.clone();
            let state_clone = state.clone();
            let arg_defs_clone = arg_defs.clone();

            let mut field = Field::new(name, return_type, move |ctx| {
                let steps = steps.clone();
                let state_clone = state_clone.clone();
                let arg_defs = arg_defs_clone.clone();
                FieldFuture::new(async move {
                    let mut path_params = HashMap::new();
                    for (arg_name, _arg_type) in &arg_defs {
                        if let Some(val) = ctx.args.get(arg_name) {
                            let v = val.as_value();
                            let s = match v {
                                async_graphql::Value::String(s) => s.clone(),
                                _ => v.to_string().trim_matches('"').to_string(),
                            };
                            log(
                                LogLevel::Debug,
                                &format!("GraphQL Arg (Query): {} = {}", arg_name, s),
                            );
                            path_params.insert(arg_name.clone(), s);
                        }
                    }

                    log(
                        LogLevel::Debug,
                        &format!("Executing GraphQL Query steps: {:?}", steps),
                    );
                    let (_code, resp) =
                        execute_steps(state_clone, steps, None, Some(path_params), true).await;
                    log(LogLevel::Debug, &format!("GraphQL Query Resp: {}", resp));
                    let json_res: serde_json::Value =
                        serde_json::from_str(&resp).unwrap_or(serde_json::Value::String(resp));
                    let gql_val = async_graphql::Value::from_json(json_res)
                        .unwrap_or(async_graphql::Value::Null);
                    Ok(Some(FieldValue::from(gql_val)))
                })
            });

            for (arg_name, arg_type) in &arg_defs {
                field = field.argument(InputValue::new(arg_name, map_type(arg_type)));
            }

            query_object = query_object.field(field);
        }
    }

    // Register Mutations
    for mutation_section in state
        .doc
        .sections
        .iter()
        .filter(|s| s.path.len() >= 2 && &s.path[0..2] == vec!["GraphQL", "Mutation"])
    {
        for (field_name, field_value) in &mutation_section.series {
            let mut name = field_name.clone();
            let mut arg_defs = Vec::new();
            if let Some(pos) = field_name.find('(') {
                name = field_name[..pos].trim().to_string();
                let args_str = &field_name[pos + 1..field_name.len() - 1];
                for arg_part in args_str.split(',') {
                    let parts: Vec<&str> = arg_part.split(':').map(|s| s.trim()).collect();
                    if parts.len() == 2 {
                        arg_defs.push((parts[0].to_string(), parts[1].to_string()));
                    }
                }
            }

            // Infer return type
            let return_type = if mutation_section.path.len() > 2 {
                TypeRef::named_nn(mutation_section.path[2].clone())
            } else {
                TypeRef::named_nn("JSON")
            };

            let steps = field_value.clone();
            let state_clone = state.clone();
            let arg_defs_clone = arg_defs.clone();

            let mut field = Field::new(name, return_type, move |ctx| {
                let steps = steps.clone();
                let state_clone = state_clone.clone();
                let arg_defs = arg_defs_clone.clone();
                FieldFuture::new(async move {
                    let mut path_params = HashMap::new();
                    for (arg_name, _arg_type) in &arg_defs {
                        if let Some(val) = ctx.args.get(arg_name) {
                            let v = val.as_value();
                            let s = match v {
                                async_graphql::Value::String(s) => s.clone(),
                                _ => v.to_string().trim_matches('"').to_string(),
                            };
                            log(
                                LogLevel::Debug,
                                &format!("GraphQL Arg (Mutation): {} = {}", arg_name, s),
                            );
                            path_params.insert(arg_name.clone(), s);
                        }
                    }

                    log(
                        LogLevel::Debug,
                        &format!("Executing GraphQL Mutation steps: {:?}", steps),
                    );
                    let (_code, resp) =
                        execute_steps(state_clone, steps, None, Some(path_params), true).await;
                    log(LogLevel::Debug, &format!("GraphQL Mutation Resp: {}", resp));
                    let json_res: serde_json::Value =
                        serde_json::from_str(&resp).unwrap_or(serde_json::Value::String(resp));
                    let gql_val = async_graphql::Value::from_json(json_res)
                        .unwrap_or(async_graphql::Value::Null);
                    Ok(Some(FieldValue::from(gql_val)))
                })
            });

            for (arg_name, arg_type) in &arg_defs {
                field = field.argument(InputValue::new(arg_name, map_type(arg_type)));
            }

            mutation_object = mutation_object.field(field);
        }
    }

    // Add health and execute to query for backward compatibility
    query_object = query_object.field(Field::new(
        "health",
        TypeRef::named_nn(TypeRef::STRING),
        |_| FieldFuture::new(async { Ok(Some(FieldValue::value("OK"))) }),
    ));

    let state_clone = state.clone();
    query_object = query_object.field(
        Field::new("execute", TypeRef::named_nn(TypeRef::STRING), move |ctx| {
            let state = state_clone.clone();
            FieldFuture::new(async move {
                let steps: Vec<RuneValue> = if let Some(steps_accessor) = ctx.args.get("steps") {
                    let steps_val = steps_accessor.list()?;
                    steps_val
                        .iter()
                        .map(|v| RuneValue::String(v.string().unwrap_or("").to_string()))
                        .collect()
                } else {
                    Vec::new()
                };
                let (_code, resp) = execute_steps(state, steps, None, None, true).await;
                Ok(Some(FieldValue::value(resp)))
            })
        })
        .argument(InputValue::new(
            "steps",
            TypeRef::named_nn_list_nn(TypeRef::STRING),
        )),
    );

    // Build schema only once, after all objects are registered
    let schema = if mutation_has_fields {
        schema_builder
            .register(query_object)
            .register(mutation_object)
            .register(Scalar::new("JSON"))
            .finish()
            .map_err(|e| e.to_string())
            .unwrap()
    } else {
        schema_builder
            .register(query_object)
            .register(Scalar::new("JSON"))
            .finish()
            .map_err(|e| e.to_string())
            .unwrap()
    };

    let graphql_handler = move |req: GraphQLRequest| {
        let schema = schema.clone();
        async move { GraphQLResponse::from(schema.execute(req.into_inner()).await) }
    };

    Router::new().route("/graphql", get(graphql_playground).post(graphql_handler))
}

async fn graphql_playground() -> impl IntoResponse {
    axum::response::Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}
