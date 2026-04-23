declare module "frappe-gantt" {
  export type GanttTask = {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
    description?: string;
    assigneeName?: string;
  };

  export type GanttPopupContext = {
    task: GanttTask;
    chart: unknown;
    set_title: (value: string) => void;
    set_subtitle: (value: string) => void;
    set_details: (value: string) => void;
    add_action: (
      label: string | ((task: GanttTask) => string),
      onClick: (task: GanttTask, chart: unknown, event: MouseEvent) => void,
    ) => void;
  };

  export type GanttOptions = {
    view_mode?: "Day" | "Week" | "Month" | "Year";
    view_mode_select?: boolean;
    readonly?: boolean;
    readonly_dates?: boolean;
    readonly_progress?: boolean;
    container_height?: number | "auto";
    popup?: (context: GanttPopupContext) => string | false | void;
  };

  export default class Gantt {
    constructor(target: string | HTMLElement, tasks: GanttTask[], options?: GanttOptions);
    change_view_mode(viewMode: GanttOptions["view_mode"], maintainPosition?: boolean): void;
    refresh(tasks: GanttTask[]): void;
    update_options(options: GanttOptions): void;
  }
}