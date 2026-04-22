export type ProjectRow = {
  id: number;
  name: string;
  start_date: Date | string;
  end_date: Date | string;
  created_at: Date | string;
};

export type Project = {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
};

export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date instanceof Date ? row.start_date : new Date(row.start_date),
    endDate: row.end_date instanceof Date ? row.end_date : new Date(row.end_date),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}