# Examples

Run commands from the repository root with a current Vectrune build. Substitute
`cargo run --` for `vectrune` when running from source. Most web examples use
port 3000; run one at a time or choose another port with `--port`.

## Start here

1. Run [a minimal REST API](beginner/app.rune):
   `vectrune examples/beginner/app.rune`. Read its routes and try them with curl.
2. Explore [a small data document](beginner/skateboarders.rune):
   `vectrune examples/beginner/skateboarders.rune -o json`.
3. Run [a browser counter](beginner/counter.rune):
   `vectrune examples/beginner/counter.rune`, then open http://localhost:3000.
4. Follow the [Rune-Web lessons](rune-web/guide/) or try
   [a Vect script](vect/README.md).
5. Connect [a Rune-Web frontend to a server-side database](data/storage/README.md).
6. Try [namespaced modules and composed entities](rune-web/modules/modules.rune):
   `vectrune examples/rune-web/modules/modules.rune`, then press Create Pebble.
   The same language features power Glowtide's shared fish/critter care.

## Browse by topic

| Folder | Contents and suggested entry points |
| --- | --- |
| [beginner/](beginner/) | Small REST, document and counter examples. Start with `app.rune`. |
| [api/](api/) | [CSV CRUD](api/user_api.rune), [GraphQL](api/book_graphql.rune), [authentication](api/auth_example.rune) and [outbound HTTP](api/weather.rune). Some need configured services or credentials. |
| [rune-web/](rune-web/) | [Lessons](rune-web/guide/), [feature showcase](rune-web/web.rune), localization, reactivity, Dynamic AI and [Rune Studio](rune-web/studio/rune_studio.rune). |
| [data/](data/) | [Rune DB and Vect Event](data/storage/README.md), JSON import, [report aggregation](data/reports/sales_report.rune), [merging](data/merge/README.md), memory and SQL datasources. |
| [language/](language/) | [Portable object syntax](language/objects/README.md) across Vect/backend/web, and multi-file imports. |
| [vect/](vect/README.md) | Interactive `.vect` scripts: input, output, branches, loops and builtins. |
| [vectrune/](vectrune/README.md) | Experimental `.vectrune` forms and workflows. |
| [games/](games/) | Complete games, their local assets, logic and tests. See the game list below. |
| [testing/](testing/) | [API](testing/app.rune), [tests](testing/api.test.rune) and CI configuration for developer tooling. |
| [deployment/](deployment/) | [Lambda packaging and hosting](deployment/lambda/book_graphql_lambda/README.md). |

## Games

| Example | Entry file |
| --- | --- |
| VectRaiders | [space_invaders/space_invaders.rune](games/space_invaders/space_invaders.rune) |
| VectWorms | [vectworms/vectworms.rune](games/vectworms/vectworms.rune) |
| Tic-tac-toe | [tic_tac_toe/tic_tac_toe.rune](games/tic_tac_toe/tic_tac_toe.rune) |
| Monster City | [monster_city/monster_city.rune](games/monster_city/monster_city.rune) |
| Vect Breach | [vect_breach/vect_breach.rune](games/vect_breach/vect_breach.rune) |
| Glowtide Aquarium (idle, enhanced lighting) | [idle_aquarium/idle_aquarium.rune](games/idle_aquarium/idle_aquarium.rune) |
| Signal Run | [signal_run/signal_run.rune](games/signal_run/signal_run.rune) |
| Rune Crypt | [rune_crypt/rune_crypt.rune](games/rune_crypt/rune_crypt.rune) |
| Rune Miners | [rune_miners/rune_miners.rune](games/rune_miners/rune_miners.rune) |
| Skybound | [skybound/skybound.rune](games/skybound/skybound.rune) |
| Skybound 2 | [skybound_2/skybound_2.rune](games/skybound_2/skybound_2.rune) |
| Starfall Protocol | [starfall/starfall.rune](games/starfall/starfall.rune) |
| Dog Walker | [dog_walker/dog_walker.rune](games/dog_walker/dog_walker.rune) |
| Worm Game | [worm_game/worm_game.rune](games/worm_game/worm_game.rune) |

For example:

```sh
vectrune examples/games/starfall/starfall.rune -o html > starfall.html
vectrune test examples/games/starfall --type logic
```

Keep an example's provider files, imports, data, assets and tests together when
copying it. Browser storage belongs to an origin; changing its host or port can
select different saved data. The teaching site's public game URLs retain their
existing addresses.

When adding or moving examples, update the catalog in
[knowledge/reference/examples.yaml](../knowledge/reference/examples.yaml), its
references in docs/tests/site sources, and run `vectrune knowledge export`.
