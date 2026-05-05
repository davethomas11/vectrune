# Vectrune Language Capabilities

Vectrune is a powerful and versatile tool and language designed for building applications, APIs, and scripting complex data workflows. It combines a declarative configuration language with robust runtime capabilities for web services, data processing, AI integration, and more.

## 1. Core Language Features (.rune Files)

The `.rune` file format is central to Vectrune, enabling declarative definition of data structures, configurations, and application logic.

### 1.1. Data Structures
Vectrune uses a hierarchical structure to organize data:

*   **Sections:** Represent distinct blocks of configuration or data, identified by hierarchical paths using `@`.
    *   Example: `@App`, `@Database/Users`, `@API/Routes/GET/users`
*   **Key-Value Pairs (KV):** Simple assignments within sections.
    *   Example: `name = "Vectrune"`
*   **Series:** Named lists of values, used for collections.
    *   Example: `run:` followed by indented items.
*   **Records:** Structured data, often used within Series to represent objects or items.
    *   Example: `+ host = "localhost"`, `+ port = 3000`
*   **Nested Structures:** Supports nested maps within Series and Records.

### 1.2. Data Types
Vectrune's `Value` enum supports:

*   **String:** Textual data.
*   **Number:** Floating-point numbers (`f64`).
*   **Boolean:** `true` or `false`.
*   **List:** Ordered collections of `Value`s, defined inline with `(...)`.
*   **Map:** Key-value pairs, defined inline with `{...}` or within Records.

### 1.3. Dynamic Features
*   **Environment Variable Substitution:** Values can be dynamically set using environment variables via `$VAR$` syntax.
*   **Multiline Values:** Supports defining multiline strings for configuration values.
*   **Event Handlers:** Defines handlers for events, common in web services (`on_connect:`, `on_message:`, `on_request:`).
*   **Basic Logic:** Supports inline list and object definitions, and rudimentary `if` statements for conditional logic within certain contexts.

## 2. Built-in Functions

Vectrune provides a rich set of built-in functions accessible within `.rune` scripts and CLI commands.

### 2.1. Data Handling & Manipulation
*   **`csv.read <filename> [assign_to]`**: Reads a CSV file into a JSON array of objects. Supports multiple candidate paths for the file.
    *   Example: `data = csv.read data.csv`
*   **`csv.write <filename> <variable>`**: Writes a JSON array (from `<variable>`) to a CSV file, creating headers from object keys.
    *   Example: `csv.write output.csv my_data_array`
*   **`csv.append <filename> <object_variable>`**: Appends a single JSON object (from `<object_variable>`) as a row to a CSV file.
    *   Example: `csv.append logs.csv new_log_entry`
*   **`json.read <filename> [assign_to]`**: Reads a JSON file into a JSON value. Requires an assignment target.
    *   Example: `config = json.read config.json`
*   **`parse-json [value_variable] [assign_to]`**: Parses a JSON string (from `value_variable`, defaults to `body`) into a JSON value.
    *   Example: `parsed_body = parse-json body`
*   **`append <variable> <value>`**: Appends a `value` (or variable) to a JSON array in context.
    *   Example: `my_list = []; append my_list "item1"` (then `my_list` would be `["item1"]`)

### 2.2. Database & Data Source Integration
*   **`datasource create_table <schema_name> in <data_source_name>`**: Creates a table in the specified data source based on a schema definition.
    *   Example: `datasource create_table User in db_config`
*   **`datasource fetch_all <schema_name> from <data_source_name> [into <variable>]`**: Fetches all records for a schema from a data source.
    *   Example: `users = datasource fetch_all User from db_config into users_data`
*   **`datasource fetch <schema_name> from <data_source_name> [into <variable>]`**: Fetches a single record by ID. Requires ID to be present in context (e.g., `path.params.id` or `body.id`).
    *   Example: `user = datasource fetch User from db_config into user_data` (assuming `path.params.id` is set)
*   **`datasource insert <schema_name> into <data_source_name>`**: Inserts a record. Requires `body` variable to be a JSON object with data.
    *   Example: `datasource insert User into db_config` (after setting `body = { "name": "...", "email": "..." }`)
*   **`datasource update <schema_name> in <data_source_name>`**: Updates a record by ID. Requires ID in context and data in `body`.
    *   Example: `datasource update User in db_config` (after setting `body` and `path.params.id`)
*   **`datasource delete <schema_name> from <data_source_name>`**: Deletes a record by ID. Requires ID in context.
    *   Example: `datasource delete User from db_config` (assuming `path.params.id` is set)
*   **`mysql.query <query_string> [param1] [param2] ... [assign_to]`**: Executes a MySQL query with optional parameter binding from context variables.
    *   Example: `mysql.query "SELECT * FROM users WHERE id = ?" user_id into results`
*   **`postgres.query <query_string> [param1] [param2] ... [assign_to]`**: Executes a PostgreSQL query with optional parameter binding from context variables.
    *   Example: `postgres.query "SELECT * FROM products WHERE category = $1" product_category into products_list`

### 2.3. Web & Networking
*   **`ws.id [assign_to]`**: Gets the WebSocket connection ID (if available in context) and assigns it to a variable.
*   **`ws.send <path> <ws_id> <message>`**: Sends a message to a specific WebSocket connection.
*   **`ws.broadcast <path> <message>`**: Broadcasts a message to all connections on a given path.

### 2.4. Language & Scripting
*   **`func <name> <step1>; <step2>; ...`**: Defines a reusable function with a sequence of steps.
    *   Example: `func process_data name: string; log "Processing data..."`
*   **`invoke_func <name> [arg1] [arg2] ... [assign_to]`**: Invokes a previously defined function, optionally passing arguments and capturing the result.
    *   Example: `result = invoke_func process_data "my_data"`
*   **`log <message>`**: Writes an informational log message.
    *   Example: `log "Starting script..."`

### 2.5. Memory & State Management
*   **`memory.clear`**: Clears all stored memory.
*   **`memory.delete <key>`**: Deletes a specific key from memory.
*   **`memory.set <key> [value]`**: Sets a key in memory to a `value` (or variable).
    *   Example: `memory.set api_key "your_secret_key"`
*   **`memory.get <key> [assign_to]`**: Retrieves a value from memory and assigns it to a variable.
    *   Example: `api_key = memory.get api_key`

### 2.6. API & Response Handling
*   **`respond [status_code] [message]`**: Generates an HTTP response (used within API route handlers).
    *   Example: `respond 200 "Data retrieved"` or `respond 404 "Not found"`

### 2.7. Validation & Conditions
*   **`validate <variable> #<schema_name>`**: Validates a variable against a defined schema. Responds with 400 on failure.
    *   Example: `validate body #UserSchema`
*   **`validate <left> <op> <right> <message>`**: Evaluates a condition (e.g., `id == 123`) and responds with `message` (400) if false.
    *   Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`.
    *   Example: `validate user_id == "abc" "Invalid user ID"`
*   **`if <condition>:`**: Conditional block support in scripts.
    *   Supported operators: `==`, `!=`, `>`, `<`, `>=`, `<=`.
    *   Example: `if state.score > 10: log "High score!"`

## 3. Command-Line Interface (CLI) Tools

Vectrune provides a powerful command-line interface for executing scripts, managing applications, and interacting with various services.

### 3.1. Top-Level Commands & Options

*   **`SCRIPT` (positional)**: Path to one or more `.rune` scripts, directories containing `.rune` files, or `-` to read from STDIN.
    *   Example: `vectrune my_script.rune ./configs/`
*   **`-i, --input <input_format>`**: Specifies the input format of scripts/data.
    *   Allowed values: `json`, `rune`, `xml`, `yaml`.
*   **`-o, --output <output_format>`**: Specifies the output format for script execution results.
    *   Allowed values: `text`, `json`, `rune`, `xml`, `yaml`, `curl`.
*   **`--calculate <EXPR>`**: Performs a calculation over data loaded from scripts.
    *   Example: `vectrune --calculate "avg Section.value" data.rune`
*   **`--transform <SPEC>`**: Transforms data based on a transformation specification.
    *   Example: `vectrune --transform "@Target key:[@Section.field]" input.rune`
*   **`--merge-with <MERGE_SPEC>`**: Merges data from another document.
    *   Example: `vectrune --merge-with "base.rune@section_to_merge" file1.rune`
*   **`-l, --log-level <LEVEL>`**: Sets the verbosity of logging output.
    *   Allowed values: `debug`, `info`, `warn`, `error`. (Default: `info`)
*   **`--ai <PROMPT>`**: Sends a prompt to a local AI model (e.g., Ollama) for assistance.
    *   Example: `vectrune --ai "Generate a README for this project"`
*   **`--model <MODEL>`**: Specifies the AI model to use with `--ai` (default: `phi4`).
*   **`-p, --port <PORT>`**: Overrides the default port (3000) for running REST/GraphQL servers.
*   **`--host <HOST>`**: Overrides the default host (`127.0.0.1`) for running REST/GraphQL servers.

### 3.2. Subcommands

#### `lambda`
AWS Lambda tooling for VectRune.

*   **`lambda launch`**: Launches the Vectrune Lambda runtime for handling AWS Lambda events.
*   **`lambda package`**: Bundles the Vectrune runtime, Rune sources, and configuration into a Lambda artifact.
    *   **`--rune <PATH>`**: Specifies the Rune file or directory to include (default: `app.rune`).
    *   **`--config <PATH>`**: Optional path to a config file or directory to include.
    *   **`--binary <PATH>`**: Path to the Lambda-compatible VectRune binary.
    *   **`--mode <MODE>`**: Selects the packaging mode (`zip` or `container`; default: `zip`).
    *   **`--output <FILE>`**: Specifies the output artifact path.
    *   **`--image-name <NAME>`**: Optional container image tag metadata.

#### `sam`
AWS SAM tooling for VectRune.

*   **`sam generate`**: Generates a SAM YAML file for a Lambda ZIP bundle.
    *   **`--bundle <PATH>`**: Path to the Lambda ZIP bundle (default: `dist/vectrune-lambda.zip`).
    *   **`--output <FILE>`**: Path for the output SAM YAML file (default: `sam.yaml`).
*   **`sam local`**: Runs local SAM testing for a Lambda ZIP bundle.
    *   **`--bundle <PATH>`**: Path to the Lambda ZIP bundle (default: `dist/vectrune-lambda.zip`).
    *   **`--sam <FILE>`**: Path to the SAM YAML file to use (default: `sam.yaml`).

#### `repl`
Starts the Vectrune REPL (Read-Eval-Print Loop) for interactive command execution.
*   **`--log-level <LEVEL>`**: Sets the log level for the REPL session (debug, info, warn, error).

## 4. Examples

Vectrune's power is best understood through practical examples. These demonstrate how to leverage its language features, built-in modules, and application development capabilities.

### 4.1. Core Language & Data Handling

*   **`app.rune` / `example.rune`**: These demonstrate basic `.rune` file structure, sections, key-value pairs, and simple lists/records, serving as an introduction to the declarative syntax.
*   **`json_import.rune`**: Shows how to read and process data from a JSON file using `json.read` or `parse-json` built-ins.
    *   *Illustrates:* Reading external data, basic data manipulation.
*   **`data.json` / `skaters.json`**: Sample JSON data files used with `.rune` scripts for demonstrating data loading and processing.

### 4.2. Web API Development (REST & GraphQL)

*   **`user_api.rune`**: Defines a REST API for user management, showcasing:
    *   Route definitions (`@API/Routes/GET/users`, `@API/Routes/POST/users`).
    *   HTTP methods (GET, POST, PUT, DELETE).
    *   `datasource` built-ins for CRUD operations (e.g., `datasource fetch_all User from UserDB`).
    *   `respond` built-in for returning HTTP status and messages.
    *   Schema definitions (`@Schema/User`).
    *   *Illustrates:* Full-stack API development with data persistence.
*   **`auth_example.rune`**: Demonstrates authentication mechanisms, possibly involving request headers, token validation, or user lookup.
    *   *Illustrates:* Security and authentication patterns.
*   **`book_graphql.rune`**: Defines a GraphQL API, showcasing:
    *   GraphQL schema definitions.
    *   GraphQL query/mutation resolvers using built-ins.
    *   Interaction with data sources.
    *   *Illustrates:* Building complex, schema-driven APIs.

### 4.3. AWS Lambda Integration

*   **`examples/lambda/book_graphql_lambda/book_graphql_lambda.rune`**: Shows how to build a GraphQL API as an AWS Lambda function.
    *   *Illustrates:* Serverless computing, integrating GraphQL with Lambda runtime.

### 4.4. Game Development

*   **`retro_game.rune` / `worm_game/worm_game.rune`**: Examples for game logic development, potentially using:
    *   Game state management via `memory.set`/`memory.get`.
    *   Input handling and simple rendering logic.
    *   *Illustrates:* Application development beyond typical web services.

### 4.5. Data Source Interaction

*   **`datasource.rune`**: Provides examples of connecting to and querying different data sources like MySQL or PostgreSQL using the `datasource` built-in.
    *   *Illustrates:* Database connectivity and data retrieval.
*   **`memory_api.rune` / `memory_from_json_api.rune`**: Demonstrate using the `memory` built-ins for state management, potentially loading/saving state from JSON.
    *   *Illustrates:* Persistent state management within scripts or applications.
