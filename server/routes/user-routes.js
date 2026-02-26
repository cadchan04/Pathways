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
      console.log("New user created with Auth0 ID:", user.auth0Id);
    }
    else {
      //console.log("Existing user with Auth0 ID:", user.auth0Id);
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:auth0Id", async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.params.auth0Id });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:auth0Id", async (req, res) => {
  try {
    const { name, notificationEnabled } = req.body;

    const user = await User.findOneAndUpdate(
      { auth0Id: req.params.auth0Id },
      { name, notificationEnabled },
      { new: true }
    );

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
