import { buildSchema, graphqlSync, printSchema, getNamedType, isObjectType, isScalarType, isEnumType } from 'graphql';
import type { RuneDocument } from '../types';
import type { MockResponse } from './context';
import { createRequestContext } from './context';
import { executeSteps } from './executor';

export interface GraphqlRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphqlExample {
  label: string;
  query: string;
  variables: Record<string, unknown>;
}

/** Rune's native GraphQL runtime maps `number` to Float, and fields/args to required types. */
function graphqlType(type: string, required = true): string {
  const mapped = type.replace(/\b(number|integer|bool|boolean|string)\b/gi, name => {
    return ({ number: 'Float', integer: 'Int', bool: 'Boolean', boolean: 'Boolean', string: 'String' })[name.toLowerCase()]!;
  });
  return required && !mapped.endsWith('!') ? mapped + '!' : mapped;
}

export function createGraphqlEngine(doc: RuneDocument, files: Record<string, unknown[]>, memory: Record<string, unknown>) {
  const definitions = ['scalar JSON'];
  for (const [name, type] of Object.entries({ ...doc.schemas, ...doc.graphql.types })) {
    definitions.push(`type ${name} { ${Object.entries(type.fields).map(([field, value]) => `${field}: ${graphqlType(value)}`).join('\n')} }`);
  }
  const root: Record<string, (args: Record<string, unknown>, context: { logs: string[] }) => unknown> = {};
  for (const kind of ['query', 'mutation'] as const) {
    const fields = doc.graphql.fields.filter(field => field.kind === kind);
    if (!fields.length) {
      if (kind === 'query') throw new Error('GraphQL requires at least one query resolver.');
      continue;
    }
    const names = new Set<string>();
    const declarations = fields.map(field => {
      if (names.has(field.name)) throw new Error(`Duplicate ${kind} resolver: ${field.name}`);
      names.add(field.name);
      const args = Object.entries(field.args).map(([name, type]) => `${name}: ${graphqlType(type)}`).join(', ');
      // Keep Query and Mutation resolver namespaces separate, even when names coincide.
      root[`${kind}:${field.name}`] = (values, context) => {
        const request = createRequestContext({ method: 'GRAPHQL', path: '/graphql' }, {}, doc.schemas, files, memory);
        Object.assign(request.state, values);
        try {
          executeSteps(field.run, request);
          if (request.response && request.response.status >= 400) {
            throw new Error(typeof request.response.body === 'string' ? request.response.body : JSON.stringify(request.response.body));
          }
          return request.response?.body ?? null;
        } finally {
          context.logs.push(...request.logs);
        }
      };
      return `${field.name}${args ? `(${args})` : ''}: ${graphqlType(field.returnType, false)}`;
    });
    definitions.push(`type ${kind === 'query' ? 'Query' : 'Mutation'} { ${declarations.join('\n')} }`);
  }
  const schema = buildSchema(definitions.join('\n'));
  for (const [kind, object] of [['query', schema.getQueryType()], ['mutation', schema.getMutationType()]] as const) {
    for (const field of Object.values(object?.getFields() ?? {})) {
      field.resolve = (_source, args, context) => root[`${kind}:${field.name}`](args, context);
    }
  }

  const examples: GraphqlExample[] = doc.graphql.fields.map(field => {
    const name = field.name.charAt(0).toUpperCase() + field.name.slice(1);
    const variables: Record<string, unknown> = {};
    const parameters = Object.entries(field.args).map(([argument, type]) => {
      const valueType = graphqlType(type);
      variables[argument] = valueType.startsWith('Float') || valueType.startsWith('Int') ? (argument === 'published_year' ? new Date().getFullYear() : 1)
        : valueType.startsWith('Boolean') ? true : argument === 'title' ? 'My sandbox book' : `New ${argument}`;
      return `$${argument}: ${valueType}`;
    });
    const argumentsText = Object.keys(field.args).map(argument => `${argument}: $${argument}`).join(', ');
    const rootType = field.kind === 'query' ? schema.getQueryType() : schema.getMutationType();
    const type = getNamedType(rootType!.getFields()[field.name].type);
    const selection = isObjectType(type) ? Object.values(type.getFields())
      .filter(item => isScalarType(getNamedType(item.type)) || isEnumType(getNamedType(item.type)))
      .map(item => item.name) : [];
    const fields = isObjectType(type) ? ` {\n    ${(selection.length ? selection : ['__typename']).join('\n    ')}\n  }` : '';
    return {
      label: `${field.kind}: ${field.name}`,
      query: `${field.kind} ${name}${parameters.length ? `(${parameters.join(', ')})` : ''} {\n  ${field.name}${argumentsText ? `(${argumentsText})` : ''}${fields}\n}`,
      variables,
    };
  });

  return {
    info: { schema: printSchema(schema), examples },
    execute(request: GraphqlRequest): MockResponse {
      const logs: string[] = [];
      const result = graphqlSync({ schema, source: request.query, variableValues: request.variables, operationName: request.operationName, contextValue: { logs } });
      return { status: result.errors && !('data' in result) ? 400 : 200, body: result, logs };
    },
  };
}
