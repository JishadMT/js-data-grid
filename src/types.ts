export type HttpMethod = 'GET' | 'POST';

export interface PaginationParams {
  page: number;
  limit: number;
}

export type RequestBodyTemplate =
  | Record<string, any>
  | string
  | ((params: PaginationParams) => Record<string, any> | string);

export interface GridColumn<T = any> {
  key: string;
  label?: string;
  formatter?: (value: any, rowData: T, rowIndex: number) => string | HTMLElement;
  sort?: boolean,
  type?: string
}

export interface TransformResponseResult<T = any> {
  data: T[];
  total: number;
}

export interface JsDataGridOptions<T = any> {
  container: string | HTMLElement;
  columns: GridColumn<T>[];
  data?: T[];
  url?: string;
  method?: HttpMethod; // Defaults to 'GET'
  headers?: Record<string, string>;
  body?: RequestBodyTemplate; // Used when method === 'POST'
  pageParamName?: string; // Defaults to 'page'
  limitParamName?: string; // Defaults to 'limit'
  pageSize?: number;
  onSort?: Function,
  transformResponse?: (rawResponse: any) => TransformResponseResult<T>;
}