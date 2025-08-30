Omnia Juris
===========

This repository contains a simplified, self‑hosted prototype for **Omnia Juris**, a multi‑tenant legal operations platform.  It supports multiple law firms (tenants) and exposes separate portals for different roles:

* **Firm administration** – manage personnel, open/close matters, approve vendors, and view firm‑wide financial information.
* **Attorneys and support staff** – work on cases, log time, upload documents and view tasks.
* **Clients** – see the status of their matters, upload documents, and request appointments.
* **Vendors** – submit invoices and view payment status.

> **Note:**  This implementation uses only built‑in Node.js modules and stores data in simple JSON files.  It is intended as a starting point and demonstration of the overall system architecture.  In a production environment you would replace the in‑memory token management and file‑based data stores with secure authentication, database tables (e.g. PostgreSQL), and cloud storage services.

## Project structure

```
omnia-juris/
├── apps/
│   ├── api-server/       # Node.js backend serving a JSON API
│   │   ├── server.js     # Main HTTP server with routing and RBAC
│   │   ├── utils/        # Helper functions for auth and data access
│   │   │   ├── auth.js
│   │   │   ├── dataStore.js
│   │   │   └── utils.js
│   │   └── data/         # JSON files used as persistent storage
│   │       ├── tenants.json
│   │       ├── users.json
│   │       ├── cases.json
│   │       ├── tasks.json
│   │       ├── documents.json
│   │       ├── invoices.json
│   │       ├── payments.json
│   │       ├── expenses.json
│   │       ├── vendors.json
│   │       ├── vendor_invoices.json
│   │       └── appointments.json
│   ├── admin-portal/     # HTML/JS pages for firm administration
│   │   ├── index.html
│   │   └── script.js
│   ├── attorney-portal/  # HTML/JS pages for attorneys and staff
│   │   ├── index.html
│   │   └── script.js
│   ├── client-portal/    # HTML/JS pages for clients
│   │   ├── index.html
│   │   └── script.js
│   └── vendor-portal/    # HTML/JS pages for vendors
│       ├── index.html
│       └── script.js
└── package.json
```

## Running the API server

1.  Install Node.js (v18 or later is recommended).  All dependencies are built‑in, so you do not need to install anything from npm.
2.  Navigate to `apps/api-server` and run the server:

```sh
cd apps/api-server
node server.js
```

3.  The server will start on port `3000` by default.  You can test endpoints using `curl` or the provided HTML pages.  For example, create a new tenant and admin user with:

```sh
curl -X POST http://localhost:3000/api/signup \
     -H 'Content-Type: application/json' \
     -d '{"tenantName":"My Law Firm","name":"Alice Admin","email":"alice@example.com","password":"secret","role":"admin"}'
```

## Implementation notes

- **Authentication:**  The API uses a very simple token mechanism.  When users log in they receive a randomly generated token stored in memory on the server.  In practice you should use secure, tamper‑proof JWTs or rely on an identity service.
- **Role‑based access control:**  Each endpoint checks the authenticated user’s role and tenant ID to determine which resources they may access.  Clients can only see their own cases, attorneys and staff can see cases assigned to them or their firm, and admins can see everything in their tenant.
- **Data storage:**  Data is persisted in JSON files within `apps/api-server/data`.  If the server is restarted the data remains intact.  For multi‑user concurrency and scalability you should migrate to a relational database such as PostgreSQL and use an ORM such as Prisma.
- **Outlook calendar integration:**  This prototype does not implement calendar sync.  You would integrate with the Microsoft Graph API from the server layer and surface calendar data in the appointment endpoints.
