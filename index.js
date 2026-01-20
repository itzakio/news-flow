require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const axios = require("axios");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");

app.use(express.json());
app.use(cors());

const uri = process.env.URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const run = async () => {
  try {
    await client.connect();
    const database = client.db("news_db");
    const newsCollection = database.collection("news");

    app.get("/sync-news", async (req, res) => {
      try {
        const country = req.query.country || "us";
        const category = req.query.category || "business";

        const response = await axios.get(
          `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&apiKey=${process.env.NEWS_API_KEY}`,
        );

        const articles = response.data.articles.map((item) => ({
          title: item.title,
          description: item.description,
          image: item.urlToImage,
          source: item.source?.name,
          publishedAt: new Date(item.publishedAt),
          url: item.url,
          country,
          category,
          createdAt: new Date(),
        }));

        // 🔴 Remove old news (avoid duplicates)
        await newsCollection.deleteMany({ country, category });

        // ✅ Save new news
        await newsCollection.insertMany(articles);

        res.send({
          message: "News fetched & saved successfully",
          count: articles.length,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to sync news" });
      }
    });

    app.get("/news", async (req, res) => {
      try {
        const { country = "us", category } = req.query;

        const filter = { country };

        if (category) {
          filter.category = category;
        }

        const news = await newsCollection
          .find(filter)
          .sort({ publishedAt: -1 })
          .limit(20)
          .toArray();

        res.send(news);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to load news" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
};
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
