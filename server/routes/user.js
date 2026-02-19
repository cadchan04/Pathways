const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/sync", async (req, res) => {
  const { sub, email, name, picture } = req.body;

  try {
    let user = await User.findOne({ auth0Id: sub });

    if (!user) {
      user = await User.create({
        auth0Id: sub,
        email,
        name,
        picture
      });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
