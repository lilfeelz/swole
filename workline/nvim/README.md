# workline in Neovim

Parser, queries and an editing flow for [workline](../SPEC.md) files, built from
the grammar in this directory so nvim and the web app share one definition.

## Install

Needs Neovim 0.10+ and node. Build the native parser once after clone and after
any `grammar.js` change:

```sh
workline/nvim/build.sh
```

Then add this directory to `runtimepath`, for example lazy.nvim:

```lua
{ dir = "/path/to/swole/workline/nvim", name = "workline" }
```

or vim.pack:

```lua
vim.pack.add({ "/path/to/swole/workline/nvim" })
```

Or from a shell, `nvim --cmd "set rtp+=/path/to/swole/workline/nvim"`.

Filetypes: `.workline`, `.wl`, and inside a swole checkout `data/routine.txt`,
`data/session.txt` and `data/log/**/*.txt`.

## Editing

Commands are buffer-local. They run the swole CLI from the checkout root found
by walking up to the `package.json` that has `src/cli.js`.

| Command | CLI | Effect |
| --- | --- | --- |
| `:SwoleStart [DAY]` | `swole start` | starts a session and opens `data/session.txt` |
| `:SwoleStop` | `swole stop` | stops the active session; write the buffer first |
| `:SwoleSave` | `swole save` | saves the session into `data/log` |
| `:SwoleValidate` | `swole validate` | lints routine, session and logs into the quickfix list |

Every write of a workline buffer runs the same validation silently and fills the
quickfix list on failure. Parsing is the workline grammar plus the line linter
in `src/cli.js`, so the buffer check is the one the repository tests use.

## Queries

`queries/workline/highlights.scm` is a symlink to the shared
[highlights](../queries/highlights.scm), so nvim cannot drift from the wasm
build. There is no `folds.scm`: every rule is a single line, so there is no
multi-line node to fold; use line folds (`zM`, `zf`) instead.

## Regenerating

`build.sh` compiles the checked-in `src/parser.c`. After changing `grammar.js`,
regenerate both artifacts:

```sh
npm run build:grammar   # tree-sitter generate + wasm for the web app
workline/nvim/build.sh  # native parser for nvim
```
