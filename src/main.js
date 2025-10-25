import { Client, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);

  try {
    const response = await users.list();
    log(`Total users: ${response.total}`);
  } catch(err) {
    error("Could not list users: " + err.message);
  }

  // Existing ping endpoint
  if (req.path === "/ping") {
    return res.text("Pong");
  }

  // NEW ENDPOINT: Get user count
  if (req.path === "/users/count") {
    try {
      const response = await users.list();
      return res.json({
        total: response.total,
        message: "User count retrieved successfully"
      });
    } catch(err) {
      return res.json({ error: err.message }, 500);
    }
  }

  // NEW ENDPOINT: Health check
  if (req.path === "/health") {
    return res.json({
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  }

  // NEW ENDPOINT: Echo POST data
  if (req.path === "/echo" && req.method === "POST") {
    return res.json({
      received: req.body,
      method: req.method,
      path: req.path
    });
  }

  // Default response
  return res.json({
    motto: "Build like a team of hundreds_",
    learn: "https://appwrite.io/docs",
    connect: "https://appwrite.io/discord",
    getInspired: "https://builtwith.appwrite.io",
  });
};
