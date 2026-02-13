const express = require('express');
const Example = require('../models/Example');

const router = express.Router();

// Create a new example
router.post('/', async (req, res) => {
    const newExample = new Example({
        name: req.body.name,
        value: req.body.value
    });

    try {
        const savedExample = await newExample.save();
        res.status(201).json(savedExample);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all examples
router.get('/', async (req, res) => {
  try {
    const examples = await Example.find();
    res.json(examples);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;