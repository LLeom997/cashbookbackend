import { Client, Databases, ID, Query } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

  const collections = {
    cash_in: process.env.NEXT_PUBLIC_APPWRITE_CASH_IN_COLLECTION_ID,
    cash_out: process.env.NEXT_PUBLIC_APPWRITE_CASH_OUT_COLLECTION_ID,
    business: process.env.NEXT_PUBLIC_APPWRITE_BUSINESS_COLLECTION_ID,
    books: process.env.NEXT_PUBLIC_APPWRITE_BOOKS_COLLECTION_ID
  };

  // Health check routes
  if (req.path === "/ping") return res.text("Pong");
  if (req.path === "/health") return res.text("Healthy");

  // Helper: Find businessId by name or return existing
  const findBusinessId = async (obj) => {
    const { businessId, business_name } = obj || {};
    if (businessId) return businessId;

    if (business_name) {
      const result = await databases.listDocuments(dbId, collections.business, [
        Query.equal("name", business_name)
      ]);
      if (result.total > 0) return result.documents[0].$id;
    }
    return null;
  };

  // CRUD handler
  const handleCrud = async (collId) => {
    const method = req.method;
    const path = req.path || "";
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;

    try {
      // GET all
      if (method === "GET" && path.includes(`/${collId}`) && !path.includes(`/${collId}/`)) {
        const response = await databases.listDocuments(dbId, collections[collId]);
        return res.status(200).json({ success: true, data: response.documents, total: response.total });
      }

      // GET single
      if (method === "GET" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        const response = await databases.getDocument(dbId, collections[collId], id);
        return res.status(200).json({ success: true, data: response });
      }

      // POST create logic
      if (method === "POST" && path === `/${collId}`) {
        const input = Array.isArray(body) ? body : [body];
        const results = [];

        if (collId === "business") {
          for (const obj of input) {
            results.push(await databases.createDocument(dbId, collections[collId], ID.unique(), obj));
          }
          return res.status(201).json({ success: true, data: results });
        }

        if (collId === "books") {
          for (const obj of input) {
            let bookData = { ...obj };
            if (!bookData.businessId) {
              const businessId = await findBusinessId(bookData);
              if (!businessId) {
                return res.status(400).json({ success: false, error: "Related business not found for book creation." });
              }
              bookData.businessId = businessId;
            }
            results.push(await databases.createDocument(dbId, collections.books, ID.unique(), bookData));
          }
          return res.status(201).json({ success: true, data: results });
        }

        if (collId === "cash_in") {
          for (const obj of input) {
            let cashData = { ...obj };
            let bookId = cashData.bookId;

            if (!bookId && cashData.book_name) {
              const booksRes = await databases.listDocuments(dbId, collections.books, [
                Query.equal("name", cashData.book_name)
              ]);
              if (booksRes.total > 0) {
                bookId = booksRes.documents[0].$id;
                cashData.bookId = bookId;
                cashData.businessId = cashData.businessId || booksRes.documents[0].businessId;
              }
            }

            if (!bookId) {
              return res.status(400).json({ success: false, error: "Related book not found for cash_in creation." });
            }

            if (!cashData.businessId) {
              const book = await databases.getDocument(dbId, collections.books, bookId);
              if (book.businessId) cashData.businessId = book.businessId;
            }

            results.push(await databases.createDocument(dbId, collections.cash_in, ID.unique(), cashData));
          }
          return res.status(201).json({ success: true, data: results });
        }

        // Default create for others (e.g. cash_out)
        for (const obj of input) {
          results.push(await databases.createDocument(dbId, collections[collId], ID.unique(), obj));
        }
        return res.status(201).json({ success: true, data: results });
      }

      // PUT update
      if (method === "PUT" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        const response = await databases.updateDocument(dbId, collections[collId], id, body);
        return res.status(200).json({ success: true, data: response });
      }

      // DELETE
      if (method === "DELETE" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
        await databases.deleteDocument(dbId, collections[collId], id);
        return res.status(200).json({ success: true });
      }

      return null;
    } catch (err) {
      log(`Error in ${collId}: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  // Route order matters
  const routes = ["business", "books", "cash_in", "cash_out"];
  for (const route of routes) {
    const result = await handleCrud(route);
    if (result) return result;
  }

  return res.status(404).json({ success: false, error: "Endpoint not found" });
};
