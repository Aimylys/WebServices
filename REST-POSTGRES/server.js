const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
const port = 8000;

const crypto = require("crypto");

function hashPassword(password) {
  return crypto.createHash("sha512").update(password).digest("hex");
}

// BDD
const sql = postgres({
  db: "produitsdb",
  user: "postgres",
  password: "Scarlette197304",
});

app.use(express.json());

//ZOD
const CreateUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

const UpdateUserSchema = CreateUserSchema;

const PatchUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
	
const CreateProductSchema = ProductSchema.omit({ id: true });


//--CRUD produits--//
// GET produits
/**
 * @swagger
 * /products:
 *   get:
 *     summary: Affiche tout les produits
 */
app.get("/products", async (req, res) => {
  const { name, about, price } = req.query;

  try {
    const conditions = [];

    if (name) {
      conditions.push(sql`name ILIKE ${`%${name}%`}`);
    }
    if (about) {
      conditions.push(sql`about ILIKE ${`%${about}%`}`);
    }
    if (price) {
      const priceNum = Number(price);
      if (isNaN(priceNum)) {
        return res.status(400).json({ error: "Paramètre price invalide" });
      }
      conditions.push(sql`price <= ${priceNum}`);
    }

    let whereClause = sql``;
    if (conditions.length > 0) {
      whereClause = conditions.reduce((acc, condition, index) => {
        if (index === 0) return sql`WHERE ${condition}`;
        return sql`${acc} AND ${condition}`;
      }, sql``);
    }

    const products = await sql`
      SELECT * FROM products
      ${whereClause}
    `;

    res.json(products);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des produits.", details: error.message });
  }
});

// GET produits avec id
/**
 * @swagger
 * /products/:id:
 *   get:
 *     summary: Affiche le détail d'un produit
 */
app.get("/products/:id", async (req, res) => {
  const product = await sql`
    SELECT * FROM products WHERE id=${req.params.id}
    `;
 
  if (product.length > 0) {
    res.send(product[0]);
  } else {
    res.status(404).send({ message: "Not found" });
  }
});

// POST 
/**
 * @swagger
 * /products:
 *   post:
 *     summary: Créer un produit
 */
app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);
 
  // If Zod parsed successfully the request body
  if (result.success) {
    const { name, about, price } = result.data;
 
    const product = await sql`
    INSERT INTO products (name, about, price)
    VALUES (${name}, ${about}, ${price})
    RETURNING *
    `;
 
    res.send(product[0]);
  } else {
    res.status(400).send(result);
  }
});

//PUT
/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Met à jour complètement un produit existant
 */
app.put("/products/:id", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(result);
  }

  const { name, about, price } = result.data;

  try {
    const updated = await sql`
      UPDATE products
      SET name = ${name}, about = ${about}, price = ${price}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }

    res.send(updated[0]);
  } catch (err) {
    console.error("Erreur PUT /products/:id:", err);
    res.status(500).send({ error: "Erreur serveur", details: err.message });
  }
});

//PATCH
/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Met à jour partiellement un produit
 */
app.patch("/products/:id", async (req, res) => {
  const { name, about, price } = req.body;

  // Construire dynamiquement la requête SQL
  const updates = [];
  if (name !== undefined) updates.push({ field: 'name', value: name });
  if (about !== undefined) updates.push({ field: 'about', value: about });
  if (price !== undefined) {
    const priceNum = Number(price);
    if (isNaN(priceNum)) {
      return res.status(400).json({ error: "Le champ price doit être un nombre" });
    }
    updates.push({ field: 'price', value: priceNum });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "Aucun champ valide à mettre à jour" });
  }

  // Crée dynamiquement la requête UPDATE
  const setFragments = updates.map((u, i) => `${u.field} = $${i + 1}`).join(', ');
  const values = updates.map(u => u.value);

  try {
    const result = await sql.unsafe(
      `UPDATE products SET ${setFragments} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, req.params.id]
    );

    if (result.length === 0) {
      return res.status(404).send({ message: "Produit non trouvé" });
    }

    res.send(result[0]);
  } catch (err) {
    console.error("Erreur PATCH /products/:id:", err);
    res.status(500).send({ error: "Erreur serveur", details: err.message });
  }
});

// DELETE 
/**
 * @swagger
 * /products:
 *   delete:
 *     summary: Supprime un produit
 */
app.delete("/products/:id", async (req, res) => {
  const product = await sql`
    DELETE FROM products
    WHERE id=${req.params.id}
    RETURNING *
    `;

  if (product.length > 0) {
    res.send(product[0]);
  } else {
    res.status(404).send({ message: "Not found" });
  }
});

//--CRUD users--//
//GET users
app.get("/users", async (req, res) => {
  try {
    const users = await sql`SELECT id, username, email FROM users`;
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//GET users par id
app.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const user = await sql`SELECT id, username, email FROM users WHERE id = ${id}`;
    if (user.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

//POST
app.post("/users", async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: "Requête invalide", details: result.error.errors });
  }

  const { username, email, password } = result.data;
  const hashedPassword = hashPassword(password);

  try {
    const [user] = await sql`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashedPassword})
      RETURNING id, username, email
    `;
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur" });
  }
});

//PUT
app.put("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  const result = UpdateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Requête invalide", details: result.error.errors });
  }

  const { username, email, password } = result.data;
  const hashedPassword = hashPassword(password);

  try {
    const updated = await sql`
      UPDATE users SET
        username = ${username},
        email = ${email},
        password = ${hashedPassword}
      WHERE id = ${id}
      RETURNING id, username, email
    `;
    if (updated.length === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

//PATCH
app.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  const result = PatchUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Requête invalide", details: result.error.errors });
  }

  try {
    const [updated] = await sql`
      UPDATE users SET
        ${sql(result.data)}
      WHERE id = ${id}
      RETURNING id, username, email
    `;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour partielle" });
  }
});


// Test route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Lancer serveur
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
  console.log(`Swagger : http://localhost:${port}/api-docs`);
});


//--f2g-games--exo2--//
//const fetch = require("node-fetch");
//node-fetch est mtn un module ECMAScript(ESM), pas compatible avec require() -> erreur.
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

// GET
app.get("/f2p-games", async (req, res) => {
  try {
    const response = await fetch("https://www.freetogame.com/api/games");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des jeux." });
  }
});

// GET par id
app.get("/f2p-games/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const response = await fetch(`https://www.freetogame.com/api/game?id=${id}`);
    
    if (!response.ok) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    const game = await response.json();
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du jeu." });
  }
});


//--syst-panier--exo4--//
//GET Orders
app.get("/orders", async (req, res) => {
  try {
    const orders = await sql`
      SELECT
        o.id,
        o.total,
        o.payment,
        o.created_at,
        o.updated_at,
        json_build_object('id', u.id, 'username', u.username, 'email', u.email) as user,
        (
          SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'about', p.about, 'price', p.price))
          FROM products p
          JOIN order_products op ON p.id = op.product_id
          WHERE op.order_id = o.id
        ) as products
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
    `;

    // Heure France
    const formatted = orders.map(order => ({
      ...order,
      created_at: new Date(order.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      updated_at: new Date(order.updated_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des commandes", details: err.message });
  }
});

//GET par id
app.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const orders = await sql`
      SELECT
        o.id,
        o.total,
        o.payment,
        o.created_at,
        o.updated_at,
        json_build_object('id', u.id, 'username', u.username, 'email', u.email) as user,
        (
          SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'about', p.about, 'price', p.price))
          FROM products p
          JOIN order_products op ON p.id = op.product_id
          WHERE op.order_id = o.id
        ) as products
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ${id}
    `;

    if (orders.length === 0) return res.status(404).json({ error: "Commande non trouvée" });

    const order = orders[0];

    // Heure France
    const formatted = {
      ...order,
      created_at: new Date(order.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      updated_at: new Date(order.updated_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
    };
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération de la commande", details: err.message });
  }
});


//POST Orders
app.post("/orders", async (req, res) => {
  try {
    const { userId, productIds } = req.body;

    if (!userId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: "userId et productIds sont requis" });
    }

    const products = await sql`
      SELECT id, price FROM products WHERE id IN ${sql(productIds)}
    `;

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "Certains produits n'existent pas" });
    }

    const totalHT = products.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const totalTTC = +(totalHT * 1.2).toFixed(2); // TVA 20%

    const [order] = await sql`
      INSERT INTO orders (user_id, total, payment, created_at, updated_at)
      VALUES (${userId}, ${totalTTC}, false, NOW(), NOW())
      RETURNING *
    `;

    // Insérer relations order_products
    const orderProducts = productIds.map(pid => ({ order_id: order.id, product_id: pid }));
    await sql`
      INSERT INTO order_products ${sql(orderProducts, 'order_id', 'product_id')}
    `;

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la création de la commande", details: err.message });
  }
});


//--syst-documentation--//
// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Service Web TP API",
      version: "1.0.0",
      description: "API REST pour produits et commandes",
    },
    servers: [
      {
        url: "http://localhost:8000",
      },
    ],
  },
  apis: ["./server.js"], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));





