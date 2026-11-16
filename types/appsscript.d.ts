declare const SpreadsheetApp: {
  getActive(): Spreadsheet;
};

declare interface Spreadsheet {
  getSheetByName(name: string): Sheet | null;
  getUrl(): string;
}

declare interface Sheet {
  getName(): string;
  setName(name: string): Sheet;
  getParent(): Spreadsheet;
  getLastRow(): number;
  getSheetId(): number;
  getRange(a1: string): Range;
  getRange(
    row: number,
    column: number,
    numRows?: number,
    numColumns?: number,
  ): Range;
}

declare interface Range {
  getValue(): unknown;
  getValues(): unknown[][];
  setValue(value: unknown): void;
  setValues(values: unknown[][]): void;
  clearContent(): void;
}

declare const Session: {
  getScriptTimeZone(): string;
};

declare const Utilities: {
  formatDate(date: Date, timeZone: string, format: string): string;
};

declare const HtmlService: {
  createTemplateFromFile(filename: string): HtmlTemplate;
  createHtmlOutputFromFile(filename: string): HtmlOutput;
  XFrameOptionsMode: {
    ALLOWALL: unknown;
    DEFAULT: unknown;
  };
};

declare interface HtmlTemplate {
  evaluate(): HtmlOutput;
}

declare interface HtmlOutput {
  getContent(): string;
  setTitle(title: string): HtmlOutput;
  addMetaTag(name: string, content: string): HtmlOutput;
  setXFrameOptionsMode(mode: unknown): HtmlOutput;
}
