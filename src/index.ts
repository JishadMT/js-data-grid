import type {
  JsDataGridOptions,
  GridColumn,
  HttpMethod,
  PaginationParams,
  RequestBodyTemplate,
} from './types';

export * from './types';

export class JsDataGrid<T extends Record<string, any> = Record<string, any>> {
  private container: HTMLElement;
  private columns: GridColumn<T>[];
  private data: T[] | null;
  private url: string | null;
  private method: HttpMethod;
  private headers: Record<string, string>;
  private bodyTemplate?: RequestBodyTemplate;
  private pageParamName: string;
  private limitParamName: string;
  private pageSize: number;
  private currentPage: number = 1;
  private totalRecords: number = 0;
  private totalPages: number = 1;
  private sortKey: string = "";
  private sortDirection: string = "";
  private onSortCallback: Function | undefined;
  private transformResponse: (res: any) => { data: T[]; total: number };

  constructor(options: JsDataGridOptions<T>) {
    const el =
      typeof options.container === 'string'
        ? document.querySelector<HTMLElement>(options.container)
        : options.container;

    if (!el) {
      throw new Error(`JsDataGrid: Target container '${options.container}' not found.`);
    }

    this.container = el;
    this.columns = options.columns || [];
    this.data = options.data || null;
    this.url = options.url || null;
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.bodyTemplate = options.body;
    this.pageParamName = options.pageParamName || 'page';
    this.limitParamName = options.limitParamName || 'limit';
    this.pageSize = options.pageSize || 10;
    this.transformResponse = options.transformResponse || ((res: any) => res);
    this.onSortCallback = options.onSort;

    this.init();
  }

  private init(): void {
    this.container.classList.add('jdg-container');
    this.renderSkeleton();
    this.loadData();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
          <div class="jdg-table-wrapper">
            <table class="jdg-table">
              <thead>
                <tr>
                  ${this.columns
                    .map((col) => {
                      const sortIndicator = col.sort
                        ? `<span class="jdg-sort-icon" aria-hidden="true" id="sort-indicator-${col.key}"></span>`
                        : '';

                      return `<th
                        class="${col.sort ? 'jdg-sortable' : ''}"
                        ${col.sort ? `data-sort-key="${col.key}" tabindex="0" aria-sort=""` : ''}
                      >${col.label || col.key}${sortIndicator}</th>`;
                    })
                    .join('')}
                </tr>
              </thead>
              <tbody class="jdg-tbody">
                <tr><td colspan="${this.columns.length}" class="jdg-loading">Loading...</td></tr>
              </tbody>
            </table>
          </div>
          <div class="jdg-pagination">
            <button class="jdg-btn jdg-prev" disabled>&laquo; Prev</button>
            <span class="jdg-page-info">Page 1 of 1</span>
            <button class="jdg-btn jdg-next" disabled>Next &raquo;</button>
          </div>
        `;

    this.bindSortEvents();

    const nav = this.container.querySelector('.jdg-pagination');
    nav?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('jdg-prev') && this.currentPage > 1) {
        this.goToPage(this.currentPage - 1);
      } else if (target.classList.contains('jdg-next') && this.currentPage < this.totalPages) {
        this.goToPage(this.currentPage + 1);
      }
    });
  }

  /**
   * Recursively replaces {{page}} and {{limit}} placeholders in strings,
   * arrays, or nested objects. Converts exact "{{page}}" / "{{limit}}" tokens
   * to numbers when standing alone.
   */
  private resolvePlaceholders(value: unknown, params: PaginationParams): unknown {
    if (typeof value === 'string') {
      if (value === '{{page}}') return params.page;
      if (value === '{{limit}}') return params.limit;

      return value
        .replace(/\{\{page\}\}/g, String(params.page))
        .replace(/\{\{limit\}\}/g, String(params.limit));
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolvePlaceholders(item, params));
    }

    if (value !== null && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolvePlaceholders(v, params);
      }
      return resolved;
    }

    return value;
  }

  private buildRequestConfig(params: PaginationParams): {
    targetUrl: string;
    init: RequestInit;
  } 
  {
    if (!this.url) {
      throw new Error('JsDataGrid: URL is required to build a request.');
    }

    if (this.method === 'POST') {
      let payload: unknown;

      if (typeof this.bodyTemplate === 'function') {
        payload = this.bodyTemplate(params);
      } else if (this.bodyTemplate !== undefined) {
        payload = this.resolvePlaceholders(this.bodyTemplate, params);
      } else {
        // Default POST body if none is provided
        payload = {
          [this.pageParamName]: params.page,
          [this.limitParamName]: params.limit,
        };
      }

      const serializedBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

      return {
        targetUrl: this.url,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
          },
          body: serializedBody,
        },
      };
    }

    // Default: GET with query parameters
    const fetchUrl = new URL(this.url, window.location.href);
    fetchUrl.searchParams.set(this.pageParamName, String(params.page));
    fetchUrl.searchParams.set(this.limitParamName, String(params.limit));

    return {
      targetUrl: fetchUrl.toString(),
      init: {
        method: 'GET',
        headers: this.headers,
      },
    };
  }

  public async loadData(): Promise<void> {
    let rows: T[] = [];

    if (this.url) {
      try {
        const params: PaginationParams = {
          page: this.currentPage,
          limit: this.pageSize,
        };

        const { targetUrl, init } = this.buildRequestConfig(params);
        const response = await fetch(targetUrl, init);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const transformed = this.transformResponse(json);
        rows = transformed.data || [];
        this.totalRecords = transformed.total ?? rows.length;
      } catch (err) {
        console.error('JsDataGrid fetch error:', err);
        this.renderError('Failed to load data');
        return;
      }
    } else if (Array.isArray(this.data)) {
      rows = this.getClientSideData(this.data) as T[];
    }

    this.totalPages = Math.ceil(this.totalRecords / this.pageSize) || 1;
    this.renderRows(rows);
    this.updatePaginationControls();
  }

  private getClientSideData(data: Record<string, any>[]): Record<string, any>[]{
    if(this.sortKey?.length > 0)
    {
      data = this.getSortedClientSideData(data);
    }
    this.totalRecords = data.length;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const result = data.slice(start, end);
    return result;
  }

  private getSortedClientSideData(rows: Record<string, any>[]) {
    const key: string =  this.sortKey;
    const direction: string = this.sortDirection;

    if (!Array.isArray(rows) || !key) {
      return Array.isArray(rows) ? [...rows] : [];
    }

    const dirMultiplier = direction === 'desc' ? -1 : 1;
    const column = this.columns?.find((c) => c.key === key) || null;

    const getValue = (obj: any, path: any) =>
      path.split('.').reduce((acc: any, part: any) => (acc != null ? acc[part] : undefined), obj);

    const normalizeValue = (val: any, forcedType: any) => {
      if (val === null || val === undefined || val === '') return null;

      if (forcedType === 'number') {
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      }

      if (forcedType === 'date') {
        const time = val instanceof Date ? val.getTime() : Date.parse(val);
        return Number.isNaN(time) ? null : time;
      }

      if (forcedType === 'string') {
        return String(val);
      }

      // Auto-detect numbers and ISO/date strings when type isn't explicitly set
      if (typeof val === 'number') {
        return Number.isNaN(val) ? null : val;
      }

      if (val instanceof Date) {
        const time = val.getTime();
        return Number.isNaN(time) ? null : time;
      }

      if (typeof val === 'string') {
        const trimmed = val.trim();
        // Numeric string check (handles "$1,200" or "42.5" if needed, or strict number)
        if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
          return Number(trimmed);
        }
        // Date-like string check (avoids treating plain numbers/short codes as dates)
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || (Number.isNaN(Number(trimmed)) && !Number.isNaN(Date.parse(trimmed)))) {
          return Date.parse(trimmed);
        }
        return trimmed;
      }

      return String(val);
    };

    return [...rows]
      .map((row, index) => ({
        row,
        index, // Preserve original order on ties (stability)
        value: normalizeValue(getValue(row, key), column?.type),
      }))
      .sort((a, b) => {
        const valA = a.value;
        const valB = b.value;

        // Always push null/empty values to the bottom regardless of asc/desc
        if (valA === null && valB === null) return a.index - b.index;
        if (valA === null) return 1;
        if (valB === null) return -1;

        let comparison = 0;

        if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).localeCompare(String(valB), undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        }

        if (comparison === 0) {
          return a.index - b.index;
        }

        return comparison * dirMultiplier;
      })
      .map((entry) => entry.row);
  }

  private renderRows(rows: T[]): void {
    const tbody = this.container.querySelector('.jdg-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${this.columns.length}" class="jdg-empty">No data available</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');

      this.columns.forEach((col) => {
        const td = document.createElement('td');
        const rawValue = row[col.key];

        if (typeof col.formatter === 'function') {
          const formatted = col.formatter(rawValue, row, rowIndex);
          if (formatted instanceof HTMLElement) {
            td.appendChild(formatted);
          } else {
            td.innerHTML = formatted ?? '';
          }
        } else {
          td.textContent = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
        }

        tr.appendChild(td);
      });

      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  }

  private bindSortEvents() {
    const handleSortClick = (event: Event) => {
      const th = event && (event.target as HTMLElement)?.closest('th.jdg-sortable[data-sort-key]');
      if (!th || !this.container.contains(th)) return;

      const key = (th as HTMLTableColElement).dataset.sortKey;
      if(!key){
        return;
      }
      
      if (this.sortKey === key) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDirection = 'asc';
      }

      this.container.querySelectorAll('th.jdg-sortable').forEach((th) => {
        th.classList.add('d-none');
      });
      th.classList.remove("d-none");

      const sortIndicator = th.getElementsByClassName("jdg-sort-icon")?.item(0) as HTMLElement;
      sortIndicator.classList.remove("acs","desc");
      sortIndicator.classList.add(this.sortDirection);
      
      const column = this.columns.find((c) => c.key === this.sortKey) || null;
      if(!column){
        return;
      }

      const detail = {
        key: this.sortKey,
        direction: this.sortDirection,
        column: column,
      };

      // 1. Dispatch a bubbling DOM CustomEvent from the container
      this.container.dispatchEvent(
        new CustomEvent('jdg:sort', {
          detail,
          bubbles: true,
        })
      );

      // 2. Optional callback hook if provided on column options
      if (typeof this.onSortCallback === 'function') {
        this.onSortCallback(detail);
      }
      else if( !this.url ) {
        this.loadData();
      }
    };
    
    this.container.removeEventListener('click', handleSortClick);
    this.container.addEventListener('click', handleSortClick);
  }

  private updatePaginationControls(): void {
    const prevBtn = this.container.querySelector<HTMLButtonElement>('.jdg-prev');
    const nextBtn = this.container.querySelector<HTMLButtonElement>('.jdg-next');
    const info = this.container.querySelector<HTMLElement>('.jdg-page-info');

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
    if (info) {
      info.textContent = `Page ${this.currentPage} of ${this.totalPages} (${this.totalRecords} records)`;
    }
  }

  public goToPage(page: number): void {
    this.currentPage = page;
    this.loadData();
  }

  public reload(newData?: T[]): void {
    if (newData) this.data = newData;
    this.currentPage = 1;
    this.loadData();
  }

  private renderError(msg: string): void {
    const tbody = this.container.querySelector('.jdg-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="${this.columns.length}" class="jdg-error">${msg}</td></tr>`;
    }
  }
}