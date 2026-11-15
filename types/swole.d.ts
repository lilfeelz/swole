export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type Day = Weekday | string;

export interface Exercise {
  name: string;
  scheme: string;
  last?: string;
}

export type Routine = Record<Day, Exercise[]>;

export interface Entry {
  name: string;
  load: string;
}

export interface Session {
  day: Day;
  startAt: Date;
  endAt?: Date;
  entries: Entry[];
}

export interface LogEntry {
  startAt: Date;
  endAt: Date;
  day: Day;
  name: string;
  load: string;
}

export interface Store {
  routine(): Promise<Routine>;
  sessions(): Promise<Session[]>;
  append(session: Session): Promise<string>;
  getActive?(): Promise<Session | null>;
  setActive?(session: Session | null): Promise<void>;
}

export interface ApiPayload {
  day: Day;
  today: Weekday;
  days: Day[];
  program: Exercise[];
  activeSession?: Session | null;
  navLinks?: {
    routine?: string;
    log?: string;
  };
}

export interface Api {
  load(day?: string): Promise<ApiPayload>;
  start(day: string): Promise<Session>;
  stop(session: Session): Promise<Session>;
  save(session: Session): Promise<{ ok: boolean; saved: number; id: string }>;
  track(event: {
    category: string;
    action: string;
    label?: string;
    data?: any;
  }): Promise<void>;
}
