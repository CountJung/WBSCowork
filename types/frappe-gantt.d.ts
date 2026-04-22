declare module "frappe-gantt" {
  export type GanttTask = {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
  };

  export type GanttOptions = {
    view_mode?: "Day" | "Week" | "Month" | "Year";
    view_mode_select?: boolean;
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    container_height?: number | "auto";
    popup?: (context: { task: GanttTask }) => string | false | undefined;
  };

  export default class Gantt {
    constructor(target: string | HTMLElement, tasks: GanttTask[], options?: GanttOptions);
    change_view_mode(viewMode: GanttOptions["view_mode"], maintainPosition?: boolean): void;
  }
}