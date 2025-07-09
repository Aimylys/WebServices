const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const z = require("zod");

const app = express();
const port = 8001;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

client.connect().then(() => {
  db = client.db("analyticsDB");
  app.listen(port, () => {
    console.log(`✅ REST-ANALYTICS running on http://localhost:${port}`);
  });
});

const baseSchema = z.object({
  source: z.string(),
  url: z.string().url(),
  visitor: z.string(),
  createdAt: z.coerce.date(), 
  meta: z.record(z.any())
});

const ViewSchema = baseSchema;
const ActionSchema = baseSchema.extend({
  action: z.string()
});
const GoalSchema = z.object({
  source: z.string(),
  url: z.string(), 
  goal: z.string(),
  visitor: z.string(),
  createdAt: z.date(),
  meta: z.record(z.any()).optional()
});


//GET View
app.get("/views", async (req, res) => {
  const views = await db.collection("views").find().toArray();
  res.send(views);
});

//POST View
app.post("/views", async (req, res) => {
  const result = ViewSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result.error);

  const inserted = await db.collection("views").insertOne(result.data);
  res.status(201).send({ _id: inserted.insertedId, ...result.data });
});

//GET Actions
app.get("/actions", async (req, res) => {
  const actions = await db.collection("actions").find().toArray();
  res.send(actions);
});

//POST Actions
app.post("/actions", async (req, res) => {
  const result = ActionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).send(result.error);

  const inserted = await db.collection("actions").insertOne(result.data);
  res.status(201).send({ _id: inserted.insertedId, ...result.data });
});

//GET Goals
app.get("/goals", async (req, res) => {
  const goals = await db.collection("goals").find().toArray();
  res.send(goals);
});

//GET par id/detail
app.get("/goals/:goalId/details", async (req, res) => {
  const goalId = req.params.goalId;

  if (!ObjectId.isValid(goalId)) {
    return res.status(400).json({ error: "ID de goal invalide" });
  }

  try {
    const goal = await db.collection("goals").findOne({ _id: new ObjectId(goalId) });

    if (!goal) {
      return res.status(404).json({ error: "Goal non trouvé" });
    }

    const visitorId = goal.visitor;

    const [views, actions] = await Promise.all([
      db.collection("views").find({ visitor: visitorId }).toArray(),
      db.collection("actions").find({ visitor: visitorId }).toArray()
    ]);

    res.json({
      goal,
      views,
      actions
    });

  } catch (err) {
    console.error("Erreur:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

//POST Goal
app.post("/goals", async (req, res) => {
  try {
    const goalData = {
      ...req.body,
      createdAt: new Date(),
      meta: req.body.meta || {}
    };

    const result = GoalSchema.safeParse(goalData);
    if (!result.success) return res.status(400).send(result.error);

    const inserted = await db.collection("goals").insertOne(result.data);
    res.status(201).send({ _id: inserted.insertedId, ...result.data });

  } catch (err) {
    console.error("Erreur POST /goals:", err);
    res.status(500).send({ error: "Erreur serveur", details: err.message });
  }
});


