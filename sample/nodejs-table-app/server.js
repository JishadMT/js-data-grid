const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve a directory outside the project folder at a URL prefix
const externalLibsDir = path.resolve(__dirname, '../../dist');
app.use('/js-data-grid-dist-folder', express.static(externalLibsDir));

// Sample dataset
const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
const statuses = ['Active', 'Inactive', 'Pending'];
const users = Array.from({ length: 55 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    department: departments[i % departments.length],
    status: statuses[i % statuses.length],
    salary: 50000 + (i * 1500)
}));

function paginate(items, page = 1, limit = 10) {
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 10);
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const data = items.slice(startIndex, startIndex + pageSize);

    return {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages,
        data
    };
}

/**
 * 1. GET API: Paginated list of objects
 * Query params: ?page=1&limit=10
 */
app.get('/api/items', (req, res) => {
    const { page, limit } = req.query;
    res.json(paginate(users, page, limit));
});

/**
 * 2. POST API: Filtered & paginated list of objects
 * Body: { page: 1, limit: 10, filters: { department: '', status: '', search: '' } }
 */
app.post('/api/items/search', (req, res) => {
    const { page = 1, limit = 10, filters = {} } = req.body || {};
    const { department, status, search } = filters;

    let filtered = [...users];

    if (department) {
        filtered = filtered.filter(
            u => u.department.toLowerCase() === String(department).toLowerCase()
        );
    }

    if (status) {
        filtered = filtered.filter(
            u => u.status.toLowerCase() === String(status).toLowerCase()
        );
    }

    if (search) {
        const term = String(search).toLowerCase().trim();
        filtered = filtered.filter(
            u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
        );
    }

    res.json(paginate(filtered, page, limit));
});

// Serve UI page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});