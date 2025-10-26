import { Client, Databases } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  // A helper to add CORS headers on responses
  const withCORS = (data, status = 200, contentType = "application/json") => {
    // `res` likely supports .json, .text, etc., so inject headers into them
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    };
    if (contentType) headers["Content-Type"] = contentType;

    // If data is a string, treat as text response, else JSON
    if (typeof data === "string" && contentType.startsWith("text/"))
      return res.send(data, status, headers);
    if (typeof data === "string")
      return res.send(data, status, headers);
    return res.json(data, status, headers);
  };

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    // No body, but status 204, content-type text/plain
    return withCORS("", 204, "text/plain");
  }

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
  if (req.path === "/ping") return withCORS("Pong", 200, "text/plain");
  if (req.path === "/health") return withCORS("Healthy", 200, "text/plain");

  // helper function for CRUD operations
  const handleCrud = async (collId) => {
    const { method, path, body } = req;
    try {
      // GET all
      if (method === "GET" && path === `/${collId}`) {
        const response = await databases.listDocuments(dbId, collections[collId]);
        return withCORS({ success: true, data: response.documents, total: response.total });
      }

      // GET single
      if (method === "GET" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        const response = await databases.getDocument(dbId, collections[collId], id);
        return withCORS({ success: true, data: response });
      }

      // POST create
      if (method === "POST" && path === `/${collId}`) {
        const input = Array.isArray(body) ? body : [body];
        const results = await Promise.all(
          input.map(obj =>
            databases.createDocument(dbId, collections[collId], "unique()", obj)
          )
        );
        return withCORS({ success: true, data: results }, 201);
      }

      // PUT update
      if (method === "PUT" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        const response = await databases.updateDocument(dbId, collections[collId], id, body);
        return withCORS({ success: true, data: response });
      }

      // DELETE
      if (method === "DELETE" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        await databases.deleteDocument(dbId, collections[collId], id);
        return withCORS({ success: true });
      }

      return null;
    } catch (err) {
      return withCORS({ success: false, error: err.message }, 500);
    }
  };

  // route mapping
  const routes = ["cash_in", "cash_out", "business", "books"];
  for (const route of routes) {
    const result = await handleCrud(route);
    if (result) return result;
  }

  return withCORS({ success: false, error: "Endpoint not found" }, 404);
};
