import { splitPathSegments } from '../../src/scope';

console.log('Result for todos[]id:', splitPathSegments('todos[]id'));
console.log('Result for todos[].(it.id == id):', splitPathSegments('todos[].(it.id == id)'));
