import { Client, Users, Databases } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  // Use env variables directly from @file_context_0 (.env)
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const users = new Users(client);
  const databases = new Databases(client);

  // Convenience: use env variables once at the top
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const collectionId = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID;

  // Mock endpoints
  if (req.path === "/ping") {
    return res.text("Pong");
  }

  if (req.path === "/health") {
    return res.text("Healthy");
  }

  // GET: Fetch all documents from database
  if (req.path === "/data" && req.method === "GET") {
    try {
      const response = await databases.listDocuments(
        databaseId,
        collectionId
      );
      log(`Retrieved ${response.total} documents`);
      return res.json({
        success: true,
        data: response.documents,
        total: response.total
      });
    } catch (err) {
      error("Could not fetch data: " + err.message);
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // GET: Fetch single document by ID
  if (req.path.startsWith("/data/") && req.method === "GET") {
    const documentId = req.path.split("/data/")[1];
    try {
      const response = await databases.getDocument(
        databaseId,
        collectionId,
        documentId
      );
      log(`Retrieved document: ${documentId}`);
      return res.json({
        success: true,
        data: response
      });
    } catch (err) {
      error("Could not fetch document: " + err.message);
      return res.json({ success: false, error: err.message }, 404);
    }
  }

  // POST: Create new document
  if (req.path === "/data" && req.method === "POST") {
    try {
      const response = await databases.createDocument(
        databaseId,
        collectionId,
        'unique()', // Auto-generate ID
        req.body // Your data payload
      );
      log(`Created document: ${response.$id}`);
      return res.json({
        success: true,
        message: "Document created successfully",
        data: response
      }, 201);
    } catch (err) {
      error("Could not create document: " + err.message);
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // PUT: Update document by ID
  if (req.path.startsWith("/data/") && req.method === "PUT") {
    const documentId = req.path.split("/data/")[1];
    try {
      const response = await databases.updateDocument(
        databaseId,
        collectionId,
        documentId,
        req.body
      );
      log(`Updated document: ${documentId}`);
      return res.json({
        success: true,
        message: "Document updated successfully",
        data: response
      });
    } catch (err) {
      error("Could not update document: " + err.message);
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // DELETE: Remove document by ID
  if (req.path.startsWith("/data/") && req.method === "DELETE") {
    const documentId = req.path.split("/data/")[1];
    try {
      await databases.deleteDocument(
        databaseId,
        collectionId,
        documentId
      );
      log(`Deleted document: ${documentId}`);
      return res.json({
        success: true,
        message: "Document deleted successfully"
      });
    } catch (err) {
      error("Could not delete document: " + err.message);
      return res.json({ success: false, error: err.message }, 500);
    }
  }

  // Default 404
  return res.json({
    success: false,
    error: "Endpoint not found"
  }, 404);
};
