const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const z = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const server = http.createServer(app); 
const io = new Server(server);

app.use(express.json());
// utilisé par le socket.io
app.use(express.static(__dirname));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/*client.connect().then(() => {
  db = client.db("myDB");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});*/
client.connect().then(() => {
  db = client.db("myDB");

  server.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});


// Schemas
const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string())
});
const CreateProductSchema = ProductSchema.omit({ _id: true });
const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

//GET
app.get("/products", async (req, res) => {
  const result = await db
    .collection("products")
    .aggregate([
      { $match: {} },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ])
    .toArray();

  res.send(result);
});

//POST
app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);
 
  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    
    console.log("categoryIds:", categoryIds);
    
    const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));
 
    const ack = await db
      .collection("products")
      .insertOne({ name, about, price, categoryIds: categoryObjectIds });
 

    io.emit("products", {
      _id: ack.insertedId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    });

    res.send({
      _id: ack.insertedId,
      name,
      about,
      price,
      categoryIds: categoryObjectIds,
    });
  } else {
    res.status(400).send(result);
  }
});

//DELETE
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).send({ message: "Produit non trouvé." });
    }

    await db.collection("products").deleteOne({ _id: new ObjectId(id) });

    io.emit("product deleted", product._id.toString());
    
    res.send(product); // 👈 retourne les détails complets du produit supprimé
  } catch (error) {
    res.status(500).send({ error: "Erreur lors de la suppression.", details: error.message });
  }
});


//POST
app.post("/categories", async (req, res) => {
  const result = await CreateCategorySchema.safeParse(req.body);

  if (result.success) {
    const { name } = result.data;

    const ack = await db.collection("categories").insertOne({ name });

    res.send({ _id: ack.insertedId, name });
  } else {
    res.status(400).send(result);
  }
});