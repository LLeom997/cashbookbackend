import { Client, Databases } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

  // collection IDs for different data sets
  const collections = {
    cash_in: process.env.NEXT_PUBLIC_APPWRITE_CASH_IN_COLLECTION_ID,
    cash_out: process.env.NEXT_PUBLIC_APPWRITE_CASH_OUT_COLLECTION_ID,
    business: process.env.NEXT_PUBLIC_APPWRITE_BUSINESS_COLLECTION_ID,
    books: process.env.NEXT_PUBLIC_APPWRITE_BOOKS_COLLECTION_ID
  };

  // health checks
  if (req.path === "/ping") return res.text("Pong");
  if (req.path === "/health") return res.text("Healthy");

  // helper function for CRUD operations
  const handleCrud = async (collId) => {
    const { method, path, body } = req;
    try {
      // GET all
      if (method === "GET" && path === `/${collId}`) {
        const response = await databases.listDocuments(dbId, collections[collId]);
        return res.json({ success: true, data: response.documents, total: response.total });
      }

      // GET single
      if (method === "GET" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        const response = await databases.getDocument(dbId, collections[collId], id);
        return res.json({ success: true, data: response });
      }

      // POST create
      if (method === "POST" && path === `/${collId}`) {
        const input = Array.isArray(body) ? body : [body];
        const results = await Promise.all(
          input.map(obj =>
            databases.createDocument(dbId, collections[collId], "unique()", obj)
          )
        );
        return res.json({ success: true, data: results }, 201);
      }

      // PUT update for /:collId/:id
      if (method === "PUT" && path.match(new RegExp(`^/${collId}/[^/]+$`))) {
        const id = path.split(`/${collId}/`)[1];
        if (!id) {
          return res.json({ success: false, error: "Missing document id in URL" }, 400);
        }
        const response = await databases.updateDocument(dbId, collections[collId], id, body);
        return res.json({ success: true, data: response });
      }

      // DELETE
      if (method === "DELETE" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        await databases.deleteDocument(dbId, collections[collId], id);
        return res.json({ success: true });
      }

      return null;
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  };

  // route mapping
  const routes = ["cash_in", "cash_out", "business", "books"];
  for (const route of routes) {
    const result = await handleCrud(route);
    if (result) return result;
  }

  return res.json({ success: false, error: "Endpoint not found" }, 404);
};
