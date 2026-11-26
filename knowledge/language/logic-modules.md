# Logic modules and composable entities

Available in source builds through the shared Rune-Web compiler/runtime:
ordinary browser pages, Pixel/Pixel-3D games and embedded logic tests. These are
not backend `run:` classes. Existing flat `@Logic` state and actions are unchanged.
There is no inheritance or prototype-based object model.

Ordinary unscoped actions/helpers reuse the current runtime context rather than
allocating a module context. Namespace qualification is skipped when no scope is
active. Shared dispatch/cache checks remain; this is not a zero-overhead guarantee.

## Explicit module APIs

```rune
@Module/Wallet
exports = ["earn","balance"]
state:
    pearls = 30
action earn(amount):
    pearls += amount
func balance():
    return pearls

@Logic/game
modules = {"wallet":"Wallet"}
action reward:
    call wallet.earn 10
```

Each alias owns an independent state record within that logic application.
Views read `{wallet.pearls}`; expressions can call `wallet.balance()`.
State objects/arrays are read-only outside their module, including local aliases
and object values returned by exported helpers. Change them through actions.
The browser's JavaScript host is not a security boundary.

Only names in `exports` are callable from outside. Omitted `exports` exports
nothing. Private internal calls use `call member args`. Scoped actions/helpers
see their own state and explicit parameters, not the caller's locals or root
application state. Pass another record explicitly when a module must operate on
it. Modules cannot implicitly call unscoped root actions/helpers.

## Plain-data entity types

```rune
@Type/Life
state:
    age = 0
    hunger = 0
action advance(seconds):
    age += seconds
    hunger += seconds

@Type/Pet
state:
    name = "Pebble"
    care = Life(id+"-care")
action advance(seconds):
    call care.advance seconds

@Logic/game
types = ["Life","Pet"]
state:
    pet = null
action initialize:
    pet = Pet("pet-1",{"name":"Shelly"})
action age:
    call pet.advance 60
```

List every type used, including composed dependencies, in `types`. Constructors
run in actions, not initial `@Logic`/module state or initial locals. Default field
expressions can use `id` and other declared constructors; sibling fields are not
implicit bindings. Defaults are independently evaluated for each instance;
explicit object/array overrides keep the references supplied by the caller.

`Pet("pet-1", {"name":"Shelly"})` returns a plain JSON-serializable record with
`id`, `__type`, and the declared fields. Supply a nonempty stable string ID and
ensure uniqueness in your application; there is no global entity registry.
Rune assignments/deletions cannot change `id` or `__type`, including after JSON
restore. Unknown override fields and invalid IDs/override records raise errors.
Recursive/cyclic constructor defaults also raise an explicit composition error.

Methods run against the receiver's fields, with `self` available for explicitly
passing the whole instance. Internal method calls retain that receiver.
Use `call pet.care.advance 60` or a local receiver alias when iterating arrays:

```rune
for resident in residents:
    call resident.advance 1
```

Method dispatch uses the retained `__type` after JSON save/restore; functions and
prototypes are never serialized. Preserve nested fields in your save schema.
Normal Rune-Web events accept qualified actions: `click=wallet.earn(10)` and
`click=pet.advance(60)`. Multiple `call` arguments are comma-separated.

## Current limits and workflows

Modules support `state`, `action`, and `func`, with at least one callable member.
Types support fields and actions, not `func`. Field/member names must be distinct
identifiers; `id`, `__type`, `self`, `constructor`, `prototype`, and `__proto__`
are reserved member names. Define timers, keys, derived values and local state
in the owning `@Logic`, not inside modules/types. Nested module/type declarations
and inheritance are not supported. Use imports to organize source files.

Fetch/storage continuations retain their app and module/entity context.
Existing restrictions on assignment I/O inside loops/conditions still apply.

Run the ordinary [companion example](../../examples/rune-web/modules/modules.rune)
and press **Create Pebble** before advancing or feeding:

```sh
vectrune examples/rune-web/modules/modules.rune
vectrune test examples/rune-web/modules --type logic
```

[Glowtide's care module](../../examples/games/idle_aquarium/care.rune) uses the
same APIs for fish and bottom critters. Its save migration keeps legacy flat care
fields as compatible mirrors and assigns persisted, monotonically allocated
resident IDs; feeding thresholds and death timings are unchanged.

Sources: [compiler lowering](../../src/apps/rune_web/modular.rs),
[scope/visibility](../../runtime/rune-web/src/modular.ts),
[constructors](../../runtime/rune-web/src/expression.ts),
[dispatch](../../runtime/rune-web/src/logic.ts),
[runtime tests](../../runtime/rune-web/tests/modular.test.ts),
[ordinary browser test](../../tests/browser/logic_modules.py).
