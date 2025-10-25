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

  // Helper to find business by a given criteria in book or cash_in object
  const findBusinessId = async (obj) => {
    // You can change this logic if you want to match on a different field
    const { businessId, business_name } = obj || {};
    if (businessId) {
      // Assume businessId is valid, return as is
      return businessId;
    }
    if (business_name) {
      // Try to find business by name
      const result = await databases.listDocuments(dbId, collections.business, [
        // String query, see Appwrite docs; update according to your attribute
        // e.g. `Query.equal('name', business_name)`
        // For v1 compatibility, use: ['name="some_name"']
        `name="${business_name}"`
      ]);
      if (result?.total > 0 && result.documents.length > 0) {
        return result.documents[0].$id;
      }
    }
    // Business not found
    return null;
  };

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

      // POST create, with relation logic for business/books/cash_in
      if (method === "POST" && path === `/${collId}`) {
        const input = Array.isArray(body) ? body : [body];
        let results;

        if (collId === "business") {
          // Create business as usual
          results = await Promise.all(
            input.map(obj =>
              databases.createDocument(dbId, collections[collId], "unique()", obj)
            )
          );
          return res.json({ success: true, data: results }, 201);
        }

        if (collId === "books") {
          // For each book, attempt to associate with a business
          results = [];
          for (const obj of input) {
            let bookData = { ...obj };

            // Find businessId if not present
            let businessId = bookData.businessId;
            if (!businessId) {
              businessId = await findBusinessId(bookData);
              if (!businessId) {
                return res.json({ success: false, error: "Related business not found for book creation." }, 400);
              }
              bookData.businessId = businessId;
            }
            // you might want to remove business_name here to avoid duplicating or leaking fields
            results.push(await databases.createDocument(dbId, collections.books, "unique()", bookData));
          }
          return res.json({ success: true, data: results }, 201);
        }

        if (collId === "cash_in") {
          // For each cash_in entry, associate with a book (and thus business)
          results = [];
          for (const obj of input) {
            let cashData = { ...obj };

            // Ensure it is attached to a book (which itself should be attached to a business)
            let bookId = cashData.bookId;
            if (!bookId) {
              // Optionally, find a book based on data such as book_name
              if (cashData.book_name) {
                const booksRes = await databases.listDocuments(dbId, collections.books, [
                  `name="${cashData.book_name}"`
                ]);
                if (booksRes?.total > 0 && booksRes.documents.length > 0) {
                  bookId = booksRes.documents[0].$id;
                  cashData.bookId = bookId;
                  if (!cashData.businessId && booksRes.documents[0].businessId) {
                    cashData.businessId = booksRes.documents[0].businessId;
                  }
                }
              }
            }
            // If no bookId found, error
            if (!bookId) {
              return res.json({ success: false, error: "Related book not found for cash_in creation." }, 400);
            }

            // Ensure businessId is also attached (from the book)
            if (!cashData.businessId) {
              const book = await databases.getDocument(dbId, collections.books, bookId);
              if (book?.businessId) cashData.businessId = book.businessId;
            }

            results.push(await databases.createDocument(dbId, collections.cash_in, "unique()", cashData));
          }
          return res.json({ success: true, data: results }, 201);
        }

        // For all others (e.g. cash_out), create as usual
        results = await Promise.all(
          input.map(obj =>
            databases.createDocument(dbId, collections[collId], "unique()", obj)
          )
        );
        return res.json({ success: true, data: results }, 201);
      }

      // PUT update
      if (method === "PUT" && path.startsWith(`/${collId}/`)) {
        const id = path.split(`/${collId}/`)[1];
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

  // The order is important: business first, then books, then cash_in, then cash_out
  const routes = ["business", "books", "cash_in", "cash_out"];
  for (const route of routes) {
    const result = await handleCrud(route);
    if (result) return result;
  }

  return res.json({ success: false, error: "Endpoint not found" }, 404);
};
