/**
 * Load the tree-sitter runtime and grammar once, before any parse.
 *
 * With no options it loads both .wasm files shipped next to this module:
 * from disk in Node, fetched as bytes in browsers and WebViews. Where wasm
 * cannot be fetched or compiled at runtime (Workers), import
 * `@jakobmelchard/workline/web-tree-sitter.wasm` and
 * `@jakobmelchard/workline/workline.wasm` as WebAssembly.Module and pass them
 * as `runtime` and `language`.
 * @param {{language?: string | URL | Uint8Array | WebAssembly.Module, runtime?: WebAssembly.Module | object}} [opts]
 *   `runtime` is a compiled runtime module or raw Emscripten module options.
 * @returns {Promise<void>} resolves once parse can run
 */
export function init(opts?: {
    language?: string | URL | Uint8Array | WebAssembly.Module;
    runtime?: WebAssembly.Module | object;
}): Promise<void>;
/**
 * Parse a cell, one line per set line; blank lines are skipped.
 * @param {string} cell cell text
 * @returns {Parsed & {headers: Header[]}} lines, header rows and per-line errors
 */
export function parse(cell: string): Parsed & {
    headers: Header[];
};
/**
 * Parse one line; throws on a syntax or range error.
 * @param {string} raw line text
 * @param {number} [index] line number within its cell
 * @returns {Line & {header?:string}} parsed line or header row
 */
export function parseLine(raw: string, index?: number): Line & {
    header?: string;
};
/**
 * One SetSpec per set, defaults applied. week (1-based) picks each group's
 * target from its week steps; past the last step the last one repeats.
 * @param {Line} line parsed line
 * @param {number} [week] week of the block, 1-based
 * @returns {SetSpec[]} one spec per set
 */
export function expand(line: Line, week?: number): SetSpec[];
/**
 * @param {Parsed} parsed parsed cell
 * @returns {string} canonical cell; error lines kept verbatim
 */
export function serialize(parsed: Parsed): string;
/**
 * @param {Line} line parsed line
 * @returns {string} canonical line
 */
export function serializeLine(line: Line): string;
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type TargetUnit = "reps" | "s" | "min" | "km";
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Target = {
    min: number;
    max?: number;
    unit: TargetUnit;
    amrap?: true;
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Weight = {
    value?: number;
    unit?: "kg" | "lb";
    added?: true;
    ask?: true;
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Scalar = {
    value: number;
    ask?: true;
};
/**
 * rest in seconds
 */
export type Mods = {
    weight?: Weight;
    percent?: Scalar;
    rpe?: Scalar;
    rest?: number;
};
/**
 * weeks: one target per week of a block ("8|6|4"), target is weeks[0]
 */
export type Group = Mods & {
    sets: number;
    target: Target;
    weeks?: Target[];
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Line = {
    index: number;
    name?: string;
    groups: Group[];
    defaults: Mods;
    log?: number[];
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Header = {
    index: number;
    text: string;
};
/**
 * one expanded set, defaults applied
 */
export type SetSpec = Mods & {
    target: Target;
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type ParseError = {
    line: number;
    raw: string;
    reason: string;
};
/**
 * workline v1: tree-sitter syntax (grammar.js) plus semantics. See SPEC.md.
 */
export type Parsed = {
    lines: Line[];
    headers?: Header[];
    errors: ParseError[];
};
export type Node = import("web-tree-sitter").Node;
