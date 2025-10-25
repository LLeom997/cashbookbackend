import { Client, Databases } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const collId = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID;

  // Mock endpoints
  if (req.path === "/ping") return res.text("Pong");
  if (req.path === "/health") return res.text("Healthy");

  // GET all documents
  if (req.path === "/" && req.method === "GET") {
    try {
      const response = await databases.listDocuments(dbId, collId);
      return res.json({ success: true, data: response.documents, total: response.total });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // GET single document
  if (req.path.startsWith("/data/") && req.method === "GET") {
    try {
      const id = req.path.split("/data/")[1];
      const response = await databases.getDocument(dbId, collId, id);
      return res.json({ success: true, data: response });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 404);
    }
  }

  // POST create documents (array of objects compatible)
  if (req.path === "/data" && req.method === "POST") {
    try {
      const input = Array.isArray(req.body) ? req.body : [req.body];

      // Use Promise.all to create all documents in parallel
      const results = await Promise.all(
        input.map(obj =>
          databases.createDocument(dbId, collId, 'unique()', obj)
        )
      );

      return res.json({ success: true, data: results }, 201);
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // PUT update document
  if (req.path.startsWith("/data/") && req.method === "PUT") {
    try {
      const id = req.path.split("/data/")[1];
      const response = await databases.updateDocument(dbId, collId, id, req.body);
      return res.json({ success: true, data: response });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // DELETE document
  if (req.path.startsWith("/data/") && req.method === "DELETE") {
    try {
      const id = req.path.split("/data/")[1];
      await databases.deleteDocument(dbId, collId, id);
      return res.json({ success: true });
    } catch (err) {
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  return res.json({ success: false, error: "Endpoint not found" }, 404);
};
