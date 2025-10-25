import { Client, ID, TablesDB } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const tablesDB = new TablesDB(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const tableId = process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID;

  // Mock endpoints
  if (req.path === "/ping") return res.text("Pong");
  if (req.path === "/health") return res.text("Healthy");

  // GET all rows
  if (req.path === "/data" && req.method === "GET") {
    try {
      const response = await tablesDB.listRows({
        databaseId: dbId,
        tableId: tableId
      });
      return res.json({ success: true, data: response.rows, total: response.total });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // GET single row
  if (req.path.startsWith("/data/") && req.method === "GET") {
    try {
      const rowId = req.path.split("/data/")[1];
      const response = await tablesDB.getRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: rowId
      });
      return res.json({ success: true, data: response });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 404);
    }
  }

  // POST create row
  if (req.path === "/data" && req.method === "POST") {
    try {
      const response = await tablesDB.createRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: ID.unique(),
        data: req.body
      });
      return res.json({ success: true, data: response }, 201);
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // PUT update row
  if (req.path.startsWith("/data/") && req.method === "PUT") {
    try {
      const rowId = req.path.split("/data/")[1];
      const response = await tablesDB.updateRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: rowId,
        data: req.body
      });
      return res.json({ success: true, data: response });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // DELETE row
  if (req.path.startsWith("/data/") && req.method === "DELETE") {
    try {
      const rowId = req.path.split("/data/")[1];
      await tablesDB.deleteRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: rowId
      });
      return res.json({ success: true });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  return res.json({ success: false, error: "Endpoint not found" }, 404);
};
