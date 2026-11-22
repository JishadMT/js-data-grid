
# JsDataGrid (`js-data-grid`)

A lightweight, zero-dependency TypeScript data grid library inspired by jqGrid; built for fast DOM rendering, pagination, and custom HTML or DOM element formatters.

## Features

* **Zero Dependencies:** Pure TypeScript and native browser APIs (`fetch`, DOM fragments)—no jQuery or heavy UI frameworks required.
* **Flexible Data Sources:** Render from a local array (`data`) or fetch paginated data from a remote `GET` or `POST` endpoint (`url`).
* **Pagination Placeholders:** Pass `{{page}}` and `{{limit}}` inside `POST` request bodies (or use a dynamic body function) and customize query/body parameter names.
* **Custom Formatters (jqGrid-style):** Return either an HTML string or a native `HTMLElement` (with event listeners) from `(value, rowData, rowIndex)`.
* **Dual Distribution:** Ships as ESM, CommonJS, TypeScript `.d.ts` declarations, CSS, and a browser global/IIFE bundle for CDNs.

---

## Installation

### Via npm

```bash
npm install @jishadmt/js-data-grid

```

### Via CDN (unpkg / jsDelivr)

```html
<link rel="stylesheet" href="https://unpkg.com/@jishadmt/js-data-grid@0.1.0/dist/style/js-data-grid.css" />
<script src="https://unpkg.com/@jishadmt/js-data-grid@0.1.0/dist/index.global.js"></script>

```

---

## Quick Start

### 1. Local Array Data & Custom Formatters (TypeScript / ESM)

```typescript
import { JsDataGrid, type GridColumn } from "js-data-grid";
import "js-data-grid/css";

interface User {
  id: number;
  name: string;
  role: string;
  profileUrl: string;
}

const users: User[] = [
  { id: 1, name: "Aarav Sharma", role: "Admin", profileUrl: "/users/1" },
  { id: 2, name: "Diya Nair", role: "Editor", profileUrl: "/users/2" },
  { id: 3, name: "Karthik Iyer", role: "Viewer", profileUrl: "/users/3" },
];

const columns: GridColumn<User>[] = [
  { key: "id", label: "ID" },
  {
    key: "name",
    label: "User",
    formatter: (value, row) => {
      const link = document.createElement("a");
      link.href = row.profileUrl;
      link.textContent = String(value ?? "");
      link.className = "mg-link";
      return link;
    },
  },
  {
    key: "role",
    label: "Role",
    formatter: (value) => `<span class="role-badge">${value}</span>`,
  },
];

const grid = new JsDataGrid<User>({
  container: "#grid",
  data: users,
  pageSize: 2,
  columns,
});

```

### 2. Plain HTML + CDN Script Tag

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JsDataGrid Demo</title>
  <link rel="stylesheet" href="https://unpkg.com/@jishadmt/js-data-grid@0.1.0/dist/style/js-data-grid.css" />
</head>
<body>
  <div id="grid"></div>

  <script src="https://unpkg.com/@jishadmt/js-data-grid@0.1.0/dist/index.global.js"></script>
  <script>
    const { JsDataGrid } = window.JsDataGridLib;

    new JsDataGrid({
      container: "#grid",
      data: [
        { id: 101, title: "Q1 Roadmap", status: "Active" },
        { id: 102, title: "Q2 Launch", status: "Pending" },
      ],
      pageSize: 10,
      columns: [
        { key: "id", label: "ID", sort: true },
        { key: "title", label: "Title" },
        {
          key: "status",
          label: "Status",
          formatter: (val) => `<strong>${val}</strong>`,
        },
      ],
    });
  </script>
</body>
</html>

```

---

## Fetching Remote Data (`GET` & `POST`)

### `GET` Request

By default, `JsDataGrid` sends `GET` requests with `page` and `limit` query parameters (customizable via `pageParamName` and `limitParamName`).

```typescript
new JsDataGrid({
  container: "#grid",
  url: "https://api.example.com/users",
  method: "GET",
  pageSize: 10,
  pageParamName: "page",
  limitParamName: "limit",
  headers: {
    Authorization: "Bearer <token>",
  },
  transformResponse: (res) => ({
    data: res.items,
    total: res.totalCount,
  }),
  columns: [
    { key: "id", label: "ID" },
    { key: "email", label: "Email" },
  ],
});

```

### `POST` Request with Pagination Placeholders

When `method` is `"POST"`, use `"{{page}}"` and `"{{limit}}"` placeholders in your `body` template—or pass a function `({ page, limit }) => ...`.

* Standalone `"{{page}}"` and `"{{limit}}"` values resolve to **numbers** (`1`, `20`).
* Placeholders embedded inside larger strings (such as `"batch-{{page}}"`) interpolate as **strings**.

```typescript
new JsDataGrid({
  container: "#grid",
  url: "https://api.example.com/users/search",
  method: "POST",
  pageSize: 20,
  headers: {
    Authorization: "Bearer <token>",
  },
  body: {
    filters: {
      active: true,
    },
    pagination: {
      page: "{{page}}",
      limit: "{{limit}}",
      batchLabel: "page-{{page}}",
    },
  },
  transformResponse: (res) => ({
    data: res.rows,
    total: res.totalRecords,
  }),
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
  ],
});

```

---

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `string | HTMLElement` | *Required* | CSS selector or target DOM element. |
| `columns` | `GridColumn<T>[]` | *Required* | Column definitions (`key`, `label`, `formatter`, `sort`). |
| `data` | `T[]` | `null` | Local dataset for client-side pagination. |
| `url` | `string` | `null` | Remote API endpoint URL. |
| `method` | `"GET" | "POST"` | `"GET"` | HTTP method used when fetching from `url`. |
| `headers` | `Record<string, string>` | `{}` | Custom request headers sent with `fetch`. |
| `body` | `RequestBodyTemplate` | `undefined` | Request payload or `(params) => payload` for `POST` requests. |
| `pageParamName` | `string` | `"page"` | Query parameter name for `GET` pagination. |
| `limitParamName` | `string` | `"limit"` | Query parameter name for `GET` page size. |
| `pageSize` | `number` | `10` | Number of records per page. |
| `transformResponse` | `(raw: any) => { data: T[]; total: number }` | `(res) => res` | Maps API response fields to `{ data, total }`. |
| `onSort` | `({key, direction, column}) => { }` | `(res) => res` | Callback event on sort actions |

## Column Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string` | *Required* | Unique key in data to identify the value for column. |
| `label` | `string` | null | Display header for column. |
| `formatter` | `(value: any, rowData: T, rowIndex: number) => string \| HTMLElement` | `(res) => res` | Render custom HTML elements for the column data. |
| `sort` | `bool` | null | Indicates whether sort is enabled for this column or not.|

### Public Methods

* `grid.goToPage(page: number)` — Loads a specific page number.
* `grid.reload(newData?: T[])` — Resets to page `1` and reloads (optionally replacing local `data`).
* `grid.loadData()` — Re-fetches or re-renders the current page.

---

## Building from Source

```bash
npm install
npm run type-check
npm run build

```

This outputs the compiled bundles, CSS, and TypeScript declarations into `dist/`.

## License

GPL-3.0 license